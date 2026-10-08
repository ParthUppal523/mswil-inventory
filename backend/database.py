import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Load environment variables from local .env files during development
load_dotenv()

DEFAULT_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5432/mswil_inventory"

# Prefer the Render/Vercel environment variable but fall back to a local dev database.
raw_database_url = os.getenv("DATABASE_URL")
if raw_database_url:
    # Handles both 'postgres://' (Render/Heroku standard) and 'postgresql://' (Neon standard)
    if raw_database_url.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = raw_database_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif raw_database_url.startswith("postgresql://"):
        SQLALCHEMY_DATABASE_URL = raw_database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    else:
        SQLALCHEMY_DATABASE_URL = raw_database_url
else:
    SQLALCHEMY_DATABASE_URL = DEFAULT_DATABASE_URL

# Create engine with psycopg2-compatible dialect
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

# Create database sessions for API requests
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base Class
Base = declarative_base()

# Get database sessions
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()