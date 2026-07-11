import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from app.modules.calls.models import Call, CallParticipant, CallEvent, CallStatusEnum, ParticipantRoleEnum
from app.modules.calls.schemas import CallRequest
from app.modules.calls.services.livekit_service import LiveKitService
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User, UserTypeEnum
import asyncio

class CallService:
    @staticmethod
    async def request_call(db: AsyncSession, caller_id: str, request: CallRequest):
        room_name = f"room-{uuid.uuid4()}"
        call = Call(
            caller_id=caller_id,
            receiver_id=request.nurse_id,
            status=CallStatusEnum.REQUESTED,
            room_name=room_name
        )
        db.add(call)
        await db.flush() 
        
        participant = CallParticipant(
            call_id=call.id,
            user_id=caller_id,
            role=ParticipantRoleEnum.CALLER
        )
        db.add(participant)

        event = CallEvent(call_id=call.id, event_type="CallRequested")
        db.add(event)
        
        await db.commit()
        await db.refresh(call)
        
        # Trigger push notifications to nurse(s)
        payload = {
            "type": "incoming_call", 
            "call_id": str(call.id), 
            "caller_name": "Mother", 
            "room_name": call.room_name
        }
        if request.nurse_id:
            asyncio.create_task(NotificationService.notify_user(
                request.nurse_id, "Incoming Call", "A mother is calling you.", payload
            ))
        else:
            # Broadcast to all online nurses
            stmt = select(User.id).where(User.user_type == UserTypeEnum.nurse, User.is_online == True)
            result = await db.execute(stmt)
            nurse_ids = result.scalars().all()
            for n_id in nurse_ids:
                asyncio.create_task(NotificationService.notify_user(
                    n_id, "Incoming Call", "A mother is calling.", payload
                ))
        
        return call

    @staticmethod
    async def accept_call(db: AsyncSession, call_id: int, nurse_id: str):
        # Database transaction level lock (Pessimistic Locking)
        # Prevents race conditions when multiple nurses press Accept
        stmt = select(Call).where(Call.id == call_id).with_for_update()
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()

        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        if call.status not in [CallStatusEnum.REQUESTED, CallStatusEnum.RINGING]:
            # If status changed while we were waiting for the lock, reject
            raise HTTPException(status_code=400, detail="This call has already been answered or cancelled.")
        
        call.status = CallStatusEnum.ACCEPTED
        call.receiver_id = nurse_id
        
        participant = CallParticipant(
            call_id=call.id,
            user_id=nurse_id,
            role=ParticipantRoleEnum.RECEIVER
        )
        db.add(participant)
        
        event = CallEvent(call_id=call.id, event_type="CallAccepted", payload={"nurse_id": nurse_id})
        db.add(event)

        # Create room using LiveKit SDK
        await LiveKitService.create_room(call.room_name)

        await db.commit()
        await db.refresh(call)

        # Notify caller that call was accepted
        asyncio.create_task(NotificationService.notify_user(
            call.caller_id, 
            "Call Accepted", 
            "A nurse has accepted your call.", 
            {"type": "call_accepted", "call_id": str(call.id), "room_name": call.room_name}
        ))

        return call

    @staticmethod
    async def reject_call(db: AsyncSession, call_id: int, user_id: str):
        stmt = select(Call).where(Call.id == call_id).with_for_update()
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()

        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        # In a real app, if broadcast to all nurses, one nurse rejecting doesn't end the call
        # Unless she was the specifically targeted nurse.
        # Simplified:
        if call.receiver_id == user_id or not call.receiver_id:
            call.status = CallStatusEnum.REJECTED
            call.ended_at = datetime.now(timezone.utc)
            
            event = CallEvent(call_id=call.id, event_type="CallRejected", payload={"rejected_by": user_id})
            db.add(event)
            await db.commit()
            
            asyncio.create_task(NotificationService.notify_user(
                call.caller_id, 
                "Call Declined", 
                "The nurse declined the call.", 
                {"type": "call_rejected", "call_id": str(call.id)}
            ))
            return call
            
        raise HTTPException(status_code=403, detail="Unauthorized to reject this call")

    @staticmethod
    async def end_call(db: AsyncSession, call_id: int, user_id: str):
        stmt = select(Call).where(Call.id == call_id).with_for_update()
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()

        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        call.status = CallStatusEnum.ENDED
        call.ended_at = datetime.now(timezone.utc)
        if call.started_at:
            delta = call.ended_at - call.started_at
            call.duration_seconds = int(delta.total_seconds())

        event = CallEvent(call_id=call.id, event_type="CallEnded", payload={"ended_by": user_id})
        db.add(event)
        
        await LiveKitService.delete_room(call.room_name)

        await db.commit()

        # Notify the other participant
        other_participant_id = call.receiver_id if user_id == call.caller_id else call.caller_id
        if other_participant_id:
            asyncio.create_task(NotificationService.notify_user(
                other_participant_id, 
                "Call Ended", 
                "The call has ended.", 
                {"type": "call_ended", "call_id": str(call.id)}
            ))

        return call
