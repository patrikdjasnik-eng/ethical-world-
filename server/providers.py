from __future__ import annotations

from typing import Any

import httpx


class ProviderError(RuntimeError):
    pass


def _openai_base_url(base_url: str) -> str:
    normalized_base = base_url.rstrip("/")
    return normalized_base if normalized_base.endswith("/v1") else f"{normalized_base}/v1"


async def check_ollama(base_url: str) -> list[str]:
    endpoint = f"{base_url.rstrip('/')}/api/tags"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(endpoint)
            response.raise_for_status()
    except httpx.HTTPError:
        return []

    payload: dict[str, Any] = response.json()
    models = payload.get("models", [])

    return [
        model["name"]
        for model in models
        if isinstance(model, dict) and isinstance(model.get("name"), str)
    ]


async def check_openai_compatible(base_url: str, api_key: str | None = None) -> list[str]:
    endpoint = f"{_openai_base_url(base_url)}/models"
    headers: dict[str, str] = {}

    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(endpoint, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError:
        return []

    payload: dict[str, Any] = response.json()
    data = payload.get("data", [])

    return [
        model["id"]
        for model in data
        if isinstance(model, dict) and isinstance(model.get("id"), str)
    ]


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
    endpoint = f"{_openai_base_url(base_url)}/chat/completions"
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
