from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional, List

# --- TOKEN SCHEMAS ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    login_id: Optional[str] = None

# --- USER SCHEMAS ---
class UserRegistrationRequest(BaseModel):
    """Validates the data coming from the frontend registration form."""
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str
    contact_phone: Optional[str] = None
    designation: Optional[str] = None
    company: Optional[str] = None # Used if they are a customer

class ChangeUsernameRequest(BaseModel):
    """Validates a user's request to change their handle."""
    new_username: str

# --- INVENTORY SCHEMAS ---
class InventoryItemBase(BaseModel):
    """Base schema containing the shared attributes for an inventory item."""
    item_code: int
    item_name: str
    serial_number: str
    quantity: int
    price: float
    description: Optional[str] = ""

class InventoryItemCreate(InventoryItemBase):
    """Schema used when an Admin creates a new item."""
    pass # inherits everything as defined in the Base

class InventoryItemUpdate(BaseModel):
    """Schema used when updating stock."""
    item_name: Optional[str] = None
    serial_number: Optional[str] = None
    quantity: Optional[int] = None
    price: Optional[float] = None
    description: Optional[str] = None

class InventoryItemResponse(InventoryItemBase):
    """Schema used when sending inventory data back to the frontend."""
    item_code: int

    class Config:
        # Read data directly from the SQLAlchemy ORM model
        from_attributes = True

# --- PURCHASE ORDER SCHEMAS ---

class PurchaseOrderBase(BaseModel):
    """Base schema for a Purchase Order."""
    shipping_address: Optional[str] = None
    billing_address: Optional[str] = None
    
class POItemCreate(BaseModel):
    """Represents a single line item in a Purchase Order."""
    item_code: int
    ordered_quantity: int

class PurchaseOrderCreate(PurchaseOrderBase):
    """Schema used when a Customer submits a new PO."""
    gst_number: Optional[str] = None
    items: List[POItemCreate]

class PurchaseOrderResponse(PurchaseOrderBase):
    """Schema used to send the confirmed PO back to the frontend."""
    id: int
    customer_id: int
    status: str
    total_amount: Optional[float] = None
    created_at: datetime
    customer_name: Optional[str] = None
    organization_name: Optional[str] = None
    invoiced_by_id: Optional[int] = None 
    invoiced_by_name: Optional[str] = None

    class Config:
        from_attributes = True