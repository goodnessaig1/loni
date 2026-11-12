"""Crypto for the admin portal: staff access tokens, opaque secrets, sign-in codes, TOTP and the password policy."""
import base64
import hashlib
import hmac
import secrets
import struct
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"
AUDIENCE = "loni-admin"
ISSUER = "loni-api"
TOKEN_TYPE = "staff_access"
TOTP_PERIOD = 30
TOTP_DIGITS = 6


def _derive(label: str) -> bytes:
    return hmac.new(settings.SECRET_KEY.encode(), label.encode(), hashlib.sha256).digest()


def _jwt_key() -> str:
    return settings.ADMIN_JWT_SECRET or _derive("loni-admin-jwt").hex()


def _fernet() -> Fernet:
    raw = settings.ADMIN_ENCRYPTION_KEY.encode() if settings.ADMIN_ENCRYPTION_KEY else _derive("loni-admin-enc")
    key = raw if len(raw) == 44 else base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


def now() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt: Optional[datetime]) -> Optional[datetime]:
    """SQLite hands back naive datetimes; everything we store is UTC."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ── tokens ───────────────────────────────────────────────────────────────────────────────────

def create_access_token(staff_id: str, session_id: str) -> Tuple[str, int]:
    ttl = settings.ADMIN_ACCESS_TOKEN_MINUTES * 60
    issued = now()
    claims = {
        "sub": staff_id, "sid": session_id, "typ": TOKEN_TYPE, "aud": AUDIENCE, "iss": ISSUER,
        "iat": int(issued.timestamp()), "exp": int((issued + timedelta(seconds=ttl)).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(claims, _jwt_key(), algorithm=ALGORITHM), ttl


def decode_access_token(token: str) -> Optional[dict]:
    try:
        claims = jwt.decode(token, _jwt_key(), algorithms=[ALGORITHM], audience=AUDIENCE, issuer=ISSUER)
    except JWTError:
        return None
    if claims.get("typ") != TOKEN_TYPE or not claims.get("sub") or not claims.get("sid"):
        return None
    return claims


def new_id() -> str:
    return uuid.uuid4().hex


def new_secret() -> str:
    return secrets.token_urlsafe(32)


def hash_secret(value: str) -> str:
    """For high-entropy random tokens (refresh, challenge, invite): a plain SHA-256 is enough."""
    return hashlib.sha256(value.encode()).hexdigest()


def split_token(token: str) -> Tuple[str, str]:
    """`<row id>.<secret>` -> (row id, secret). Lets us find the row without searching by hash."""
    row_id, _, secret = (token or "").partition(".")
    return row_id, secret


def same(a: Optional[str], b: Optional[str]) -> bool:
    return bool(a) and bool(b) and hmac.compare_digest(a, b)


# ── emailed sign-in codes ───────────────────────────────────────────────────────────────────

def new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(challenge_id: str, code: str) -> str:
    """Keyed, so a leaked table row can't be brute-forced offline in a million guesses."""
    return hmac.new(_derive("loni-admin-code"), f"{challenge_id}:{code}".encode(), hashlib.sha256).hexdigest()


# ── TOTP (RFC 6238, the format every authenticator app uses) ──────────────────────────────

def new_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return None


def _hotp(secret: str, counter: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{number % 10 ** TOTP_DIGITS:0{TOTP_DIGITS}d}"


def verify_totp(secret: str, code: str, last_counter: Optional[int] = None, at: Optional[float] = None) -> Optional[int]:
    """The matching time step (one step of clock drift allowed either way), or None. Steps already used are refused."""
    code = (code or "").strip().replace(" ", "")
    if not (code.isdigit() and len(code) == TOTP_DIGITS):
        return None
    current = int((at if at is not None else time.time()) // TOTP_PERIOD)
    for counter in (current - 1, current, current + 1):
        if last_counter is not None and counter <= last_counter:
            continue
        if hmac.compare_digest(_hotp(secret, counter), code):
            return counter
    return None


def totp_uri(secret: str, email: str) -> str:
    issuer = "LONI Admin"
    return (f"otpauth://totp/{quote(issuer)}:{quote(email)}?secret={secret}&issuer={quote(issuer)}"
            f"&algorithm=SHA1&digits={TOTP_DIGITS}&period={TOTP_PERIOD}")


# ── passwords ───────────────────────────────────────────────────────────────────────────────

def password_problem(password: str, email: str = "") -> Optional[str]:
    """A reason the password is too weak, or None."""
    if len(password) < 12:
        return "Password must be at least 12 characters."
    if len(password) > 128:
        return "Password must be at most 128 characters."
    if not any(c.islower() for c in password) or not any(c.isupper() for c in password):
        return "Password must mix upper and lower case letters."
    if not any(c.isdigit() for c in password):
        return "Password must include a number."
    local = email.split("@")[0].lower()
    if local and len(local) >= 4 and local in password.lower():
        return "Password must not contain your email address."
    return None


_dummy_hash: Optional[str] = None


def dummy_password_hash() -> str:
    """A real bcrypt hash, checked when the email is unknown so that reply takes as long as a real one."""
    global _dummy_hash
    if _dummy_hash is None:
        from app.core.security import get_password_hash
        _dummy_hash = get_password_hash(new_secret())
    return _dummy_hash
