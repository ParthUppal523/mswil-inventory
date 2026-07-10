from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
import models
import schemas
import auth_utils
from database import engine, get_db
from typing import Optional
from fastapi.responses import FileResponse
import pdf_utils
import os

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

@app.post("/purchase-order", response_model=schemas.PurchaseOrderResponse)
def create_purchase_order(po_request: schemas.PurchaseOrderCreate, db: Session = Depends(get_db)):
    """Customer workflow: Submit a PO, handle backorders, deduct stock, and generate PDFs."""
    
    # 1. Validate the Customer
    customer = db.query(models.User).filter(models.User.id == po_request.customer_id).first()
    if not customer or customer.role != "customer":
        raise HTTPException(status_code=400, detail="Invalid customer ID or user is not a customer.")
        
    # 2. Fetch the Inventory Item details
    inventory_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == po_request.item_id).first()
    if not inventory_item:
        raise HTTPException(status_code=404, detail="Item not found in inventory.")
        
    # 3. Insufficient Stock Handling: If the requested quantity exceeds available stock, mark as "Backordered" 
    if inventory_item.quantity < po_request.ordered_quantity:
        # Do not deduct stock. Simply record the PO as "Backordered".
        backordered_po = models.PurchaseOrder(
            customer_id=po_request.customer_id,
            item_id=po_request.item_id,
            ordered_quantity=po_request.ordered_quantity,
            status="Backordered" # Admin will see this status and know they need more stock
        )
        db.add(backordered_po)
        db.commit()
        db.refresh(backordered_po)
        
        # The frontend will see status="Backordered" and can display a 
        # message like "Requirement recorded. Pending stock availability."
        return backordered_po
        
    # 4. SUCCESSFUL EXECUTION: Deduct stock and create the approved order
    inventory_item.quantity -= po_request.ordered_quantity
    
    new_po = models.PurchaseOrder(
        customer_id=po_request.customer_id,
        item_id=po_request.item_id,
        ordered_quantity=po_request.ordered_quantity,
        status="Approved"
    )
    
    db.add(new_po)
    db.commit()
    db.refresh(new_po)

    # 5. GENERATE THE PDF (Only happens if sufficient stock is available)
    total_price = inventory_item.price * po_request.ordered_quantity
    
    pdf_utils.generate_po_pdf(
        po_id=new_po.id,
        customer_username=customer.username,
        item_name=inventory_item.item_name,
        quantity=po_request.ordered_quantity,
        total_price=total_price,
        status=new_po.status
    )
    
    return new_po

@app.get("/purchase-orders/{po_id}/pdf")
def download_po_pdf(po_id: int, db: Session = Depends(get_db)):
    """Endpoint for Admins and Customers to view/download the generated PO PDF."""
    
    # 1. Find the PO and the associated customer
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
        
    customer = db.query(models.User).filter(models.User.id == po.customer_id).first()
    
    # 2. Construct the expected file path where the PDF was saved
    file_path = f"purchase_orders/PO_{po_id}_{customer.username}.pdf"
    
    # 3. Check if the file physically exists on the server's hard drive
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF document not found on server.")
        
    # 4. Return the file directly as a downloadable/viewable attachment
    return FileResponse(path=file_path, filename=f"MSWIL_PO_{po_id}.pdf", media_type='application/pdf')

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to Motherson Sumi Wiring India Ltd. Inventory System API",
        "database": "Connected and schemas generated"
    }
