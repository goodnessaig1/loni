import os
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from livekit.api import WebhookReceiver

from app.core.database import get_db
from app.modules.calls.models import Call, CallEvent, CallParticipant, ParticipantRoleEnum
from sqlalchemy.future import select

router = APIRouter()

# Global receiver
# We initialize it dynamically since env vars might be loaded at runtime
def get_webhook_receiver():
    api_key = os.getenv('LIVEKIT_API_KEY')
    api_secret = os.getenv('LIVEKIT_API_SECRET')
    if not api_key or not api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials missing")
    # LiveKit Python SDK WebhookReceiver expects a token receiver, or we can use it to receive directly
    return WebhookReceiver(api_key, api_secret)

@router.post("/webhook")
async def livekit_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing auth header")
    
    body = await request.body()
    body_str = body.decode("utf-8")
    
    try:
        receiver = get_webhook_receiver()
        event = receiver.receive(body_str, auth_header)
        
        event_name = event.event
        room_name = event.room.name
        
        # Find the call
        stmt = select(Call).where(Call.room_name == room_name)
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()
        
        if not call:
            return {"status": "ignored", "reason": "Room not linked to a Call"}

        # Log event
        db_event = CallEvent(
            call_id=call.id, 
            event_type=event_name,
            payload={"participant": event.participant.identity if event.participant else None}
        )
        db.add(db_event)
        
        # Handle specific events if needed
        # (e.g. participant joined, left, room finished to clean up DB)
        
        await db.commit()
        return {"status": "ok"}
    
    except Exception as e:
        print(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook")
