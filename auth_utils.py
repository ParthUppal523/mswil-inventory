import os
import re
import bcrypt
import jwt
import models
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from database import get_db
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

# --- JWT CONFIGURATION ---
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # 1 hour expiration for security

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- PASSWORD HASHING & VERIFICATION ---
def get_password_hash(password: str) -> str:
    """Hashes a plaintext password using bcrypt."""
    # Encode the password to bytes, generate a salt, and hash it
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(pwd_bytes, salt)
    
    # Decode back to a standard string so PostgreSQL can store it
    return hashed_bytes.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a hashed one during login."""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# --- USERNAME GENERATION & EMAILS ---

def check_username_available(db: Session, username: str) -> bool:
    """Checks the database to see if a username is already taken."""
    user = db.query(models.User).filter(models.User.username == username).first()
    return user is None

def generate_unique_username(db: Session, first_name: str, last_name: str, role: str) -> str:
    """
    Generates a unique username based on industry standards.
    - Admins: firstname.lastname
    - Customers: firstname_lastname
    - Appends numbers (2, 3, etc.) if collisions occur.
    """
    fn = re.sub(r'[^a-z0-9]', '', first_name.lower().strip())
    ln = re.sub(r'[^a-z0-9]', '', last_name.lower().strip())
    
    separator = "." if role.lower() == "admin" else "_"
    base_username = f"{fn}{separator}{ln}"
    
    username = base_username
    counter = 2
    
    while not check_username_available(db, username):
        username = f"{base_username}{counter}"
        counter += 1
        
    return username

def create_access_token(data: dict):
    """Creates the encrypted JWT token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # Cryptographically sign the token using the secret key
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    This function intercepts requests, decrypts the token, 
    and fetches the exact user from the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the token using the secret key
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Extract the username embedded during login
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise credentials_exception
        
    # Find the user in the database
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
        
    return user

def get_current_admin(current_user: models.User = Depends(get_current_user)):
    """Checks if the verified user has Admin privileges."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You do not have permission to perform this action. Admins only."
        )
    return current_user

def send_approval_email(email: str, username: str):
    """
    Mock function to simulate sending an email. 
    In the real app, this would use a library like 'smtplib' or an API like SendGrid.
    """
    print(f"\n{'='*40}")
    print(f"EMAIL DISPATCHED TO: {email}")
    print(f"SUBJECT: MSWIL Account Approved")
    print(f"BODY: Your account has been approved. Your Login ID is: {username}")
    print(f"{'='*40}\n")