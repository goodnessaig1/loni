"""
Direct-to-APNs PushKit VoIP push sender.

WHY THIS FILE EXISTS
---------------------
Firebase Cloud Messaging has no "VoIP" push type - it can only send the
regular "remote-notification" APNs push type (even for iOS, FCM just proxies
to APNs under the hood, but only as a normal push). Regular remote pushes to
iOS are explicitly NOT guaranteed to wake a fully force-quit (swiped away)
app - iOS may throttle, coalesce, or drop them entirely once the process is
gone. Apple's ONLY supported mechanism for reliably waking a terminated app
to handle an incoming call is a PushKit VoIP push, delivered outside the
normal push budget/throttling, PROVIDED the app reports the call to CallKit
immediately (RNCallKeep.displayIncomingCall) upon receiving it - apps that
receive a VoIP push and don't immediately report a call get silently killed
by iOS as a policy violation.

VoIP pushes must be sent directly to Apple's APNs HTTP/2 API (not through
FCM), authenticated with a JWT signed by an APNs Auth Key (.p8), using the
`apns-push-type: voip` header and a `.voip`-suffixed topic. This module
implements that directly with `httpx` (HTTP/2) and `python-jose` (ES256 JWT
signing) - both already dependencies of this project, so no new package is
required.

No sandbox here can generate real Apple Developer credentials - see the
config.py comments next to APNS_VOIP_AUTH_KEY for exactly what's needed and
where to get it. Until those are configured, `is_configured()` returns False
and NotificationService simply skips the VoIP path (falling back to regular
FCM, which still works whenever the app isn't fully killed).
"""
import time
import json
import logging
from typing import Any, Dict, List, Optional

import httpx
from jose import jwt as jose_jwt

from app.core.config import settings

logger = logging.getLogger("voip_service")

_PROD_HOST = "https://api.push.apple.com"
_SANDBOX_HOST = "https://api.sandbox.push.apple.com"

# APNs provider tokens are valid up to ~60 minutes; Apple asks that you
# don't regenerate more than once per minute. We cache and refresh well
# under the ceiling.
_TOKEN_TTL_SECONDS = 30 * 60

_cached_token: Optional[str] = None
_cached_token_issued_at: float = 0.0


def is_configured() -> bool:
    return bool(settings.APNS_VOIP_AUTH_KEY and settings.APNS_KEY_ID and settings.APNS_TEAM_ID)


def _get_provider_token() -> str:
    global _cached_token, _cached_token_issued_at
    now = time.time()
    if _cached_token and (now - _cached_token_issued_at) < _TOKEN_TTL_SECONDS:
        return _cached_token

    headers = {"alg": "ES256", "kid": settings.APNS_KEY_ID}
    payload = {"iss": settings.APNS_TEAM_ID, "iat": int(now)}
    # python-jose's ES256 support requires the `cryptography` backend,
    # already a transitive dependency here (used elsewhere for password
    # hashing / JWT auth) - no extra install needed.
    token = jose_jwt.encode(payload, settings.APNS_VOIP_AUTH_KEY, algorithm="ES256", headers=headers)
    _cached_token = token
    _cached_token_issued_at = now
    return token


class VoIPPushService:
    @staticmethod
    async def send_incoming_call(tokens: List[str], data: Dict[str, Any]) -> None:
        """
        Sends a VoIP push for an incoming call to each of the given device
        tokens. `data` should be JSON-serializable (call_id, room_name,
        caller info, etc.) - it arrives verbatim in
        `react-native-voip-push-notification`'s `notification` event on the
        client, which must synchronously call
        RNCallKeep.displayIncomingCall(...) (see lib/voipPush.ts).
        """
        if not tokens:
            return
        if not is_configured():
            logger.warning(
                "APNs VoIP push requested but APNS_VOIP_AUTH_KEY/APNS_KEY_ID/"
                "APNS_TEAM_ID are not configured - skipping VoIP push, "
                "falling back to regular FCM delivery only. See config.py."
            )
            return

        host = _SANDBOX_HOST if settings.APNS_USE_SANDBOX else _PROD_HOST
        token = _get_provider_token()

        # VoIP pushes use a payload structure the app defines itself (no
        # `aps` dictionary is required, unlike alert-type pushes) - PushKit
        # hands the whole payload to the client's `notification` event.
        body = json.dumps(data).encode("utf-8")

        headers = {
            "authorization": f"bearer {token}",
            "apns-topic": f"{settings.APNS_BUNDLE_ID}.voip",
            "apns-push-type": "voip",
            "apns-priority": "10",
            "apns-expiration": "0",
        }

        async with httpx.AsyncClient(http2=True, timeout=10.0) as client:
            for device_token in tokens:
                url = f"{host}/3/device/{device_token}"
                try:
                    resp = await client.post(url, headers=headers, content=body)
                    if resp.status_code != 200:
                        # Common failure: BadDeviceToken means the token was
                        # issued for the wrong environment (sandbox vs
                        # production) - check APNS_USE_SANDBOX.
                        try:
                            reason = resp.json().get("reason")
                        except Exception:
                            reason = resp.text
                        logger.warning("APNs VoIP push failed (%s): %s", resp.status_code, reason)
                except Exception as e:
                    logger.error("APNs VoIP push request error: %s", e)
