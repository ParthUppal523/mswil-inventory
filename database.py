import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Load the environment variables from the .env file
load_dotenv()

# Fetch the database URL 
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Create engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

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