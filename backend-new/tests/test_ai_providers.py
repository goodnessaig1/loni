"""AI_PROVIDER in .env picks the LLM; Gemini is the default."""
import pytest

from app.core.config import settings
from app.modules.ai_chat import providers


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    for k, v in {"AI_PROVIDER": "", "AI_ENVIRONMENT": "", "AI_MODEL": "", "GEMINI_API_KEY": "g-key",
                 "GEMINI_MODEL": "gemini-3.8-flash", "GEMINI_REASONING_EFFORT": "low",
                 "GEMINI_FAST_MODEL": "gemini-3.5-flash-lite"}.items():
        monkeypatch.setattr(settings, k, v)
    providers.get_provider.cache_clear()
    yield
    providers.get_provider.cache_clear()


def test_gemini_is_the_default():
    p = providers.get_provider()
    assert p.name == "gemini" and p.model == "gemini-3.8-flash"
    assert str(p.client.base_url) == providers.GEMINI_BASE_URL
    assert p.extra == {"reasoning_effort": "low"} and p.short_max_tokens >= 512
    assert p.classifier_model == "gemini-3.5-flash-lite"


@pytest.mark.parametrize("name,model", [("openai", "gpt-4o-mini"), ("abacus", "deepseek-v4-flash"), ("ollama", "qwen3:8b")])
def test_switch_provider_from_env(monkeypatch, name, model):
    monkeypatch.setattr(settings, "AI_PROVIDER", name)
    p = providers.get_provider()
    assert p.name == name and p.model == model and p.extra == {}


def test_model_override_and_legacy_setting(monkeypatch):
    monkeypatch.setattr(settings, "AI_ENVIRONMENT", "production")      # old .env: still means Abacus
    assert providers.get_provider().name == "abacus"
    providers.get_provider.cache_clear()
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")              # explicit choice wins
    monkeypatch.setattr(settings, "AI_MODEL", "gemini-2.5-flash")
    assert providers.get_provider().model == "gemini-2.5-flash"


def test_unknown_provider_is_a_clear_error(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "skynet")
    with pytest.raises(ValueError, match="gemini, openai, abacus or ollama"):
        providers.get_provider()
    assert "Unknown AI_PROVIDER" in providers.describe()


async def test_a_rejected_reasoning_level_is_retried_without_it(monkeypatch):
    monkeypatch.setattr(providers, "_reasoning_rejected", False)
    calls = []

    class Completions:
        async def create(self, **kw):
            calls.append(kw)
            if "reasoning_effort" in kw:
                raise RuntimeError("400 - Thinking level MINIMAL is not supported for this model.")
            return "ok"

    class Client:
        class chat:
            completions = Completions()

    assert await providers.create_chat(Client, model="m", messages=[]) == "ok"
    assert [("reasoning_effort" in c) for c in calls] == [True, False]
    calls.clear()
    assert await providers.create_chat(Client, model="m", messages=[]) == "ok"   # no longer sent
    assert [("reasoning_effort" in c) for c in calls] == [False]


pytestmark = pytest.mark.anyio
