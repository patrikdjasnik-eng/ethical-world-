from __future__ import annotations

from typing import Any

import httpx


class ProviderError(RuntimeError):
    pass


async def chat_ollama(
    base_url: str,
    model: str,
    messages: list[dict[str, str]],
) -> str:
    endpoint = f"{base_url.rstrip('/')}/api/chat"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                endpoint,
                json={"model": model, "messages": messages, "stream": False},
            )
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise ProviderError(f"Ollama request failed: {error}") from error

    payload: dict[str, Any] = response.json()
    content = payload.get("message", {}).get("content")

    if not isinstance(content, str) or not content.strip():
        raise ProviderError("Ollama returned an empty response")

    return content


async def chat_openai_compatible(
    base_url: str,
    model: str,
    messages: list[dict[str, str]],
    api_key: str | None,
) -> str:
    normalized_base = base_url.rstrip('/')
    endpoint = (
        f"{normalized_base}/chat/completions"
        if normalized_base.endswith("/v1")
        else f"{normalized_base}/v1/chat/completions"
    )
    headers = {"Content-Type": "application/json"}

    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                endpoint,
                headers=headers,
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise ProviderError(f"OpenAI-compatible request failed: {error}") from error

    payload: dict[str, Any] = response.json()

    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise ProviderError("Provider returned an unexpected response shape") from error

    if not isinstance(content, str) or not content.strip():
        raise ProviderError("Provider returned an empty response")

    return content
