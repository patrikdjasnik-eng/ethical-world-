from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from collections import deque
from pathlib import Path
from threading import Lock

from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException

runtime_token = os.getenv("ETHICAL_WORLD_RUNTIME_TOKEN") or secrets.token_urlsafe(48)
bootstrap_lock = Lock()
bootstrap_claimed = False


def health_proof(challenge: str) -> str:
  return hmac.new(runtime_token.encode(), challenge.encode(), hashlib.sha256).hexdigest()


def write_browser_runtime() -> None:
  if os.getenv("ETHICAL_WORLD_RUNTIME_TOKEN"):
    return
  directory = Path(os.getenv("ETHICAL_WORLD_DATA_DIR", str(Path.home() / ".ethical-world"))).expanduser()
  directory.mkdir(parents=True, exist_ok=True)
  target = directory / "runtime.json"
  temporary = directory / ("runtime-" + secrets.token_hex(8) + ".tmp")
  descriptor = {"port": int(os.getenv("ETHICAL_WORLD_PORT", "8787")), "token": runtime_token}
  fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
  with os.fdopen(fd, "w") as output:
    json.dump(descriptor, output)
  os.replace(temporary, target)


class RuntimeGuard:
  def __init__(self, app):
    self.app = app
    self.attempts: dict[str, deque[float]] = {}
    self.active_chats = 0

  async def __call__(self, scope, receive, send):
    if scope["type"] != "http":
      return await self.app(scope, receive, send)
    path = scope.get("path", "")
    headers = dict(scope.get("headers", []))
    protected = path.startswith("/api/") and path != "/api/connectors/notion/callback"
    if protected and scope["method"] != "OPTIONS":
      supplied = headers.get(b"x-ethical-capability", b"").decode("utf-8", "replace")
      if not hmac.compare_digest(supplied, runtime_token):
        return await JSONResponse({"detail": "Runtime capability required."}, status_code=401)(scope, receive, send)
      if path.startswith("/api/auth/") and path not in ("/api/auth/me", "/api/auth/logout"):
        if len(self.attempts) > 1024:
          self.attempts = {key: value for key, value in self.attempts.items() if value and value[-1] > time.monotonic() - 60}
        now = time.monotonic()
        identity = (scope.get("client") or ("local", 0))[0]
        bucket = self.attempts.setdefault(identity, deque())
        while bucket and bucket[0] < now - 60:
          bucket.popleft()
        if len(bucket) >= 40:
          return await JSONResponse({"detail": "Příliš mnoho auth požadavků. Zkus to za minutu."}, status_code=429, headers={"Retry-After": "60"})(scope, receive, send)
        bucket.append(now)
    is_chat = path in ("/api/chat", "/api/chat/stream")
    if is_chat and self.active_chats >= 2:
      return await JSONResponse({"detail": "Model již zpracovává dva požadavky."}, status_code=429)(scope, receive, send)
    size = 0
    started = False
    async def bounded_receive():
      nonlocal size
      event = await receive()
      size += len(event.get("body", b""))
      if size > 2 * 1024 * 1024:
        raise BodyTooLarge()
      return event
    async def tracked_send(event):
      nonlocal started
      if event["type"] == "http.response.start":
        started = True
      await send(event)
    if is_chat:
      self.active_chats += 1
    try:
      await self.app(scope, bounded_receive, tracked_send)
    except BodyTooLarge:
      if not started:
        await JSONResponse({"detail": "Request body is too large."}, status_code=413)(scope, receive, send)
    finally:
      if is_chat:
        self.active_chats -= 1


class BodyTooLarge(HTTPException):
  def __init__(self):
    super().__init__(status_code=413, detail="Request body is too large.")
