from datetime import timedelta
from livekit import api
from livekit.api import AccessToken, VideoGrants

from app.core.config import settings


class LiveKitConfigError(Exception):
    """Raised when LiveKit env vars are missing, instead of silently
    falling back to a developer's hardcoded LAN IP (the old behaviour,
    root cause of Issue 9: it made connection failures look like a
    LiveKit/WebRTC bug when it was actually a misconfigured environment)."""


def _require_credentials() -> tuple[str, str]:
    if not settings.LIVEKIT_API_KEY or not settings.LIVEKIT_API_SECRET:
        raise LiveKitConfigError(
            "LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not set. "
            "Set them in backend-new/.env - they must match the `keys:` "
            "block in livekit/livekit.yaml."
        )
    return settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET


def _require_server_url() -> str:
    if not settings.LIVEKIT_URL:
        raise LiveKitConfigError(
            "LIVEKIT_URL is not set. This must be the URL the FastAPI "
            "backend uses to reach the LiveKit REST API (e.g. "
            "http://livekit:7880 inside docker-compose's network, or "
            "https://your-livekit-domain in production). See Issue 9."
        )
    return settings.LIVEKIT_URL


class LiveKitService:
    @staticmethod
    def get_public_url() -> str:
        """The wss:// URL mobile clients should connect to. Falls back to
        LIVEKIT_URL only if LIVEKIT_PUBLIC_URL isn't set, with a ws(s)
        scheme correction, so at minimum local single-machine dev keeps
        working without two env vars."""
        if settings.LIVEKIT_PUBLIC_URL:
            return settings.LIVEKIT_PUBLIC_URL
        url = _require_server_url()
        return url.replace("https://", "wss://").replace("http://", "ws://")

    @staticmethod
    def create_token(room_name: str, participant_identity: str, participant_name: str, is_admin: bool = False) -> str:
        """
        Generate a short-lived JWT token for a user to join a specific room.
        """
        api_key, api_secret = _require_credentials()

        token = AccessToken(api_key, api_secret)
        token.with_identity(participant_identity)
        token.with_name(participant_name)

        grants = VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            room_admin=is_admin
        )
        token.with_grants(grants)

        # Kept short: a call either connects promptly or it's re-requested.
        # Long-lived tokens for an ephemeral call room are an unnecessary
        # security exposure if the token leaks (e.g. via logs).
        token.with_ttl(timedelta(hours=1))
        return token.to_jwt()

    @staticmethod
    async def create_room(room_name: str, empty_timeout: int = 5 * 60):
        """
        Create the room up front (rather than relying on LiveKit's
        auto-create-on-join) so we can pin max_participants=2 for a 1:1
        call and so create_room() failing surfaces as an explicit error to
        `accept_call` instead of silently deferring the failure to
        whichever client happens to connect first.
        """
        server_url = _require_server_url()
        api_key, api_secret = _require_credentials()

        lkapi = api.LiveKitAPI(server_url, api_key, api_secret)
        try:
            room = await lkapi.room.create_room(
                api.CreateRoomRequest(
                    name=room_name,
                    empty_timeout=empty_timeout,
                    max_participants=2
                )
            )
            return room
        finally:
            await lkapi.aclose()

    @staticmethod
    async def list_participants(room_name: str):
        """Used as a fallback verification path (and for debugging) when we
        want to confirm who is actually in a room server-side, independent
        of webhook delivery."""
        server_url = _require_server_url()
        api_key, api_secret = _require_credentials()

        lkapi = api.LiveKitAPI(server_url, api_key, api_secret)
        try:
            res = await lkapi.room.list_participants(
                api.ListParticipantsRequest(room=room_name)
            )
            return res.participants
        except Exception:
            return []
        finally:
            await lkapi.aclose()

    @staticmethod
    async def delete_room(room_name: str):
        server_url = _require_server_url()
        api_key, api_secret = _require_credentials()

        lkapi = api.LiveKitAPI(server_url, api_key, api_secret)
        try:
            await lkapi.room.delete_room(
                api.DeleteRoomRequest(room=room_name)
            )
        except Exception as e:
            print(f"Warning: Failed to delete room {room_name}: {e}")
        finally:
            await lkapi.aclose()
