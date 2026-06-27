from pydantic import BaseModel, EmailStr
from typing import Optional, List

class UserRegistrationRequest(BaseModel):
    """Validates the data coming from the frontend registration form."""
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str
    designation: Optional[str] = None
    company: Optional[str] = None # Used if they are a customer

class ChangeUsernameRequest(BaseModel):
    """Validates a user's request to change their handle."""
    new_username: str

