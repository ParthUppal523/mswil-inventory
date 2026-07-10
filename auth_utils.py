import re
import bcrypt
import models
from sqlalchemy.orm import Session

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