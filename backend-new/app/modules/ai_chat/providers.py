"""
Which LLM answers Loni's chats, chosen in .env with AI_PROVIDER:

    gemini  (default)  Google Gemini, via its OpenAI-compatible endpoint      GEMINI_API_KEY, GEMINI_MODEL
    openai             OpenAI                                                  OPENAI_API_KEY, OPENAI_MODEL
    abacus             Abacus RouteLLM                                         ABACUS_API_KEY, ABACUS_MODEL
    ollama             a local Ollama server (offline development)             OLLAMA_BASE_URL, OLLAMA_MODEL

All four speak the OpenAI chat-completions API, so the rest of the AI code is the same whichever is used.
The older AI_ENVIRONMENT setting (production=abacus, openai, local=ollama) still works when AI_PROVIDER is unset.
"""
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Dict

from openai import AsyncOpenAI

from app.core.config import settings

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
ABACUS_BASE_URL = "https://routellm.abacus.ai/v1"
_LEGACY = {"production": "abacus", "openai": "openai", "local": "ollama", "gemini": "gemini"}


@dataclass(frozen=True)
class Provider:
    name: str
    client: AsyncOpenAI
    model: str
    # Extra arguments for every chat call (e.g. Gemini's reasoning effort).
    extra: Dict[str, Any] = field(default_factory=dict)
    # Output budget for short structured calls (the urgency classifier). Thinking models spend part of the
    # output budget on reasoning, so they need more room than the ~40 tokens the answer itself takes.
    short_max_tokens: int = 40
    # Model for quick structured calls (the urgency classifier); the main model when a provider has no faster one.
    fast_model: str = ""

    @property
    def classifier_model(self) -> str:
        return self.fast_model or self.model


def provider_name() -> str:
    explicit = (settings.AI_PROVIDER or "").strip().lower()
    if explicit:
        return explicit
    legacy = (settings.AI_ENVIRONMENT or "").strip().lower()
    return _LEGACY.get(legacy, "gemini")


@lru_cache(maxsize=1)
def get_provider() -> Provider:
    """One client per process (reused for every chat), built from .env."""
    name = provider_name()
    if name == "gemini":
        extra = {"reasoning_effort": settings.GEMINI_REASONING_EFFORT} if settings.GEMINI_REASONING_EFFORT else {}
        return Provider("gemini", AsyncOpenAI(base_url=GEMINI_BASE_URL, api_key=settings.GEMINI_API_KEY or "missing"),
                        settings.AI_MODEL or settings.GEMINI_MODEL, extra, short_max_tokens=1024,
                        fast_model=settings.GEMINI_FAST_MODEL)
    if name == "openai":
        return Provider("openai", AsyncOpenAI(api_key=settings.OPENAI_API_KEY or "missing"),
                        settings.AI_MODEL or settings.OPENAI_MODEL)
    if name == "abacus":
        return Provider("abacus", AsyncOpenAI(base_url=ABACUS_BASE_URL, api_key=settings.ABACUS_API_KEY or "missing"),
                        settings.AI_MODEL or settings.ABACUS_MODEL)
    if name == "ollama":
        return Provider("ollama", AsyncOpenAI(base_url=settings.OLLAMA_BASE_URL, api_key="ollama"),
                        settings.AI_MODEL or settings.OLLAMA_MODEL, short_max_tokens=256)
    raise ValueError(f"Unknown AI_PROVIDER '{name}'. Use gemini, openai, abacus or ollama.")


def describe() -> str:
    """For the startup log: which provider/model, and whether its key is set (never the key)."""
    try:
        p = get_provider()
    except ValueError as e:
        return str(e)
    key = {"gemini": settings.GEMINI_API_KEY, "openai": settings.OPENAI_API_KEY,
           "abacus": settings.ABACUS_API_KEY, "ollama": "n/a"}.get(p.name)
    fast = f", classifier {p.classifier_model}" if p.classifier_model != p.model else ""
    return f"AI provider: {p.name} ({p.model}{fast}){'' if key else ' - WARNING: API key not set'}"


# Set once a model has rejected the reasoning setting; later calls in this process leave it out.
_reasoning_rejected = False


def _is_reasoning_rejection(err: Exception) -> bool:
    msg = str(err).lower()
    return "thinking" in msg or "reasoning" in msg


async def create_chat(client, **kwargs):
    """chat.completions.create with the provider's extra arguments. If the model refuses the reasoning
    level (it differs between Gemini models), retry once without it and stop sending it."""
    global _reasoning_rejected
    extra = {} if _reasoning_rejected else dict(get_provider().extra)
    try:
        return await client.chat.completions.create(**kwargs, **extra)
    except Exception as e:
        if extra.pop("reasoning_effort", None) is None or not _is_reasoning_rejection(e):
            raise
        _reasoning_rejected = True
        print(f"AI provider rejected the reasoning setting; continuing without it ({type(e).__name__})")
        return await client.chat.completions.create(**kwargs, **extra)
