from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import socket
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx


class ProviderError(RuntimeError):
  pass


async def provider_endpoint(base_url: str, suffix: str) -> tuple[str, dict[str, str], dict[str, Any]]:
  try:
    url = urlsplit(base_url)
    host = url.hostname or ""
    port = url.port or (443 if url.scheme == "https" else 80)
  except ValueError as error:
    raise ProviderError("Neplatná provider URL.") from error
  if url.scheme not in ("http", "https") or not host or url.username or url.password or url.query or url.fragment:
    raise ProviderError("Provider vyžaduje HTTP(S) URL bez credentials, query a fragmentu.")
  loopback_hosts = {"localhost", "127.0.0.1", "::1"}
  allowed = {item.strip().lower() for item in os.getenv("ETHICAL_WORLD_PROVIDER_HOSTS", "api.openai.com,api.groq.com,openrouter.ai").split(",") if item.strip()}
  if host not in loopback_hosts and (url.scheme != "https" or host.lower() not in allowed):
    raise ProviderError("Vzdálený provider vyžaduje HTTPS a povolený host v ETHICAL_WORLD_PROVIDER_HOSTS.")
  try:
    addresses = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
  except OSError as error:
    raise ProviderError("Provider hostname nelze přeložit.") from error
  if not addresses:
    raise ProviderError("Provider nemá platnou adresu.")
  parsed = [ipaddress.ip_address(item[4][0]) for item in addresses]
  if host in loopback_hosts:
    if any(not address.is_loopback for address in parsed):
      raise ProviderError("Lokální provider musí být na loopback adrese.")
  elif any(not address.is_global for address in parsed):
    raise ProviderError("Vzdálený provider nesmí mířit na privátní ani metadata adresu.")
  address = str(parsed[0])
  authority = f"[{address}]:{port}" if ":" in address else f"{address}:{port}"
  # Spojení používá ověřenou IP; SNI a Host zachovají identitu HTTPS providera.
  endpoint = urlunsplit((url.scheme, authority, url.path.rstrip("/") + suffix, "", ""))
  host_header = f"[{host}]" if ":" in host else host
  if port != (443 if url.scheme == "https" else 80):
    host_header += f":{port}"
  return endpoint, {"Host": host_header}, {"sni_hostname": host.encode("ascii")}


def _openai_base_url(base_url: str) -> str:
  normalized = base_url.rstrip("/")
  return normalized if normalized.endswith("/v1") else normalized + "/v1"


async def request_json(base_url: str, suffix: str, *, body: dict | None = None, api_key: str | None = None, timeout: float = 3.0) -> dict:
  endpoint, headers, extensions = await provider_endpoint(base_url, suffix)
  if api_key:
    headers["Authorization"] = "Bearer " + api_key
  try:
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, trust_env=False) as client:
      async with client.stream("GET" if body is None else "POST", endpoint, headers=headers, json=body, extensions=extensions) as response:
        response.raise_for_status()
        if response.is_redirect:
          raise ProviderError("Provider redirects nejsou povolené.")
        chunks = bytearray()
        async for chunk in response.aiter_bytes():
          chunks.extend(chunk)
          if len(chunks) > 2 * 1024 * 1024:
            raise ProviderError("Provider response je příliš velká.")
    payload = json.loads(chunks)
    if not isinstance(payload, dict):
      raise ProviderError("Provider vrátil neplatný JSON objekt.")
    return payload
  except (httpx.HTTPError, ValueError, UnicodeError) as error:
    raise ProviderError("Provider request selhal nebo vrátil neplatný JSON.") from error


async def check_ollama(base_url: str) -> list[str]:
  try:
    payload = await request_json(base_url, "/api/tags")
    models = payload.get("models", [])
    if not isinstance(models, list):
      return []
    return [model["name"] for model in models if isinstance(model, dict) and isinstance(model.get("name"), str)][:500]
  except ProviderError:
    return []


async def check_openai_compatible(base_url: str, api_key: str | None = None) -> list[str]:
  try:
    payload = await request_json(_openai_base_url(base_url), "/models", api_key=api_key)
    models = payload.get("data", [])
    if not isinstance(models, list):
      return []
    return [model["id"] for model in models if isinstance(model, dict) and isinstance(model.get("id"), str)][:500]
  except ProviderError:
    return []


async def chat_ollama(base_url: str, model: str, messages: list[dict[str, str]], max_output_tokens: int = 2048) -> str:
  payload = await request_json(base_url, "/api/chat", timeout=240, body={
    "model": model, "messages": messages, "stream": False,
    "options": {"temperature": 0.25, "num_predict": max_output_tokens}
  })
  message = payload.get("message")
  content = message.get("content") if isinstance(message, dict) else None
  if not isinstance(content, str) or not content.strip():
    raise ProviderError("Ollama vrátila prázdnou nebo neplatnou odpověď.")
  return content


async def chat_openai_compatible(base_url: str, model: str, messages: list[dict[str, str]], api_key: str | None, max_output_tokens: int = 2048) -> str:
  payload = await request_json(_openai_base_url(base_url), "/chat/completions", api_key=api_key, timeout=240, body={
    "model": model, "messages": messages, "temperature": 0.25, "max_tokens": max_output_tokens
  })
  try:
    content = payload["choices"][0]["message"]["content"]
  except (KeyError, IndexError, TypeError) as error:
    raise ProviderError("Provider vrátil neplatný tvar odpovědi.") from error
  if not isinstance(content, str) or not content.strip():
    raise ProviderError("Provider vrátil prázdnou odpověď.")
  return content
