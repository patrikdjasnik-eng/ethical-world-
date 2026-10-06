from __future__ import annotations

import base64
import asyncio
import json
import os
import secrets
import time
from threading import Lock
from pathlib import Path
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet

from .auth_store import (
    delete_connector_secret,
    load_connector_secret,
    save_connector_secret,
)

NOTION_VERSION = "2026-03-11"
_oauth_states: dict[str, tuple[str, float]] = {}
_key_lock = Lock()
_notion_baselines: dict[tuple[str, str], str] = {}
_notion_write_locks: dict[tuple[str, str], asyncio.Lock] = {}


class NotionConnectorError(RuntimeError):
    pass


def _data_dir() -> Path:
    configured = os.getenv("ETHICAL_WORLD_DATA_DIR")
    root = Path(configured).expanduser() if configured else Path.home() / ".ethical-world"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _load_fernet() -> Fernet:
    configured = os.getenv("ETHICAL_WORLD_CONNECTOR_KEY", "").strip()
    if configured:
        return Fernet(configured.encode("ascii"))

    key_path = _data_dir() / "connector.key"
    if key_path.exists():
        return Fernet(key_path.read_bytes().strip())

    key = Fernet.generate_key()
    try:
        descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as output:
            output.write(key)
    except FileExistsError:
        return Fernet(key_path.read_bytes().strip())
    try:
        os.chmod(key_path, 0o600)
    except OSError:
        pass
    return Fernet(key)


def _fernet() -> Fernet:
    with _key_lock:
        return _load_fernet()


def config() -> dict[str, str | bool]:
    client_id = os.getenv("ETHICAL_NOTION_CLIENT_ID", "").strip()
    client_secret = os.getenv("ETHICAL_NOTION_CLIENT_SECRET", "").strip()
    redirect_uri = os.getenv(
        "ETHICAL_NOTION_REDIRECT_URI",
        "http://127.0.0.1:8787/api/connectors/notion/callback",
    ).strip()
    return {
        "configured": bool(client_id and client_secret and redirect_uri),
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }


def start_oauth(user_id: str) -> str:
    settings = config()
    if not settings["configured"]:
        raise NotionConnectorError("Notion OAuth není nakonfigurovaný.")

    now = time.monotonic()
    for pending, (_, created) in list(_oauth_states.items()):
        if created < now - 600:
            _oauth_states.pop(pending, None)
    if sum(owner == user_id for owner, _ in _oauth_states.values()) >= 5:
        raise NotionConnectorError("Příliš mnoho otevřených Notion autorizací.")
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = (user_id, now)
    query = urlencode({
        "client_id": settings["client_id"],
        "response_type": "code",
        "owner": "user",
        "redirect_uri": settings["redirect_uri"],
        "state": state,
    })
    return "https://api.notion.com/v1/oauth/authorize?" + query


async def finish_oauth(code: str, state: str) -> dict[str, str | None]:
    pending = _oauth_states.pop(state, None)
    if not pending or pending[1] < time.monotonic() - 600:
        raise NotionConnectorError("Neplatný nebo expirovaný OAuth state.")
    user_id = pending[0]

    settings = config()
    basic = base64.b64encode(
        f'{settings["client_id"]}:{settings["client_secret"]}'.encode("utf-8")
    ).decode("ascii")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.notion.com/v1/oauth/token",
            headers={
                "Authorization": "Basic " + basic,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings["redirect_uri"],
            },
        )

    if not response.is_success:
        raise NotionConnectorError("Notion OAuth token exchange selhal.")

    payload = response.json()
    save_connector_secret(
        user_id,
        "notion",
        _fernet().encrypt(json.dumps(payload).encode("utf-8")),
    )
    return {
        "workspaceId": payload.get("workspace_id"),
        "workspaceName": payload.get("workspace_name"),
    }


