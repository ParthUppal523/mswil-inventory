import re
import models
from sqlalchemy.orm import Session
from passlib.context import CryptContext

# Initialize the password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Hashes a plaintext password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a hashed one during login."""
    return pwd_context.verify(plain_password, hashed_password)

def check_username_available(db: Session, username: str) -> bool:
    """Checks the database to see if a username is already taken."""
    user = db.query(models.User).filter(models.User.username == username).first()
    return user is None

def generate_unique_username(db: Session, first_name: str, last_name: str, role: str) -> str:
    """
    Generates a unique username.
    - Admins: firstname.lastname
    - Customers: firstname_lastname
    - Appends numbers (2, 3, etc.) if collisions occur.
    """
    # 1. Clean the names (convert to lowercase, strip spaces and special characters)
    fn = re.sub(r'[^a-z0-9]', '', first_name.lower().strip())
    ln = re.sub(r'[^a-z0-9]', '', last_name.lower().strip())
    
    # 2. Determine the correct separator based on role
    separator = "." if role.lower() == "admin" else "_"
    base_username = f"{fn}{separator}{ln}"
    
    username = base_username
    counter = 2
    
    # 3. Collision Handling: Loop until we find an available username
    while not check_username_available(db, username):
        username = f"{base_username}{counter}"
        counter += 1
        
    return username

def send_approval_email(email: str, username: str):
    """
    Mock function to simulate sending an email. 
    In a real app, this would use a library like 'smtplib' or an API like SendGrid.
    """
    print(f"\n{'='*40}")
    print(f"EMAIL DISPATCHED TO: {email}")
    print(f"SUBJECT: MSWIL Account Approved")
    print(f"BODY: Your account has been approved. Your Login ID is: {username}")
    print(f"{'='*40}\n")