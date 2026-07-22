from sqlalchemy import Column, Integer, String, ForeignKey, Float, Text, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from database import Base

# 1. CORE AUTHENTICATION TABLE
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    
    # Store names in the core table so the backend can generate the usernames
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    
    role = Column(String, default="customer") # 'admin' or 'customer'
    designation = Column(String)

    is_approved = Column(Boolean, default=False) 

    # Relationships to profiles
    customer_profile = relationship("CustomerProfile", back_populates="user", uselist=False)
    employee_profile = relationship("EmployeeProfile", back_populates="user", uselist=False)


# 2. CUSTOMER SPECIFIC DATA
class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    organization_name = Column(String, index=True)
    gst_number = Column(String, unique=True, index=True)
    billing_address = Column(Text)
    shipping_address = Column(Text)
    contact_phone = Column(String)

    user = relationship("User", back_populates="customer_profile")


# 3. EMPLOYEE/ADMIN SPECIFIC DATA
class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    employee_id_number = Column(String, unique=True, index=True)
    department = Column(String)

    user = relationship("User", back_populates="employee_profile")


# 4. INVENTORY TABLE
class InventoryItem(Base):
    __tablename__ = "inventory_items"

    item_code = Column(Integer, primary_key=True, index=True)
    item_name = Column(String, index=True)
    serial_number = Column(String, unique=True, index=True)
    quantity = Column(Integer, default=0)
    price = Column(Float, default=0.0)
    description = Column(String, default="")


# 5. PURCHASE ORDERS
class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"))
    total_amount = Column(Float, default=0.0)
    status = Column(String, default="Pending") # Pending, Approved, Insufficient Stock

    shipping_address = Column(String, nullable=True)
    billing_address = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"))
    item_code = Column(Integer, ForeignKey("inventory_items.item_code"))
    ordered_quantity = Column(Integer)
    unit_price = Column(Float)
