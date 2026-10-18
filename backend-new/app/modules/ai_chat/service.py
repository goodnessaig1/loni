import uuid
import asyncio
from datetime import datetime, timezone
from openai import AsyncOpenAI
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.mongo_db import get_mongo_db
from app.modules.ai_chat import messages as safe_messages
from app.modules.ai_chat import classifier, lookup, safety
from app.modules.ai_chat.context import profile_lines, stage_context, stage_text
from app.modules.ai_chat.prompts import (
    CHECKIN_DIRECTIVE, CHECKIN_INTENSIVE_EXTRA, CONTEXT_TEMPLATE, EMOTIONAL_FLAG_DIRECTIVE, INFO_ONLY_DIRECTIVE,
    LOOKUP_NEEDS_PLACE, LOOKUP_NO_RESULTS, LOOKUP_TEMPLATE, LOOKUP_UNAVAILABLE, MEMORY_TEMPLATE, URGENT_DIRECTIVE,
    build_system_prompt,
)
from app.modules.ai_chat.triage import ANSWER_PATTERNS, StageContext, TriageResult, Urgency, triage

# Default model configuration
DEFAULT_MODEL = "gpt-3.5-turbo"

async def generate_and_update_title(session_id: str, user_id: str, content: str, client, model: str):
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Generate a concise title (maximum 4 words) summarizing the user's message. Output ONLY the title text, without quotes, punctuation, or any other formatting."},
                {"role": "user", "content": content}
            ],
            temperature=0.3,
            max_tokens=15,
            stream=False
        )
        title = response.choices[0].message.content.strip()
        if title.startswith('"') and title.endswith('"'):
            title = title[1:-1]
            
        if title:
            await update_chat_session_title(session_id, user_id, title)
    except Exception as e:
        print(f"Error generating title: {e}")


def _sse(payload: dict) -> str:
    import json
    return f"data: {json.dumps(payload)}\n\n"


def _meta(result: TriageResult) -> dict:
    actions = []
    for a in result.actions:
        a = dict(a)
        if a["type"] == "call_emergency":
            a["phone"] = settings.EMERGENCY_PHONE
        actions.append(a)
    return {"urgency": result.urgency.value, "domain": result.domain, "answer_type": result.answer_type, "actions": actions}


def build_llm_messages(history: list, user, stage: StageContext, result: TriageResult, origin: dict | None = None,
                       memory_lines: list | None = None, lookup_block: str | None = None) -> list:
    """System prompt, her profile context, the conversation, and (last, so it carries the most weight) the
    directive for this particular turn."""
    msgs = [
        {"role": "system", "content": build_system_prompt(settings.EMERGENCY_PHONE)},
        {"role": "system", "content": CONTEXT_TEMPLATE.format(lines="\n".join(profile_lines(user, stage)))},
    ]
    if memory_lines:
        msgs.append({"role": "system", "content": MEMORY_TEMPLATE.format(lines="\n".join(memory_lines))})
    msgs += [{"role": m["role"], "content": m["content"]} for m in history]
    if lookup_block:
        msgs.append({"role": "system", "content": lookup_block})

    directives = []
    if result.urgency == Urgency.urgent:
        directives.append(URGENT_DIRECTIVE)
    if result.info_only:
        directives.append(INFO_ONLY_DIRECTIVE)
    if "severe_low_mood" in result.rule_ids:
        directives.append(EMOTIONAL_FLAG_DIRECTIVE)
    if origin and origin.get("type") == "checkin":
        directives.append(CHECKIN_DIRECTIVE.format(
            category=origin.get("category", "general"), level=origin.get("level", "standard"), text=origin.get("text", ""),
            extra=CHECKIN_INTENSIVE_EXTRA if origin.get("level") == "intensive" else ""))
    pattern = ANSWER_PATTERNS.get(result.answer_type, "")
    if pattern and result.urgency != Urgency.urgent:
        directives.append("RESPONSE PATTERN: " + pattern)
    if directives:
        msgs.append({"role": "system", "content": "\n\n".join(directives)})
    return msgs


