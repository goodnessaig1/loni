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
import asyncio
import json
import logging
import uuid
from typing import Any, Dict, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger("ws_manager")

# Scaling: with several API processes a user's socket lives on just one of them. Every event is
# delivered locally and also published on Redis; the other processes deliver it to their own sockets.
# This process ignores its own publications (it already delivered them).
INSTANCE_ID = uuid.uuid4().hex
CHANNEL = "loni:ws"


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
        # topic -> user_ids that asked to receive its broadcasts (e.g. "community" while the feed is open).
        self._topics: Dict[str, Set[str]] = {}
        self._redis = None
        self._listener: Optional[asyncio.Task] = None

    # ---- cross-process relay ------------------------------------------------------------------
    async def start_relay(self, redis_url: Optional[str]) -> None:
        """Connect to Redis and start delivering events published by other processes."""
        if not redis_url or self._redis is not None:
            return
        import redis.asyncio as aioredis
        self._redis = aioredis.from_url(redis_url, decode_responses=True)
        self._listener = asyncio.create_task(self._listen())
        logger.info("WS relay on Redis started (instance %s)", INSTANCE_ID[:8])

    async def stop_relay(self) -> None:
        if self._listener:
            self._listener.cancel()
            try:
                await self._listener
            except (asyncio.CancelledError, Exception):
                pass
            self._listener = None
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    async def _publish(self, message: Dict[str, Any]) -> None:
        if self._redis is None:
            return
        try:
            await self._redis.publish(CHANNEL, json.dumps({**message, "o": INSTANCE_ID}, default=str))
        except Exception as e:  # Redis down: this process still delivered locally
            logger.warning("WS relay publish failed: %s", e)

    async def _listen(self) -> None:
        while True:
            try:
                pubsub = self._redis.pubsub()
                await pubsub.subscribe(CHANNEL)
                async for raw in pubsub.listen():
                    if raw.get("type") != "message":
                        continue
                    try:
                        msg = json.loads(raw["data"])
                    except Exception:
                        continue
                    if msg.get("o") == INSTANCE_ID:
                        continue
                    if msg.get("k") == "user":
                        await self._deliver(msg["u"], msg["t"], msg["d"])
                    elif msg.get("k") == "topic":
                        await self._deliver_topic(msg["topic"], msg["t"], msg["d"], set(msg.get("x") or []))
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning("WS relay listener error, retrying: %s", e)
                await asyncio.sleep(2)

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
            # No socket left: they can't be listening to any topic any more.
            for members in self._topics.values():
                members.discard(user_id)
        logger.info("WS disconnected user=%s", user_id)

    def subscribe(self, user_id: str, topic: str) -> None:
        self._topics.setdefault(topic, set()).add(user_id)

    def unsubscribe(self, user_id: str, topic: str) -> None:
        self._topics.get(topic, set()).discard(user_id)

    async def broadcast_topic(self, topic: str, event_type: str, payload: Dict[str, Any],
                              exclude: Set[str] | None = None) -> int:
        """Send an event to every subscriber of `topic` (minus `exclude`), on every process.
        Returns how many users on this process got it."""
        await self._publish({"k": "topic", "topic": topic, "t": event_type, "d": payload, "x": list(exclude or [])})
        return await self._deliver_topic(topic, event_type, payload, exclude or set())

    async def _deliver_topic(self, topic: str, event_type: str, payload: Dict[str, Any], exclude: Set[str]) -> int:
        delivered = 0
        for user_id in list(self._topics.get(topic, ())):
            if user_id in exclude:
                continue
            if await self._deliver(user_id, event_type, payload):
                delivered += 1
        return delivered

    def is_online(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

    async def send_to_user(self, user_id: str, event_type: str, payload: Dict[str, Any]) -> bool:
        """Send an event to every live socket for a user.

        Returns True if a socket on THIS process received it. With a Redis relay the event is
        also published so the process holding the user's socket delivers it.
        """
        await self._publish({"k": "user", "u": user_id, "t": event_type, "d": payload})
        return await self._deliver(user_id, event_type, payload)

    async def _deliver(self, user_id: str, event_type: str, payload: Dict[str, Any]) -> bool:
        sockets = self._connections.get(user_id)
        if not sockets:
            return False

        message = json.dumps({"type": event_type, "data": payload}, default=str)
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


# One per process. Set REDIS_URL to run several processes/containers (see start_relay).
manager = ConnectionManager()
