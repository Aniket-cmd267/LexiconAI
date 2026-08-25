from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import DATABASE_URL

# Ensure the database URL is available before creating the engine.
if not DATABASE_URL:
    raise ValueError("DATABASE_URL must be configured in your .env file")

# Create the database engine
engine = create_engine(
    DATABASE_URL,
    pool_recycle=3600,
    pool_pre_ping=True
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for ORM models
Base = declarative_base()

def get_db():
    """Dependency that provides a database session to API routes and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()