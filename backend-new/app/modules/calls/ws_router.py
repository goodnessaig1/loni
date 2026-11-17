"""
WebSocket endpoint used for real-time call signaling (Issue 1, 2, 8, 10, 11).

Client connects once per app-foreground session:

    wss://<host>/api/v1/calls/ws?ticket=<60s ticket from POST /calls/ws-ticket>
    (legacy: ?token=<JWT access token>, still accepted for older app builds)

The server pushes JSON frames shaped like:

    {"type": "incoming_call", "data": {...}}
    {"type": "call_state", "data": {"call_id": 1, "status": "ACCEPTED", ...}}

Auth is done via a query param (not an Authorization header) because React
Native's WebSocket implementation - like browsers' - does not support custom
headers on the initial handshake request.

Ping/pong: the client is expected to send `{"type":"ping"}` periodically
(the mobile client below does this every 25s). We reply with `{"type":"pong"}`
so React Native (which has no native WebSocket keepalive) can detect a dead
connection and reconnect quickly instead of silently sitting on a socket
that a NAT / mobile carrier has already killed.
"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import ALGORITHM, WS_TICKET_TYPE
from app.modules.users.models import AccountStatusEnum, User
from app.core.ws_manager import manager

logger = logging.getLogger("calls.ws")

# Topics a client may subscribe to over this socket (see ConnectionManager.broadcast_topic).
ALLOWED_TOPICS = {"community"}
router = APIRouter()


async def _authenticate(ticket: str | None, token: str | None) -> str | None:
    """Prefer the 60-second ws ticket (POST /calls/ws-ticket). The full access token is still
    accepted for app builds that predate tickets; drop `token` once those are gone.
    Either way the account must still exist and not be suspended."""
    raw = ticket or token
    if not raw:
        return None
    try:
        payload = jwt.decode(raw, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    typ = payload.get("typ")
    if ticket and typ != WS_TICKET_TYPE:
        return None
    if not ticket and typ is not None:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    try:
        async with AsyncSessionLocal() as db:
            user = await db.get(User, user_id)
    except Exception as e:  # database unreachable: refuse rather than let anyone in
        logger.warning("WS auth lookup failed: %s", e)
        return None
    if not user or user.account_status == AccountStatusEnum.suspended:
        return None
    return str(user_id)


@router.websocket("/ws")
async def call_signaling_socket(websocket: WebSocket, ticket: str | None = Query(None), token: str | None = Query(None)):
    user_id = await _authenticate(ticket, token)
    if not user_id:
        # Must accept before close per ASGI spec, or reject with a close code.
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            # We don't require clients to send anything except keepalive
            # pings, but we must keep reading or the connection is
            # considered idle by some proxies/load balancers.
            raw = await websocket.receive_text()
            try:
                import json
                msg = json.loads(raw)
            except Exception:
                continue
            kind = msg.get("type")
            if kind == "ping":
                await websocket.send_text('{"type":"pong"}')
            elif kind in ("subscribe", "unsubscribe") and msg.get("topic") in ALLOWED_TOPICS:
                if kind == "subscribe":
                    manager.subscribe(user_id, msg["topic"])
                else:
                    manager.unsubscribe(user_id, msg["topic"])
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("WS error for user=%s: %s", user_id, e)
    finally:
        manager.disconnect(user_id, websocket)
