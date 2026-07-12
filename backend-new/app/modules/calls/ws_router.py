"""
WebSocket endpoint used for real-time call signaling (Issue 1, 2, 8, 10, 11).

Client connects once per app-foreground session:

    wss://<host>/api/v1/calls/ws?token=<JWT access token>

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
from app.core.security import ALGORITHM
from app.core.ws_manager import manager

logger = logging.getLogger("calls.ws")
router = APIRouter()


async def _authenticate(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


@router.websocket("/ws")
async def call_signaling_socket(websocket: WebSocket, token: str = Query(...)):
    user_id = await _authenticate(token)
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
            if msg.get("type") == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("WS error for user=%s: %s", user_id, e)
    finally:
        manager.disconnect(user_id, websocket)
