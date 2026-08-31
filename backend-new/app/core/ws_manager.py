"""
Real-time signaling channel for call state.

WHY THIS FILE EXISTS
---------------------
The previous implementation used Firebase Cloud Messaging (FCM) as the ONLY
transport for call signaling (REQUESTED -> RINGING -> ACCEPTED -> ...).
Push notifications are a best-effort, "wake the app up" mechanism - they are
NOT designed for low-latency control-plane signaling. They can be delayed by
seconds to minutes (Android Doze/App Standby batching, iOS APNs default
priority deferral), can arrive out of order, can be silently dropped, and are
rate-limited by the OS. That is the root cause of Issue 1 (slow accept
notification) and Issue 2/8 (the caller's screen never learns the call was
accepted, so it never joins the LiveKit room).

This module gives every authenticated, foregrounded client a persistent
WebSocket connection to the backend. All call state transitions
(RINGING, ACCEPTED, CONNECTING, CONNECTED, RECONNECTING, ENDED, MISSED,
REJECTED, FAILED, TIMEOUT) are broadcast over this socket the instant they
happen server-side - typically < 50ms end to end on a healthy network.

FCM is still used (see notifications/service.py) but ONLY for its intended
purpose: waking a backgrounded/killed app so it can show a full-screen
incoming-call UI. Once the app is foregrounded it always has a live socket,
so the "push" data payload for incoming_call is treated as a best-effort
*wake* signal, never as the source of truth for state.
"""
import json
import logging
from typing import Any, Dict, Set
from fastapi import WebSocket

logger = logging.getLogger("ws_manager")


class ConnectionManager:
    """Tracks live WebSocket connections keyed by user_id.

    A single user can have multiple sockets open (e.g. two tabs, or a
    reconnect race) so we keep a *set* of sockets per user and fan out to
    all of them. Broadcasts are fire-and-forget: a dead socket is pruned
    silently rather than raising, because signaling must never block or
    crash a call-state transition.
    """

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)
        logger.info("WS connected user=%s total_sockets=%d", user_id, len(self._connections[user_id]))

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)
        logger.info("WS disconnected user=%s", user_id)

    def is_online(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

    async def send_to_user(self, user_id: str, event_type: str, payload: Dict[str, Any]) -> bool:
        """Send an event to every live socket for a user.

        Returns True if at least one socket received it (i.e. the user is
        actively connected right now and did not need to be woken by FCM).
        """
        sockets = self._connections.get(user_id)
        if not sockets:
            return False

        message = json.dumps({"type": event_type, "data": payload})
        dead: Set[WebSocket] = set()
        delivered = False
        for ws in sockets:
            try:
                await ws.send_text(message)
                delivered = True
            except Exception as e:  # socket closed / broken pipe / etc.
                logger.warning("WS send failed for user=%s: %s", user_id, e)
                dead.add(ws)

        for ws in dead:
            sockets.discard(ws)
        if not sockets:
            self._connections.pop(user_id, None)

        return delivered


# Single process-wide instance. If you scale FastAPI to multiple workers /
# containers, replace this with a Redis pub/sub backed implementation
# (LiveKit already ships a Redis instance in docker-compose.yml that can be
# reused for this) so broadcasts reach a user regardless of which worker
# holds their socket.
manager = ConnectionManager()