async def _record_safety_event(db, user_id: str, session_id: str, result: TriageResult, llm_called: bool, notes: list):
    """What was decided and why. Never the message text: health details stay out of the audit trail."""
    try:
        high_risk = result.urgency in (Urgency.emergency, Urgency.urgent) or result.domain == "mental_health"
        await db["ai_safety_events"].insert_one({
            "id": str(uuid.uuid4()), "needs_review": high_risk, "reviewed_at": None, "reviewed_by": None, "review_note": None,
            "user_id": user_id, "session_id": session_id, "urgency": result.urgency.value,
            "domain": result.domain, "answer_type": result.answer_type, "rule_ids": result.rule_ids,
            "info_only": result.info_only, "llm_called": llm_called, "validator_notes": len(notes),
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as e:  # auditing must never break a chat
        print(f"Could not record safety event: {e}")


def _client_and_model():
    if settings.AI_ENVIRONMENT == "local":
        return AsyncOpenAI(base_url=settings.OLLAMA_BASE_URL, api_key="ollama"), "qwen3:8b"
    if settings.AI_ENVIRONMENT == "openai":
        return AsyncOpenAI(api_key=settings.OPENAI_API_KEY), DEFAULT_MODEL
    return AsyncOpenAI(base_url="https://routellm.abacus.ai/v1", api_key=settings.ABACUS_API_KEY), "deepseek-v4-flash"


async def _learn_and_recall(user_id: str, text: str) -> list:
    """Note what this message tells us about her day, and return short lines about the last week for the AI.
    Silent on any failure and does nothing if she turned memory off."""
    try:
        from app.modules.checkins import memory as mem, service as cs
        async with AsyncSessionLocal() as db:
            prefs = await cs.get_preferences(db, user_id)
            if not prefs.remember:
                return []
            today = cs.policy.local_now(datetime.now(timezone.utc), cs.policy.safe_zone(prefs.timezone, settings.CHECKIN_DEFAULT_TZ)).date()
            await mem.remember(db, user_id, text, today)
            return mem.context_lines(await mem.recent_notes(db, user_id, today, days=7), today)
    except Exception as e:
        print(f"Could not use memory: {e}")
        return []


async def _save_assistant(db, session_id: str, content: str, meta: dict):
    await db["messages"].insert_one({
        "id": str(uuid.uuid4()), "session_id": session_id, "role": "assistant", "content": content,
        "meta": meta, "created_at": datetime.now(timezone.utc),
    })


async def stream_chat_message(session_id: str, user_id: str, content: str, user=None):
    db = get_mongo_db()
    now = datetime.now(timezone.utc)

    # 1. Save user message to DB
    await db["messages"].insert_one({
        "id": str(uuid.uuid4()), "session_id": session_id, "role": "user", "content": content, "created_at": now,
    })
    await db["sessions"].update_one({"id": session_id}, {"$set": {"updated_at": now}})

    # 2. Triage FIRST, from her words and her profile only. The model never gets a vote on emergencies.
    stage = stage_context(user)
    result = triage(content, stage)
    client, model = _client_and_model()

    # 2b. Second opinion from a small model on anything the rules did not already call an emergency. It can only
    #     raise urgency and fails open (rules only) if it is slow or broken.
    if settings.AI_TRIAGE_CLASSIFIER and result.urgency != Urgency.emergency:
        recent = (await get_session_messages(session_id))[-5:]
        result = classifier.merge(result, await classifier.classify(client, model, content, stage, recent), content)
    meta = _meta(result)
    yield _sse({"meta": meta})

    # 2c. If this chat began from a check-in notification, remember that, and count this as her answering it.
    sessions = await db["sessions"].find({"id": session_id}).to_list(length=1)
    origin = (sessions[0].get("origin") if sessions else None)
    if origin and origin.get("type") == "checkin":
        try:
            from app.modules.checkins.service import record_response
            await record_response(AsyncSessionLocal, session_id, user_id, content, result.urgency.value)
        except Exception as e:  # tracking must never break a chat
            print(f"Could not record check-in response: {e}")

    # 3. Emergency: fixed message now, model not called. Nothing waits on a network round trip.
    if result.urgency == Urgency.emergency:
        text = safe_messages.emergency_message(result.template, stage_text(stage), settings.EMERGENCY_PHONE)
        yield _sse({"content": text})
        yield "data: [DONE]\n\n"
        await _save_assistant(db, session_id, text, meta)
        await _record_safety_event(db, user_id, session_id, result, False, [])
        return

    # 3c. Facility questions (hours, phone, address) are answered from a live lookup, never from the model's memory.
    lookup_result, lookup_block = None, None
    if lookup.is_facility_lookup(content):
        if lookup.needs_place(content):
            lookup_block = LOOKUP_NEEDS_PLACE
        elif not lookup.configured():
            lookup_block = LOOKUP_UNAVAILABLE
        else:
            lookup_result = await lookup.lookup(content)
            lookup_block = (LOOKUP_TEMPLATE.format(provider=lookup_result.provider, results=lookup.format_for_model(lookup_result))
                            if lookup_result.found else LOOKUP_NO_RESULTS)
            if lookup_result.found:
                meta = {**meta, "sources": lookup_result.sources()}

    # 3d. What she has told Loni lately (tags, not her words) so the chat feels continuous; also learn from this message.
    memory_lines = await _learn_and_recall(user_id, content)

    # 4. Conversation history for context (last 20 messages; it already contains the message just saved)
    history = (await get_session_messages(session_id))[-20:]
    openai_messages = build_llm_messages(history, user, stage, result, origin, memory_lines, lookup_block)

    # 5. Urgent: the fixed "get checked today" line goes out before any model text, so it is there even if the model fails.
    full = ""
    if result.urgency == Urgency.urgent:
        header = safe_messages.urgent_header(result.template, settings.EMERGENCY_PHONE)
        full += header
        yield _sse({"content": header})

    # 6. Stream the model
    try:
        response = await client.chat.completions.create(model=model, messages=openai_messages, temperature=0.5, stream=True)
        model_text = ""
        async for chunk in response:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                model_text += delta
                yield _sse({"content": delta})
        full += model_text
    except Exception as e:
        print(f"Error calling AI API: {e}")
        if result.urgency == Urgency.urgent:
            fallback = "I'm having trouble answering right now, but please don't wait: use **Talk to a Nurse** below or get to a health facility."
        else:
            fallback = "I'm sorry, I am currently experiencing technical difficulties. Please try again later."
        yield _sse({"content": fallback})
        full += fallback
        model_text = fallback

    # 7. Check what the model said before it is saved as the final answer.
    notes = safety.validate(result.urgency, model_text, result.answer_type,
                            lookup_result.allowed_numbers() if lookup_result is not None else None)
    for note in notes:
        extra = f"\n\n{note}"
        full += extra
        yield _sse({"content": extra})
    if lookup_result is not None and lookup_result.found:   # the source line is ours, so it is always shown and always right
        footer = lookup.source_footer(lookup_result)
        full += footer
        yield _sse({"content": footer})

    yield "data: [DONE]\n\n"
    await _save_assistant(db, session_id, full, meta)
    await _record_safety_event(db, user_id, session_id, result, True, notes)


async def create_chat_session(user_id: str, title: str = "New Chat"):
    db = get_mongo_db()
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    session_doc = {
        "id": session_id,
        "user_id": user_id,
        "title": title,
        "created_at": now,
        "updated_at": now
    }
    
    await db["sessions"].insert_one(session_doc)
    session_doc.pop("_id", None)
    return session_doc

async def get_user_sessions(user_id: str):
    db = get_mongo_db()
    cursor = db["sessions"].find({"user_id": user_id}).sort("updated_at", -1)
    sessions = await cursor.to_list(length=100)
    for s in sessions:
        s.pop("_id", None)
    return sessions

async def delete_chat_session(session_id: str, user_id: str) -> bool:
    db = get_mongo_db()
    result = await db["sessions"].delete_one({"id": session_id, "user_id": user_id})
    if result.deleted_count > 0:
        await db["messages"].delete_many({"session_id": session_id})
        return True
    return False

async def clear_user_sessions(user_id: str) -> bool:
    db = get_mongo_db()
    # Find all sessions to get their IDs
    cursor = db["sessions"].find({"user_id": user_id})
    sessions = await cursor.to_list(length=None)
    session_ids = [s["id"] for s in sessions]
    
    if session_ids:
        await db["messages"].delete_many({"session_id": {"$in": session_ids}})
        await db["sessions"].delete_many({"user_id": user_id})
    return True

async def update_chat_session_title(session_id: str, user_id: str, title: str) -> bool:
    db = get_mongo_db()
    result = await db["sessions"].update_one(
        {"id": session_id, "user_id": user_id},
        {"$set": {"title": title, "updated_at": datetime.now(timezone.utc)}}
    )
    return result.modified_count > 0

async def get_session_messages(session_id: str, limit: int = 1000, skip: int = 0):
    db = get_mongo_db()
    # Sort by created_at DESC so we can paginate from newest to oldest
    cursor = db["messages"].find({"session_id": session_id}).sort("created_at", -1).skip(skip).limit(limit)
    messages = await cursor.to_list(length=limit)
    for m in messages:
        m.pop("_id", None)
    
    # Reverse so they are returned in chronological order
    messages.reverse()
    return messages




# ── human review of high-risk conversations (admins only; see router) ───────────────────────────────

async def list_safety_events(needs_review: bool = True, limit: int = 50, skip: int = 0):
    db = get_mongo_db()
    query = {"needs_review": True, "reviewed_at": None} if needs_review else {}
    cursor = db["ai_safety_events"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    events = await cursor.to_list(length=limit)
    for e in events:
        e.pop("_id", None)
    return events


async def get_safety_event(event_id: str):
    db = get_mongo_db()
    events = await db["ai_safety_events"].find({"id": event_id}).to_list(length=1)
    if not events:
        return None
    events[0].pop("_id", None)
    return events[0]


async def mark_safety_event_reviewed(event_id: str, admin_id: str, note: str | None) -> bool:
    db = get_mongo_db()
    result = await db["ai_safety_events"].update_one(
        {"id": event_id},
        {"$set": {"reviewed_at": datetime.now(timezone.utc), "reviewed_by": admin_id, "review_note": (note or "").strip() or None}},
    )
    return result.matched_count > 0
