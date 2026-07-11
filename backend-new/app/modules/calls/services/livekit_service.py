import os
from livekit import api
from livekit.api import AccessToken, VideoGrants

# LIVEKIT_API_KEY and LIVEKIT_API_SECRET should be set in environment variables
# If not set, LiveKit API uses environment variables automatically, but we can wrap it.

class LiveKitService:
    @staticmethod
    def create_token(room_name: str, participant_identity: str, participant_name: str, is_admin: bool = False) -> str:
        """
        Generate a short-lived JWT token for a user to join a specific room.
        """
        api_key = os.getenv('LIVEKIT_API_KEY')
        api_secret = os.getenv('LIVEKIT_API_SECRET')
        
        if not api_key or not api_secret:
            raise Exception("LiveKit credentials not configured in environment.")

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
        
        # Token valid for 1 hour
        token.with_ttl("1h")
        return token.to_jwt()

    @staticmethod
    async def create_room(room_name: str, empty_timeout: int = 5 * 60):
        """
        Create a room forcefully if needed, or update its settings.
        Using Livekit API.
        """
        livekit_url = os.getenv('LIVEKIT_API_URL', 'http://localhost:7880')
        api_key = os.getenv('LIVEKIT_API_KEY')
        api_secret = os.getenv('LIVEKIT_API_SECRET')
        
        async with api.LiveKitAPI(livekit_url, api_key, api_secret) as lkapi:
            room = await lkapi.room.create_room(
                api.CreateRoomRequest(
                    name=room_name,
                    empty_timeout=empty_timeout,
                    max_participants=2
                )
            )
            return room

    @staticmethod
    async def delete_room(room_name: str):
        livekit_url = os.getenv('LIVEKIT_API_URL', 'http://localhost:7880')
        api_key = os.getenv('LIVEKIT_API_KEY')
        api_secret = os.getenv('LIVEKIT_API_SECRET')
        
        async with api.LiveKitAPI(livekit_url, api_key, api_secret) as lkapi:
            await lkapi.room.delete_room(
                api.DeleteRoomRequest(room=room_name)
            )
