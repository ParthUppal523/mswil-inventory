from fastapi import FastAPI, HTTPException, Depends, status
from sqlalchemy.orm import Session
import models
import schemas
import auth_utils
from database import engine, get_db
from typing import Optional
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
import pdf_utils as pdf_utils
import os

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MSWIL Inventory System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # The URL of Next.js app
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

@app.post("/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticates a user and hands them a JWT token."""
    
    # Find the user by username
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    # Verify existence and password
    if not user or not auth_utils.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Verify they have been approved by an admin
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Account pending admin approval.")
        
    # Generate the JWT token with their username as the 'sub' (subject) and their role for authorization
    access_token = auth_utils.create_access_token(
        data={"sub": user.username, "role": user.role} 
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

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
    
    # Search the database for the user by their ID
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    # Validation Checks
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_approved:
        raise HTTPException(status_code=400, detail="User is already approved")
        
    # Update the approval status in Python, then save (commit) to PostgreSQL
    user.is_approved = True
    db.commit()
    
    # Trigger the utility function to simulate sending the welcome email
    auth_utils.send_approval_email(user.email, user.username)
    
    return {"message": f"User '{user.username}' has been approved and notified."}

@app.post("/inventory", response_model=schemas.InventoryItemResponse)
def add_inventory_item(
    item: schemas.InventoryItemCreate, 
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    """Admin workflow: Add a new physical part to the warehouse."""
    
    # Check if the explicitly provided item_code already exists
    existing_code = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == item.item_code).first()
    if existing_code:
        raise HTTPException(status_code=400, detail=f"Item code {item.item_code} is already in use.")

    # Check for duplicate serial numbers
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Workflow: Fetch items. Allows searching by code, name, or serial number."""
    
    # Base query that targets the whole table
    query = db.query(models.InventoryItem)
    
    # Dynamically apply filters if the admin provided them in the URL
    if item_code is not None:
        query = query.filter(models.InventoryItem.item_code == item_code)
        
    if item_name:
        query = query.filter(models.InventoryItem.item_name.ilike(f"%{item_name}%"))
        
    if serial_number:
        query = query.filter(models.InventoryItem.serial_number == serial_number)
        
    # Execute the final filtered query
    items = query.all()
    return items


@app.put("/inventory/{item_code}", response_model=schemas.InventoryItemResponse)
def update_inventory_item(
    item_code: int, 
    update_data: schemas.InventoryItemUpdate, 
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
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
def delete_inventory_item(
    item_code: int, 
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
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
def create_purchase_order(
    po_request: schemas.PurchaseOrderCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Customer workflow: Submit a PO with relevant details, handle backorders, deduct stock, 
    and generate PO & Invoice PDFs."""
    
    # Validate the Customer and fetch their details
    if not current_user or current_user.role != "customer":
        raise HTTPException(status_code=400, detail="Invalid customer ID or user is not a customer.")
    customer_profile = db.query(models.CustomerProfile).filter(models.CustomerProfile.user_id == current_user.id).first()
        
    # VALIDATION LOOP: Check all items for existence and stock before deducting anything
    is_backordered = False
    items_to_process = []
    
    # Iterate through the list of items the frontend sent in the cart
    for cart_item in po_request.items:
        db_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == cart_item.item_code).first()
        if not db_item:
            raise HTTPException(status_code=404, detail=f"Item code {cart_item.item_code} not found in inventory.")
            
        # If a single item lacks sufficient stock, the entire order is flagged as backordered
        if db_item.quantity < cart_item.ordered_quantity:
            is_backordered = True
            
        # Temporarily store the matched database object and requested quantity in memory
        items_to_process.append({"db_item": db_item, "req_qty": cart_item.ordered_quantity})

    # Create the Master PO Header
    new_po = models.PurchaseOrder(
        customer_id=current_user.id,
        status="Backordered" if is_backordered else "Approved",
        shipping_address=po_request.shipping_address,
        billing_address=po_request.billing_address
    )
    db.add(new_po)
    db.flush()

    # EXECUTION LOOP: Create Line Items, Deduct Stock, and Calculate Total
    pdf_item_list = [] 
    total_order_value = 0.0
    
    for item_data in items_to_process:
        db_item = item_data["db_item"]
        req_qty = item_data["req_qty"]
        
        # Add to the grand total
        total_order_value += (db_item.price * req_qty)
        
        # Create the Line Item linked to the Master PO Header
        line_item = models.PurchaseOrderItem(
            po_id=new_po.id,
            item_code=db_item.item_code,
            ordered_quantity=req_qty,
            unit_price=db_item.price
        )
        db.add(line_item)
        
        # Deduct stock ONLY if the overall PO is approved
        if not is_backordered:
            db_item.quantity -= req_qty
            
        # Build the dictionary for the PDF
        pdf_item_list.append({
            "code": db_item.item_code,
            "name": db_item.item_name,
            "serial": db_item.serial_number, 
            "quantity": req_qty,
            "price": db_item.price
        })

    new_po.total_amount = total_order_value

    # Save the GST number if previously not provided by the customer
    if customer_profile and po_request.gst_number and not customer_profile.gst_number:
        customer_profile.gst_number = po_request.gst_number
        
    # Commit all line items, stock deductions, and profile updates in one ACID transaction
    db.commit()
    db.refresh(new_po)

    # GENERATE PDFs (Only if Approved)
    if not is_backordered:
        customer_dict = {
            "company": customer_profile.organization_name if customer_profile else current_user.username,
            "email": current_user.email,
            "gst_number": customer_profile.gst_number if customer_profile else ""
        }
    
        address_dict = {
            "shipping": po_request.shipping_address,
            "billing": po_request.billing_address
        }
    
        po_file = f"purchase_orders/PO_{new_po.id}_{current_user.username}.pdf"
        inv_file = f"invoices/INV_{new_po.id}_{current_user.username}.pdf"
    
        # Generate the PO and Tax Invoice by passing the list of items (pdf_item_list)
        pdf_utils.generate_enterprise_pdf(po_file, "PURCHASE ORDER", new_po.id, customer_dict, pdf_item_list, address_dict)
        # pdf_utils.generate_enterprise_pdf(inv_file, "TAX INVOICE", new_po.id, customer_dict, pdf_item_list, address_dict)
    
    return new_po

@app.get("/purchase-orders", response_model=list[schemas.PurchaseOrderResponse])
def get_purchase_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Fetch all POs for the logged-in user (Customer or Admin)."""
    
    if current_user.role == "admin":
        # Admins can see all POs
        pos = db.query(models.PurchaseOrder).all()
    else:
        # Customers can only see their own POs
        pos = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.customer_id == current_user.id).all()
        
    return pos

@app.get("/purchase-orders/{po_id}/download")
def download_document(
    po_id: int, 
    doc_type: str="po", 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Endpoint for Admins and Customers to view/download the generated PO or Invoice PDF."""
    
    # 1. Find the PO and the associated customer
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
        
    customer = db.query(models.User).filter(models.User.id == po.customer_id).first()
    
    # 2. Determine which file path to construct based on the doc_type parameter
    if doc_type.lower() == "invoice":
        file_path = f"invoices/INV_{po_id}_{customer.username}.pdf"
        download_name = f"MSWIL_Invoice_{po_id}.pdf"
    else:
        file_path = f"purchase_orders/PO_{po_id}_{customer.username}.pdf"
        download_name = f"MSWIL_PO_{po_id}.pdf"
    
    # 3. Check if the file physically exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"The requested {doc_type.upper()} document was not found on the server.")
        
    # 4. Return the requested file
    return FileResponse(path=file_path, filename=download_name, media_type='application/pdf')

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to Motherson Sumi Wiring India Ltd. Inventory System API",
        "database": "Connected and schemas generated"
    }
