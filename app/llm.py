"""Thin LLM client supporting Anthropic, OpenAI, and Ollama over plain HTTP.

If LLM_PROVIDER is "none" (or the key is missing) callers get LLMUnavailable
and fall back to the built-in rule-based NL→SQL engine, so the demo never
depends on a model being reachable.
"""
from __future__ import annotations

import httpx

from app import config


class LLMUnavailable(Exception):
    pass


def reasoning_extra() -> dict | None:
    """Low reasoning effort for reasoning-style models (gpt-oss, o-series) —
    keeps short internal calls fast and un-truncated. None for other models."""
    model = config.LLM_MODEL.lower()
    if any(tag in model for tag in ("gpt-oss", "o1", "o3", "o4", "reason")):
        return {"reasoning_effort": "low"}
    return None


def chat(system: str, user: str, max_tokens: int = 800, extra: dict | None = None) -> str:
    """Send a system+user turn and return the assistant text.

    `extra` merges into the request body for OpenAI-compatible providers
    (e.g. {"reasoning_effort": "low"} for gpt-oss / o-series models).
    """
    provider = config.LLM_PROVIDER
    if provider == "anthropic":
        if not config.ANTHROPIC_API_KEY:
            raise LLMUnavailable("ANTHROPIC_API_KEY not set")
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": config.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": config.LLM_MODEL,
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
            timeout=60,
        )
        r.raise_for_status()
        return r.json()["content"][0]["text"]

    # OpenAI-compatible providers: openai, grok/xai, groq.
    if provider in ("openai", "grok", "xai", "groq"):
        if provider == "groq":
            key, base = config.GROQ_API_KEY, config.GROQ_BASE_URL
            key_name = "GROQ_API_KEY"
        elif provider in ("grok", "xai"):
            key, base = config.XAI_API_KEY, config.XAI_BASE_URL
            key_name = "XAI_API_KEY / GROK_API_KEY"
        else:
            key, base = config.OPENAI_API_KEY, config.OPENAI_BASE_URL
            key_name = "OPENAI_API_KEY"
        if not key:
            raise LLMUnavailable(f"{key_name} not set")
        body = {
            "model": config.LLM_MODEL,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if extra:
            body.update(extra)
        r = httpx.post(
            f"{base.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json=body,
            timeout=60,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"] or ""

    if provider == "ollama":
        try:
            r = httpx.post(
                f"{config.OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": config.LLM_MODEL,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
                timeout=120,
            )
            r.raise_for_status()
            return r.json()["message"]["content"]
        except httpx.HTTPError as e:
            raise LLMUnavailable(f"Ollama unreachable: {e}") from e

    raise LLMUnavailable(f"no usable LLM provider ({provider})")