def _payload(user_id: str) -> dict:
    encrypted = load_connector_secret(user_id, "notion")
    if not encrypted:
        raise NotionConnectorError("Notion není připojený.")

    try:
        return json.loads(_fernet().decrypt(encrypted).decode("utf-8"))
    except Exception as error:
        raise NotionConnectorError("Notion token se nepodařilo dešifrovat.") from error


def status(user_id: str) -> dict:
    settings = config()
    try:
        payload = _payload(user_id)
    except NotionConnectorError:
        payload = {}

    return {
        "configured": bool(settings["configured"]),
        "connected": bool(payload.get("access_token")),
        "workspaceName": payload.get("workspace_name"),
        "workspaceId": payload.get("workspace_id"),
    }


def disconnect(user_id: str) -> None:
    delete_connector_secret(user_id, "notion")


async def _request(
    user_id: str,
    method: str,
    path: str,
    json_body: dict | None = None,
) -> dict:
    payload = _payload(user_id)
    token = payload.get("access_token")
    if not token:
        raise NotionConnectorError("Notion access token chybí.")

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.request(
            method,
            "https://api.notion.com" + path,
            headers={
                "Authorization": "Bearer " + token,
                "Notion-Version": NOTION_VERSION,
                "Content-Type": "application/json",
            },
            json=json_body,
        )

    if response.status_code == 401:
        raise NotionConnectorError("Notion session vypršela. Připoj workspace znovu.")

    if not response.is_success:
        detail = None
        try:
            detail = response.json().get("message")
        except Exception:
            pass
        raise NotionConnectorError(
            detail or f"Notion API chyba ({response.status_code})."
        )

    return response.json()


def _page_title(page: dict) -> str:
    for prop in (page.get("properties") or {}).values():
        if isinstance(prop, dict) and prop.get("type") == "title":
            title = prop.get("title") or []
            text = "".join(
                item.get("plain_text", "")
                for item in title
                if isinstance(item, dict)
            ).strip()
            if text:
                return text
    return "Notion page"


async def list_pages(user_id: str) -> list[dict[str, str]]:
    data = await _request(
        user_id,
        "POST",
        "/v1/search",
        {"page_size": 100, "filter": {"property": "object", "value": "page"}},
    )
    pages = []

    for item in data.get("results", []):
        if item.get("object") != "page":
            continue
        pages.append({
            "id": item["id"],
            "title": _page_title(item),
            "url": item.get("url", ""),
        })

    return pages


async def read_markdown(user_id: str, page_id: str) -> dict:
    page = await _request(user_id, "GET", f"/v1/pages/{page_id}")
    markdown = await _request(user_id, "GET", f"/v1/pages/{page_id}/markdown")
    if not markdown.get("truncated"):
        _notion_baselines[(user_id, page_id)] = markdown.get("markdown", "")
    return {
        "pageId": page_id,
        "title": _page_title(page),
        "markdown": markdown.get("markdown", ""),
        "truncated": bool(markdown.get("truncated")),
    }


async def _write_markdown(user_id: str, page_id: str, markdown: str) -> None:
    if len(markdown) > 200_000:
        raise NotionConnectorError("Markdown je příliš velký.")

    baseline = _notion_baselines.get((user_id, page_id))
    if baseline is None:
        raise NotionConnectorError("Nejdřív stránku znovu importuj; chybí verze pro kontrolu konfliktu.")
    current = await _request(user_id, "GET", f"/v1/pages/{page_id}/markdown")
    if current.get("truncated") or current.get("markdown", "") != baseline:
        raise NotionConnectorError("Konflikt: Notion stránka se od importu změnila.")
    await _request(
        user_id,
        "PATCH",
        f"/v1/pages/{page_id}/markdown",
        {
            "type": "replace_content",
            "replace_content": {"content": markdown},
        },
    )
    _notion_baselines[(user_id, page_id)] = markdown

async def write_markdown(user_id: str, page_id: str, markdown: str) -> None:
    key = (user_id, page_id)
    lock = _notion_write_locks.setdefault(key, asyncio.Lock())
    async with lock:
        await _write_markdown(user_id, page_id, markdown)
