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
    
    MONGODB_URI: str = "mongodb://localhost:27017"

    OPENAI_API_KEY: str = ""
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
