"""
Refuse to start a production server with secrets that are public (committed to the repo or
library defaults). With the default SECRET_KEY anyone can forge a user token; with the
committed LiveKit dev key anyone can mint a token for any call room and listen in.

Outside production the same problems are logged as warnings so local development keeps working.
"""
import logging

from app.core.config import settings

logger = logging.getLogger("secrets_check")

# Values that appear in this repository or as code defaults - never acceptable in production.
KNOWN_PUBLIC_SECRETS = {
    "super_secret_key_change_in_production",
    "super_secret_livekit_key_32_chars_long!",
    "secret",
    "devkey",
}
MIN_SECRET_LENGTH = 32


class InsecureConfigError(RuntimeError):
    pass


def problems() -> list[str]:
    found = []
    if settings.SECRET_KEY in KNOWN_PUBLIC_SECRETS or len(settings.SECRET_KEY) < MIN_SECRET_LENGTH:
        found.append("SECRET_KEY is a public default or shorter than 32 characters")
    if settings.LIVEKIT_API_SECRET and (
        settings.LIVEKIT_API_SECRET in KNOWN_PUBLIC_SECRETS or len(settings.LIVEKIT_API_SECRET) < MIN_SECRET_LENGTH
    ):
        found.append("LIVEKIT_API_SECRET is the committed dev secret or shorter than 32 characters")
    if settings.LIVEKIT_API_KEY in KNOWN_PUBLIC_SECRETS:
        found.append("LIVEKIT_API_KEY is the committed dev key 'devkey'")
    public_url = settings.LIVEKIT_PUBLIC_URL or ""
    if public_url and not public_url.startswith("wss://"):
        found.append("LIVEKIT_PUBLIC_URL is not wss:// (call signalling would be unencrypted)")
    return found


def enforce_production_secrets() -> None:
    found = problems()
    if not found:
        return
    if settings.APP_ENV.strip().lower() == "production":
        raise InsecureConfigError("Refusing to start in production: " + "; ".join(found))
    for p in found:
        logger.warning("INSECURE CONFIG (ok for local dev, fatal when APP_ENV=production): %s", p)
