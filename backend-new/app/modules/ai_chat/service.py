import uuid
from datetime import datetime, timezone
from openai import AsyncOpenAI
from app.core.config import settings
from app.core.mongo_db import get_mongo_db
from app.modules.ai_chat.prompts import SYSTEM_PROMPT

# Default model configuration
DEFAULT_MODEL = "gpt-3.5-turbo"

async def stream_chat_message(session_id: str, user_id: str, content: str):
    db = get_mongo_db()
    now = datetime.now(timezone.utc)
    
    # 1. Save user message to DB
    user_message_id = str(uuid.uuid4())
    user_msg_doc = {
        "id": user_message_id,
        "session_id": session_id,
        "role": "user",
        "content": content,
        "created_at": now
    }
    await db["messages"].insert_one(user_msg_doc)
    
    # Update session updated_at
    await db["sessions"].update_one(
        {"id": session_id},
        {"$set": {"updated_at": now}}
    )

    # 2. Retrieve conversation history (keep context small: last 20 msgs max)
    history = await get_session_messages(session_id)
    history = history[-20:]
    
    # 3. Format messages for OpenAI
    openai_messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]
    
    for msg in history:
        openai_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })
        
    # 4. Configure client based on environment
    if settings.AI_ENVIRONMENT == "local":
        client = AsyncOpenAI(
            base_url=settings.OLLAMA_BASE_URL,
            api_key="ollama"
        )
        model = "qwen3:8b"
    elif settings.AI_ENVIRONMENT == "openai":
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        model = DEFAULT_MODEL
    else:
        client = AsyncOpenAI(
            base_url="https://routellm.abacus.ai/v1",
            api_key=settings.ABACUS_API_KEY
        )
        model = "deepseek-v4-flash"
        
    # 5. Call AI API with streaming enabled
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=openai_messages,
            temperature=0.7,
            stream=True
        )
        
        full_assistant_content = ""
        
        import json
        async for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                full_assistant_content += delta
                yield f"data: {json.dumps({'content': delta})}\n\n"
        
        yield "data: [DONE]\n\n"
                
    except Exception as e:
        import json
        print(f"Error calling AI API: {e}")
        error_msg = "I'm sorry, I am currently experiencing technical difficulties. Please try again later."
        yield f"data: {json.dumps({'content': error_msg})}\n\n"
        full_assistant_content = error_msg

    # 6. Save assistant response to DB
    assistant_message_id = str(uuid.uuid4())
    assistant_msg_doc = {
        "id": assistant_message_id,
        "session_id": session_id,
        "role": "assistant",
        "content": full_assistant_content,
        "created_at": datetime.now(timezone.utc)
    }
    await db["messages"].insert_one(assistant_msg_doc)

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


