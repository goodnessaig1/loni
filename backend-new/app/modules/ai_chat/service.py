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
    else:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        model = DEFAULT_MODEL
        
    # 5. Call AI API with streaming enabled
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=openai_messages,
            temperature=0.7,
            stream=True
        )
        
        full_assistant_content = ""
        
        async for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                full_assistant_content += delta
                yield delta
                
    except Exception as e:
        print(f"Error calling AI API: {e}")
        error_msg = "I'm sorry, I am currently experiencing technical difficulties. Please try again later."
        yield error_msg
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

async def get_session_messages(session_id: str):
    db = get_mongo_db()
    cursor = db["messages"].find({"session_id": session_id}).sort("created_at", 1)
    messages = await cursor.to_list(length=1000)
    for m in messages:
        m.pop("_id", None)
    return messages


