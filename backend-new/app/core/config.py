from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Loni Backend"
    API_V1_STR: str = "/api/v1"
    FRONTEND_URL: str = "http://localhost:8081"
    
    # Database
    DATABASE_URL: str = ""
    
    # Security
    SECRET_KEY: str = "super_secret_key_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # Email/Brevo
    BREVO_API_KEY: Optional[str] = None
    BREVO_SENDER_EMAIL: str = "goodness6337@gmail.com"
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    
    # Firebase
    FIREBASE_SERVICE_ACCOUNT: Optional[str] = None
    
    MONGODB_URI: str = "mongodb://localhost:27017"

    # LiveKit
    # LIVEKIT_URL: the URL the *backend* uses to reach LiveKit's REST/webhook
    # API. In docker-compose this should be the internal service name
    # (e.g. http://livekit:7880), NOT a developer's LAN IP - see Issue 9.
    LIVEKIT_URL: str = ""
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""
    # LIVEKIT_PUBLIC_URL: the wss:// URL mobile clients connect to. This is
    # the one piece of LiveKit config that MUST be reachable from a phone on
    # cellular data, not just the developer's WiFi - see Issue 9. The backend
    # hands this to clients in CallActionResponse.livekit_url so the app
    # never has to hardcode it.
    LIVEKIT_PUBLIC_URL: str = ""

    # --- APNs VoIP (PushKit) ---
    # Issue 4's hard requirement: FCM/APNs "remote-notification" pushes are
    # NOT guaranteed to wake a fully force-quit iOS app - Apple only
    # guarantees that for a PushKit VoIP push, and ONLY if the app reports
    # the call to CallKit immediately upon receiving it (which
    # loni-server-app now does - see lib/callKeepService.ts /
    # lib/voipPush.ts). VoIP pushes cannot be sent through Firebase/FCM at
    # all (FCM has no "voip" push type) - they must go directly to Apple's
    # APNs HTTP/2 API. This requires real Apple Developer credentials this
    # sandbox cannot generate:
    #   1. An APNs Auth Key (.p8) with the "Apple Push Notifications
    #      service (APNs)" capability enabled - created in
    #      https://developer.apple.com/account/resources/authkeys/list
    #   2. Its Key ID (shown when you create it) -> APNS_KEY_ID
    #   3. Your Apple Developer Team ID -> APNS_TEAM_ID
    #   4. The iOS bundle identifier -> APNS_BUNDLE_ID (must match
    #      loni-server-app/app.json's ios.bundleIdentifier, "com.loni.server")
    #   5. The app target must have the "Push Notifications" and
    #      "Background Modes -> Voice over IP" capabilities enabled in
    #      Xcode / the Apple Developer portal (app.json already declares
    #      UIBackgroundModes: ["voip", ...] - the portal-side capability
    #      still needs to be turned on for the App ID).
    # Paste the raw contents of the downloaded .p8 file (including the
    # -----BEGIN/END PRIVATE KEY----- lines) into APNS_VOIP_AUTH_KEY,
    # same pattern already used for FIREBASE_SERVICE_ACCOUNT below.
    APNS_VOIP_AUTH_KEY: Optional[str] = None
    APNS_KEY_ID: Optional[str] = None
    APNS_TEAM_ID: Optional[str] = None
    APNS_BUNDLE_ID: str = "com.loni.server"
    # True until you have a production build signed with a production APNs
    # cert/profile - sandbox and production APNs are different hosts and a
    # token from the wrong environment will be silently rejected (BadDeviceToken).
    APNS_USE_SANDBOX: bool = True

    OPENAI_API_KEY: str = ""
    ABACUS_API_KEY: str = ""
    AI_ENVIRONMENT: str = "production" # "production" or "local"
    OLLAMA_BASE_URL: str = "http://localhost:11434/v1"
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
