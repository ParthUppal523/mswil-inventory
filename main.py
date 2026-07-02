from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
import models
import schemas
import auth_utils
from database import engine, get_db
from typing import Optional

models.Base.metadata.create_all(bind=engine)


app = FastAPI(title="MSWIL Inventory System API")

@app.post("/register")
def register_user(request: schemas.UserRegistrationRequest, db: Session = Depends(get_db)):
    # Ensure email is not already in use
    if db.query(models.User).filter(models.User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Generate the unique username securely
    unique_username = auth_utils.generate_unique_username(db, request.first_name, request.last_name, request.role)

    # Hash the password before storing it
    hashed_pw = auth_utils.get_password_hash(request.password)

    # Create the base user
    new_user = models.User(
        email=request.email,
        username=unique_username,
        password_hash=hashed_pw,
        first_name=request.first_name,
        last_name=request.last_name,
        role=request.role,
        designation=request.designation
    )
    
    # Save the base user to the database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create the associated profile based on role
    if request.role.lower() == "customer":
        profile = models.CustomerProfile(user_id=new_user.id, organization_name=request.company)
        db.add(profile)
    else:
        profile = models.EmployeeProfile(user_id=new_user.id, department=request.designation)
        db.add(profile)
        
    db.commit()

    return {
        "message": "Registration submitted successfully. Pending admin approval.", 
        "assigned_username": unique_username
    }

@app.put("/admin/approve-user/{user_id}")
def approve_user(user_id: int, db: Session = Depends(get_db)):
    """Endpoint for an admin to approve a new user account."""
    
    # 1. Search the database for the user by their ID
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    # 2. Validation Checks
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_approved:
        raise HTTPException(status_code=400, detail="User is already approved")
        
    # 3. Update the approval status in Python, then save (commit) to PostgreSQL
    user.is_approved = True
    db.commit()
    
    # 4. Trigger the utility function to simulate sending the welcome email
    auth_utils.send_approval_email(user.email, user.username)
    
    return {"message": f"User '{user.username}' has been approved and notified."}

@app.post("/inventory", response_model=schemas.InventoryItemResponse)
def add_inventory_item(item: schemas.InventoryItemCreate, db: Session = Depends(get_db)):
    """Admin workflow: Add a new physical part to the warehouse."""
    
    # 1. Check if the explicitly provided item_code already exists
    existing_code = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == item.item_code).first()
    if existing_code:
        raise HTTPException(status_code=400, detail=f"Item code {item.item_code} is already in use.")

    # 2. Check for duplicate serial numbers
    existing_serial = db.query(models.InventoryItem).filter(models.InventoryItem.serial_number == item.serial_number).first()
    if existing_serial:
        raise HTTPException(status_code=400, detail=f"An item with this Serial Number ({item.serial_number}) already exists.")
    
    # Map the validated Pydantic data to SQLAlchemy database model
    new_item = models.InventoryItem(
        item_code=item.item_code, 
        item_name=item.item_name,
        serial_number=item.serial_number,
        quantity=item.quantity,
        price=item.price,
        description=item.description
    )
    
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    return new_item


@app.get("/inventory", response_model=list[schemas.InventoryItemResponse])
def get_all_inventory(
    item_code: Optional[int] = None, 
    item_name: Optional[str] = None, 
    serial_number: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    """Workflow: Fetch items. Allows searching by code, name, or serial number."""
    
    # 1. Base query that targets the whole table
    query = db.query(models.InventoryItem)
    
    # 2. Dynamically apply filters if the admin provided them in the URL
    if item_code is not None:
        query = query.filter(models.InventoryItem.item_code == item_code)
        
    if item_name:
        query = query.filter(models.InventoryItem.item_name.ilike(f"%{item_name}%"))
        
    if serial_number:
        query = query.filter(models.InventoryItem.serial_number == serial_number)
        
    # 3. Execute the final filtered query
    items = query.all()
    return items


@app.put("/inventory/{item_code}", response_model=schemas.InventoryItemResponse)
def update_inventory_item(item_code: int, update_data: schemas.InventoryItemUpdate, db: Session = Depends(get_db)):
    """Admin workflow: Update the stock quantity, price, or details of an existing item."""
    
    db_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == item_code).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found in inventory.")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    
    for key, value in update_dict.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    
    return db_item

@app.delete("/inventory/{item_code}")
def delete_inventory_item(item_code: int, db: Session = Depends(get_db)):
    """Admin workflow: Permanently remove an item from the warehouse."""
    
    # Fetch the item to delete
    db_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == item_code).first()
    
    # Validation: Ensure the item actually exists
    if not db_item:
        raise HTTPException(status_code=404, detail="Inventory item not found.")
        
    # Delete the object and save the change
    db.delete(db_item)
    db.commit()
    
    return {"message": f"Item code {item_code} has been successfully deleted from inventory."}

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to Motherson Sumi Wiring India Ltd. Inventory System API",
        "database": "Connected and schemas generated"
    }
