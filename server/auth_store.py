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
        maxmem=64 * 1024 * 1024,
        dklen=32,
    )


def _token_digest(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _user_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "email": row["email"],
        "displayName": row["display_name"],
        "createdAt": row["created_at"],
        "role": row["role"],
        "mustChangePassword": bool(row["must_change_password"]),
    }


def _create_session(
    connection: sqlite3.Connection,
    user_id: str,
    days: int = 30,
) -> tuple[str, str]:
    token = secrets.token_urlsafe(48)
    session_id = str(uuid.uuid4())
    created = _utc_now()
    expires = created + timedelta(days=days)

    connection.execute(
        """
        INSERT INTO sessions(id, user_id, token_hash, created_at, expires_at)
        VALUES(?, ?, ?, ?, ?)
        """,
        (
            session_id,
            user_id,
            _token_digest(token),
            created.isoformat(),
            expires.isoformat(),
        ),
    )
    return token, expires.isoformat()


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
                created_at TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                must_change_password INTEGER NOT NULL DEFAULT 0
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

            CREATE TABLE IF NOT EXISTS connector_secrets (
                user_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                encrypted_payload BLOB NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(user_id, provider),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
            CREATE INDEX IF NOT EXISTS idx_message_recipient_time
                ON message_envelopes(recipient_user_id, created_at);
            """
        )

        columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(users)").fetchall()
        }

        if "role" not in columns:
            connection.execute(
                "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"
            )

        if "must_change_password" not in columns:
            connection.execute(
                "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"
            )

        owner = connection.execute(
            "SELECT id FROM users WHERE role = 'owner' LIMIT 1"
        ).fetchone()

        if not owner:
            salt = secrets.token_bytes(16)
            bootstrap_password = secrets.token_urlsafe(48)
            connection.execute(
                """
                INSERT INTO users(
                    id, email, display_name, password_salt, password_hash,
                    created_at, role, must_change_password
                )
                VALUES(?, ?, ?, ?, ?, ?, 'owner', 1)
                """,
                (
                    str(uuid.uuid4()),
                    "owner@ethical.world.local",
                    "Owner",
                    salt,
                    _password_digest(bootstrap_password, salt),
                    _utc_now().isoformat(),
                ),
            )


def user_by_email(email: str) -> dict[str, Any] | None:
    normalized = _normalize_email(email)

    with _connect() as connection:
        row = connection.execute(
            """
            SELECT id, email, display_name, created_at, role, must_change_password
            FROM users
            WHERE email = ?
            """,
            (normalized,),
        ).fetchone()

    return _user_dict(row) if row else None


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
                INSERT INTO users(
                    id, email, display_name, password_salt, password_hash,
                    created_at, role, must_change_password
                )
                VALUES(?, ?, ?, ?, ?, ?, 'user', 0)
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
        "role": "user",
        "mustChangePassword": False,
    }


def login_user(email: str, password: str) -> tuple[dict[str, Any], str, str]:
    normalized = _normalize_email(email)

    with _connect() as connection:
        row = connection.execute(
            """
            SELECT id, email, display_name, password_salt, password_hash,
                   created_at, role, must_change_password
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

        token, expires_at = _create_session(connection, row["id"])

    return _user_dict(row), token, expires_at


def bootstrap_owner_login() -> tuple[dict[str, Any], str, str] | None:
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT id, email, display_name, created_at, role, must_change_password
            FROM users
            WHERE role = 'owner' AND must_change_password = 1
            ORDER BY created_at ASC
            LIMIT 1
            """
        ).fetchone()

        if not row:
            return None

        token, expires_at = _create_session(connection, row["id"], days=1)

    return _user_dict(row), token, expires_at


def change_user_password(user_id: str, new_password: str) -> dict[str, Any]:
    if len(new_password) < 12:
        raise AuthStoreError("Nové heslo musí mít alespoň 12 znaků.")

    salt = secrets.token_bytes(16)
    digest = _password_digest(new_password, salt)

    with _connect() as connection:
        connection.execute(
            """
            UPDATE users
            SET password_salt = ?, password_hash = ?, must_change_password = 0
            WHERE id = ?
            """,
            (salt, digest, user_id),
        )

        row = connection.execute(
            """
            SELECT id, email, display_name, created_at, role, must_change_password
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

    if not row:
        raise AuthStoreError("Účet neexistuje.")

    return _user_dict(row)


def user_from_session(token: str) -> dict[str, Any] | None:
    if not token:
        return None

    token_hash = _token_digest(token)
    now = _utc_now().isoformat()

    with _connect() as connection:
        row = connection.execute(
            """
            SELECT u.id, u.email, u.display_name, u.created_at,
                   u.role, u.must_change_password
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (token_hash, now),
        ).fetchone()

    return _user_dict(row) if row else None


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


def save_connector_secret(user_id: str, provider: str, encrypted_payload: bytes) -> None:
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO connector_secrets(user_id, provider, encrypted_payload, updated_at)
            VALUES(?, ?, ?, ?)
            ON CONFLICT(user_id, provider)
            DO UPDATE SET encrypted_payload = excluded.encrypted_payload, updated_at = excluded.updated_at
            """,
            (user_id, provider, encrypted_payload, _utc_now().isoformat()),
        )


def load_connector_secret(user_id: str, provider: str) -> bytes | None:
    with _connect() as connection:
        row = connection.execute(
            "SELECT encrypted_payload FROM connector_secrets WHERE user_id = ? AND provider = ?",
            (user_id, provider),
        ).fetchone()
    return bytes(row["encrypted_payload"]) if row else None


def delete_connector_secret(user_id: str, provider: str) -> None:
    with _connect() as connection:
        connection.execute(
            "DELETE FROM connector_secrets WHERE user_id = ? AND provider = ?",
            (user_id, provider),
        )
