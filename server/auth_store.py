from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


class AuthStoreError(RuntimeError):
    pass


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _data_dir() -> Path:
    configured = os.getenv("ETHICAL_WORLD_DATA_DIR")
    root = Path(configured).expanduser() if configured else Path.home() / ".ethical-world"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _db_path() -> Path:
    return _data_dir() / "ethical-world.db"


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(_db_path())
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def _password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2**15,
        r=8,
        p=1,
        dklen=32,
    )


def _token_digest(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def init_auth_store() -> None:
    with _connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                password_salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash BLOB NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                label TEXT NOT NULL,
                public_identity_key TEXT,
                public_prekey TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS message_envelopes (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                sender_user_id TEXT NOT NULL,
                sender_device_id TEXT NOT NULL,
                recipient_user_id TEXT NOT NULL,
                algorithm TEXT NOT NULL,
                nonce BLOB NOT NULL,
                ciphertext BLOB NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(sender_device_id) REFERENCES devices(id) ON DELETE CASCADE,
                FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
            CREATE INDEX IF NOT EXISTS idx_message_recipient_time
                ON message_envelopes(recipient_user_id, created_at);
            """
        )


def user_by_email(email: str) -> dict[str, Any] | None:
    normalized = _normalize_email(email)

    with _connect() as connection:
        row = connection.execute(
            "SELECT id, email, display_name, created_at FROM users WHERE email = ?",
            (normalized,),
        ).fetchone()

    return dict(row) if row else None


def register_user(email: str, password: str, display_name: str) -> dict[str, Any]:
    normalized = _normalize_email(email)
    clean_name = display_name.strip()

    if "@" not in normalized or len(normalized) > 320:
        raise AuthStoreError("Neplatný e-mail.")
    if len(password) < 12:
        raise AuthStoreError("Heslo musí mít alespoň 12 znaků.")
    if not clean_name or len(clean_name) > 120:
        raise AuthStoreError("Neplatné zobrazované jméno.")

    salt = secrets.token_bytes(16)
    digest = _password_digest(password, salt)
    user_id = str(uuid.uuid4())
    created_at = _utc_now().isoformat()

    try:
        with _connect() as connection:
            connection.execute(
                """
                INSERT INTO users(id, email, display_name, password_salt, password_hash, created_at)
                VALUES(?, ?, ?, ?, ?, ?)
                """,
                (user_id, normalized, clean_name, salt, digest, created_at),
            )
    except sqlite3.IntegrityError as error:
        raise AuthStoreError("Účet s tímto e-mailem už existuje.") from error

    return {
        "id": user_id,
        "email": normalized,
        "displayName": clean_name,
        "createdAt": created_at,
    }


def login_user(email: str, password: str) -> tuple[dict[str, Any], str, str]:
    normalized = _normalize_email(email)

    with _connect() as connection:
        row = connection.execute(
            """
            SELECT id, email, display_name, password_salt, password_hash, created_at
            FROM users
            WHERE email = ?
            """,
            (normalized,),
        ).fetchone()

        if not row:
            raise AuthStoreError("Neplatný e-mail nebo heslo.")

        candidate = _password_digest(password, row["password_salt"])
        if not hmac.compare_digest(candidate, row["password_hash"]):
            raise AuthStoreError("Neplatný e-mail nebo heslo.")

        token = secrets.token_urlsafe(48)
        session_id = str(uuid.uuid4())
        created = _utc_now()
        expires = created + timedelta(days=30)

        connection.execute(
            """
            INSERT INTO sessions(id, user_id, token_hash, created_at, expires_at)
            VALUES(?, ?, ?, ?, ?)
            """,
            (
                session_id,
                row["id"],
                _token_digest(token),
                created.isoformat(),
                expires.isoformat(),
            ),
        )

    user = {
        "id": row["id"],
        "email": row["email"],
        "displayName": row["display_name"],
        "createdAt": row["created_at"],
    }

    return user, token, expires.isoformat()


def user_from_session(token: str) -> dict[str, Any] | None:
    if not token:
        return None

    token_hash = _token_digest(token)
    now = _utc_now().isoformat()

    with _connect() as connection:
        row = connection.execute(
            """
            SELECT u.id, u.email, u.display_name, u.created_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (token_hash, now),
        ).fetchone()

    if not row:
        return None

    return {
        "id": row["id"],
        "email": row["email"],
        "displayName": row["display_name"],
        "createdAt": row["created_at"],
    }


def bootstrap_admin_from_env() -> None:
    email = os.getenv("ETHICAL_WORLD_ADMIN_EMAIL", "").strip()
    password = os.getenv("ETHICAL_WORLD_ADMIN_PASSWORD", "")
    display_name = os.getenv("ETHICAL_WORLD_ADMIN_NAME", "Admin").strip() or "Admin"

    if not email and not password:
        return

    if not email or not password:
        raise AuthStoreError(
            "Bootstrap admin vyžaduje ETHICAL_WORLD_ADMIN_EMAIL i ETHICAL_WORLD_ADMIN_PASSWORD."
        )

    if user_by_email(email):
        return

    register_user(email, password, display_name)
