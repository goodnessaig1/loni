# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Handle regular postgres URL for asyncpg
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    db_url, 
    echo=False, 
    pool_pre_ping=True,
    pool_recycle=300,
    # Sized for many concurrent calls/rides per process; see settings.DB_POOL_* (default pool is only 5+10).
    **({} if db_url.startswith("sqlite") else {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
    }),
    connect_args={
        "server_settings": {"jit": "off"},
        "statement_cache_size": 0  # Fixes issues with asyncpg and PgBouncer/Neon pooler
    }
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
