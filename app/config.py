"""Central settings, loaded once from the environment / .env."""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://floatchat_ro:floatchat_ro@localhost:5432/floatchat"
)
DATABASE_URL_ADMIN = os.getenv("DATABASE_URL_ADMIN", "")

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "none").lower()
LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-5")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
# OpenAI-compatible base URL — lets the "openai" provider target any
# compatible service (Groq, OpenRouter, Together, a local server, …).
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
# Grok / xAI (also OpenAI-compatible).
XAI_API_KEY = os.getenv("XAI_API_KEY", "") or os.getenv("GROK_API_KEY", "")
XAI_BASE_URL = os.getenv("XAI_BASE_URL", "https://api.x.ai/v1")
# Groq (fast, free, OpenAI-compatible — NOT the same as xAI's Grok).
# Falls back to the other key vars so an existing key is picked up wherever it sits.
GROQ_API_KEY = (
    os.getenv("GROQ_API_KEY", "")
    or os.getenv("XAI_API_KEY", "")
    or os.getenv("GROK_API_KEY", "")
    or os.getenv("OPENAI_API_KEY", "")
)
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

RAG_TOP_K = int(os.getenv("RAG_TOP_K", "6"))
SQL_STATEMENT_TIMEOUT_MS = int(os.getenv("SQL_STATEMENT_TIMEOUT_MS", "5000"))
MAX_ROWS = int(os.getenv("MAX_ROWS", "500"))
DEV_MODE = os.getenv("DEV_MODE", "false").lower() in ("1", "true", "yes")
