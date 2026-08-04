from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks
from sqlalchemy.orm import Session
import models
import schemas
import auth_utils
from database import engine, get_db
from typing import Optional
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
import pdf_utils
import logger_utils
import os
import calendar
from datetime import datetime, timedelta
from sqlalchemy import or_, cast, String

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
def register_user(request: schemas.UserRegistrationRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Ensure email is not already in use
    if db.query(models.User).filter(models.User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if request.role.lower() == "admin":
        if not auth_utils.is_valid_admin_request(request.email, request.company):
            raise HTTPException(
                status_code=403, 
                detail="Admin registration requires a valid Motherson email domain or organization name."
            )

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

    background_tasks.add_task(
        logger_utils.notify_admins, 
        db, 
        "New Registration Pending", 
        f"A new user ({new_user.username}) has registered for {request.company} and requires approval."
    )

    return {
        "message": "Registration submitted successfully. Pending admin approval.", 
        "assigned_username": unique_username
    }

@app.put("/admin/approve-user/{user_id}")
def approve_user(
    user_id: int,
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db), 
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    """Endpoint for an admin to approve a new user account."""
    
    # Search the database for the user by their ID
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    # Validation Checks
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "admin": raise HTTPException(status_code=403, detail="Admins cannot approve other admins.")
    
    if user.is_approved:
        raise HTTPException(status_code=400, detail="User is already approved")
        
    # Update the approval status in Python, then save (commit) to PostgreSQL
    user.is_approved = True
    db.commit()
    
    # Trigger the utility function to simulate sending the welcome email
    auth_utils.send_approval_email(user.email, user.username)

    background_tasks.add_task(logger_utils.log_admin_activity, db, admin_user, "APPROVE", "User", user_id)
    
    return {"message": f"User '{user.username}' has been approved and notified."}

@app.get("/admin/customers")
def get_all_customers(
    skip: int = 0, 
    limit: int = 50, 
    search: Optional[str] = None, 
    search_scope: Optional[str] = "all", 
    status: Optional[str] = "all", 
    sort_by: Optional[str] = "default",
    db: Session = Depends(get_db), 
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    """Admin workflow: Fetch customer details"""
    query = db.query(models.User).filter(models.User.role == "customer")
    
    if status == "approved": query = query.filter(models.User.is_approved == True)
    elif status == "pending": query = query.filter(models.User.is_approved == False)

    query = query.outerjoin(models.CustomerProfile, models.User.id == models.CustomerProfile.user_id)

    if search:
        search_term = f"%{search}%"
        if search_scope == "id":
            try: query = query.filter(models.User.id == int(search))
            except ValueError: pass
        elif search_scope == "name":
            query = query.filter(or_(models.User.first_name.ilike(search_term), models.User.last_name.ilike(search_term)))
        elif search_scope == "org":
            query = query.filter(models.CustomerProfile.organization_name.ilike(search_term))
        elif search_scope == "email":
            query = query.filter(models.User.email.ilike(search_term))
        else:
            query = query.filter(
                or_(
                    models.User.id.cast(String).ilike(search_term),
                    models.User.first_name.ilike(search_term),
                    models.User.last_name.ilike(search_term),
                    models.CustomerProfile.organization_name.ilike(search_term),
                    models.User.email.ilike(search_term)
                )
            )

    if sort_by == "org_asc": 
        query = query.order_by(models.CustomerProfile.organization_name.asc())
    elif sort_by == "org_desc": 
        query = query.order_by(models.CustomerProfile.organization_name.desc())
    else: 
        query = query.order_by(models.User.id.desc())

    total = query.count()
    customers = query.offset(skip).limit(limit).all()

    result = []
    for c in customers:
        profile = db.query(models.CustomerProfile).filter(models.CustomerProfile.user_id == c.id).first()
        result.append({
            "id": c.id, 
            "name": f"{c.first_name} {c.last_name}".strip() or c.username,
            "username": c.username, 
            "email": c.email,
            "organization": profile.organization_name if profile else "Individual Customer",
            "department": None, 
            "is_approved": c.is_approved
        })

    return {"data": result, "total": total, "skip": skip, "limit": limit}

@app.put("/admin/revoke-user/{user_id}")
def revoke_user(
    user_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin": raise HTTPException(status_code=403, detail="Admins cannot revoke other admins.")
        
    user.is_approved = False
    db.commit()

    background_tasks.add_task(logger_utils.log_admin_activity, db, admin_user, "REVOKE", "User", user_id)
    return {"message": "User access has been revoked successfully."}

@app.delete("/admin/users/{user_id}")
def delete_user(
    user_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin": raise HTTPException(status_code=403, detail="Security protocol: Admins cannot delete other admins.")
        
    try:
        db.delete(user)
        db.commit()
        background_tasks.add_task(logger_utils.log_admin_activity, db, admin_user, "DELETE", "User", user_id)
        return {"message": f"User {user.username} deleted successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Cannot delete a user who has existing Purchase Orders. Please 'Revoke' their access instead.")

@app.post("/inventory", response_model=schemas.InventoryItemResponse)
def add_inventory_item(
    item: schemas.InventoryItemCreate, 
    background_tasks: BackgroundTasks,
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

    background_tasks.add_task(
        logger_utils.log_admin_activity, 
        db, admin_user, "CREATE", "InventoryItem", new_item.item_code
    )
    
    return new_item


@app.get("/inventory")
def get_all_inventory(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    search_scope: Optional[str] = "all",
    status: Optional[str] = "all",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Workflow: Fetch paginated items with server-side filtering."""
    query = db.query(models.InventoryItem)
    
    # 1. Apply Status Filter
    if status == "in_stock":
        query = query.filter(models.InventoryItem.quantity > 0)
    elif status == "out_of_stock":
        query = query.filter(models.InventoryItem.quantity <= 0)

    # 2. Apply Text Search Filter
    if search:
        search_term = f"%{search}%"
        if search_scope == "code":
            try: query = query.filter(models.InventoryItem.item_code == int(search))
            except ValueError: pass
        elif search_scope == "name":
            query = query.filter(
                or_(
                    models.InventoryItem.item_name.ilike(search_term),
                    models.InventoryItem.description.ilike(search_term)
                )
            )
        else: # "all" fields
            query = query.filter(
                or_(
                    models.InventoryItem.item_name.ilike(search_term),
                    models.InventoryItem.description.ilike(search_term),
                    models.InventoryItem.serial_number.ilike(search_term),
                    models.InventoryItem.item_code.cast(String).ilike(search_term)
                )
            )

    # 3. Calculate Total Rows
    total_count = query.count()

    # 4. Apply Pagination
    items = query.order_by(models.InventoryItem.item_code.asc()).offset(skip).limit(limit).all()

    return {
        "data": items,
        "total": total_count,
        "skip": skip,
        "limit": limit
    }


@app.put("/inventory/{item_code}", response_model=schemas.InventoryItemResponse)
def update_inventory_item(
    item_code: int, 
    update_data: schemas.InventoryItemUpdate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    """Admin workflow: Update the stock quantity, price, or details of an existing item."""
    
    db_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == item_code).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found in inventory.")

    # Capture old state for logging
    old_data = db_item.__dict__.copy()
    
    update_dict = update_data.model_dump(exclude_unset=True)
    
    for key, value in update_dict.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)

    # Capture new state and generate the delta for logging
    new_data = db_item.__dict__.copy()
    changes = logger_utils.generate_delta(old_data, new_data)

    # --- PERFORM BACKGROUND LOG (Only if something actually changed) ---
    if changes:
        background_tasks.add_task(
            logger_utils.log_admin_activity, 
            db, admin_user, "UPDATE", "InventoryItem", item_code, changes
        )
    
    return db_item

@app.delete("/inventory/{item_code}")
def delete_inventory_item(
    item_code: int,
    background_tasks: BackgroundTasks,
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

    # Log the deletion activity
    background_tasks.add_task(
        logger_utils.log_admin_activity, 
        db, admin_user, "DELETE", "InventoryItem", item_code
    )
    
    return {"message": f"Item code {item_code} has been successfully deleted from inventory."}

@app.put("/admin/purchase-orders/{po_id}/invoice", response_model=schemas.PurchaseOrderResponse)
def admin_generate_invoice(
    po_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    """Admin workflow: Generate a Tax Invoice for an approved PO and update its status."""
    
    # Fetch the Purchase Order
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    
    if po.status != "Approved":
        raise HTTPException(status_code=400, detail="You can only generate invoices for 'Approved' orders.")
        
    # Fetch Customer Details
    customer = db.query(models.User).filter(models.User.id == po.customer_id).first()
    profile = db.query(models.CustomerProfile).filter(models.CustomerProfile.user_id == po.customer_id).first()
    
    # Fetch Line Items and reconstruct the list for the PDF Generator
    po_items = db.query(models.PurchaseOrderItem).filter(models.PurchaseOrderItem.po_id == po.id).all()
    pdf_item_list = []
    
    for item in po_items:
        inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == item.item_code).first()
        pdf_item_list.append({
            "code": item.item_code,
            "name": inv_item.item_name if inv_item else "Unknown Item",
            "serial": inv_item.serial_number if inv_item else "",
            "quantity": item.ordered_quantity,
            "price": item.unit_price
        })
        
    # Prepare Dictionaries for PDF Generator
    customer_dict = {
        "company": profile.organization_name if profile else customer.username,
        "email": customer.email,
        "gst_number": profile.gst_number if profile else ""
    }
    
    address_dict = {
        "shipping": po.shipping_address,
        "billing": po.billing_address
    }
    
    # Ensure invoices directory exists
    os.makedirs("invoices", exist_ok=True)
    inv_file = f"invoices/INV_{po.id}_{customer.username}.pdf"

    # Meta information for the PDF 
    meta_dict = {
        "admin_name": f"{admin_user.first_name} {admin_user.last_name}".strip() or admin_user.username,
        "buyer_name": f"{customer.first_name} {customer.last_name}".strip() or customer.username,
        "invoice_date": datetime.now().strftime('%d-%b-%Y'),
        "po_ref": str(po.id)
    }
    
    # Generate the Invoice PDF
    pdf_utils.generate_enterprise_pdf(inv_file, "TAX INVOICE", po.id, customer_dict, pdf_item_list, address_dict, meta_dict)
    
    # Update Status to Invoiced and Save
    po.status = "Invoiced"
    po.invoiced_by_id = admin_user.id
    db.commit()
    db.refresh(po)

    background_tasks.add_task(
        logger_utils.log_admin_activity, 
        db, admin_user, "INVOICE", "PurchaseOrder", po.id
    )
    
    return po

# Backorder Resolution Workflow
@app.get("/admin/purchase-orders/{po_id}/items")
def get_po_requirements(
    po_id: int, 
    db: Session = Depends(get_db), 
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    """Admin Workflow: Fetches the line items of a PO and compares them against current live stock."""
    po_items = db.query(models.PurchaseOrderItem).filter(models.PurchaseOrderItem.po_id == po_id).all()
    
    result = []
    for item in po_items:
        # Join with Inventory to get live stock data
        inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == item.item_code).first()
        
        result.append({
            "item_code": item.item_code,
            "item_name": inv_item.item_name if inv_item else f"Item #{item.item_code}",
            "requested_quantity": item.ordered_quantity,
            "current_stock": inv_item.quantity if inv_item else 0,
            "price": item.unit_price
        })
        
    return result


@app.put("/admin/purchase-orders/{po_id}/approve")
def approve_backordered_po(
    po_id: int, 
    db: Session = Depends(get_db), 
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    """Resolves a backorder by verifying stock, deducting inventory, and generating the PDF."""
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    if po.status != "Backordered":
        raise HTTPException(status_code=400, detail="The PO is already approved or invoiced.")

    po_items = db.query(models.PurchaseOrderItem).filter(models.PurchaseOrderItem.po_id == po_id).all()
    
    # VERIFICATION PASS: Ensure sufficient stock exists for all items
    for item in po_items:
        inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == item.item_code).first()
        if not inv_item or inv_item.quantity < item.ordered_quantity:
            available = inv_item.quantity if inv_item else 0
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot approve. Insufficient stock for {inv_item.item_name if inv_item else 'Item #'+str(item.item_code)}. Required: {item.ordered_quantity}, Available: {available}"
            )

    # EXECUTION PASS: Safely deduct stock
    for item in po_items:
        inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == item.item_code).first()
        inv_item.quantity -= item.ordered_quantity
    
    # UPDATE PO STATUS
    po.status = "Approved"
    db.commit()

    # GENERATE PDF
    try:
        # Reconstruct Customer & Address details for the PDF generator
        customer = db.query(models.User).filter(models.User.id == po.customer_id).first()
        profile = db.query(models.CustomerProfile).filter(models.CustomerProfile.user_id == customer.id).first() if customer else None
        
        customer_dict = {
            "company": profile.organization_name if profile else customer.username,
            "email": customer.email,
            "gst_number": po.gst_number if po.gst_number else (profile.gst_number if profile else "")
        }
        
        address_dict = {
            "shipping": po.shipping_address,
            "billing": po.billing_address
        }

        meta_dict = {
            "buyer_name": f"{customer.first_name} {customer.last_name}".strip() or customer.username,
            "po_date": po.created_at.strftime('%d-%b-%Y') if po.created_at else datetime.now().strftime('%d-%b-%Y')
        }

        pdf_item_list = []
        for i in po_items:
            inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == i.item_code).first()
            pdf_item_list.append({
                "code": i.item_code, 
                "name": inv_item.item_name if inv_item else f"Item #{i.item_code}", 
                "quantity": i.ordered_quantity, 
                "price": i.price_at_order
            })

        po_file = f"purchase_orders/PO_{po.id}_{customer.username}.pdf"
        pdf_utils.generate_enterprise_pdf(po_file, "PURCHASE ORDER", po.id, customer_dict, pdf_item_list, address_dict, meta_dict)
    except Exception as e:
        print(f"PDF Generation failed during backorder approval: {e}")

    # LOGGING & NOTIFICATIONS
    new_log = models.AdminActivityLog(
        admin_id=admin_user.id, 
        admin_name=f"{admin_user.first_name} {admin_user.last_name}".strip() or admin_user.username,
        admin_email=admin_user.email, action_type="APPROVE", entity_type="PurchaseOrder", entity_id=po.id,
        changes={"status": {"old": "Backordered", "new": "Approved"}}
    )
    db.add(new_log)
    
    new_notif = models.Notification(
        recipient_id=po.customer_id, title="Backorder PO Approved",
        message=f"Stock has been successfully secured and your Purchase Order #{po.id} has been Approved."
    )
    db.add(new_notif)
    db.commit()

    return {"message": "Purchase Order approved, stock deducted, and PDF generated successfully."}

@app.get("/admin/activity-logs")
def get_activity_logs(
    skip: int = 0, 
    limit: int = 50, 
    search: Optional[str] = None, 
    search_scope: Optional[str] = "all", 
    status: Optional[str] = "all", 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    db: Session = Depends(get_db), 
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    """Admin workflow: Fetch the immutable audit trail."""
    query = db.query(models.AdminActivityLog)
    
    if status and status != "all":
        query = query.filter(models.AdminActivityLog.action_type.ilike(status))

    if start_date: query = query.filter(models.AdminActivityLog.timestamp >= start_date)
    if end_date: query = query.filter(models.AdminActivityLog.timestamp <= end_date + " 23:59:59")

    if search:
        search_term = f"%{search}%"
        if search_scope == "admin": query = query.filter(or_(models.AdminActivityLog.admin_name.ilike(search_term), models.AdminActivityLog.admin_email.ilike(search_term)))
        elif search_scope == "entity": query = query.filter(or_(models.AdminActivityLog.entity_type.ilike(search_term), models.AdminActivityLog.entity_id.ilike(search_term)))
        else:
            query = query.filter(or_(
                models.AdminActivityLog.admin_name.ilike(search_term),
                models.AdminActivityLog.admin_email.ilike(search_term),
                models.AdminActivityLog.entity_type.ilike(search_term),
                models.AdminActivityLog.entity_id.ilike(search_term)
            ))

    total = query.count()
    logs = query.order_by(models.AdminActivityLog.timestamp.desc()).offset(skip).limit(limit).all()
    return {"data": logs, "total": total, "skip": skip, "limit": limit}

@app.post("/purchase-order", response_model=schemas.PurchaseOrderResponse)
def create_purchase_order(
    po_request: schemas.PurchaseOrderCreate, 
    background_tasks: BackgroundTasks,
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
        # inv_file = f"invoices/INV_{new_po.id}_{current_user.username}.pdf"

        # Meta information for the PDF
        meta_dict = {
            "buyer_name": f"{current_user.first_name} {current_user.last_name}".strip() or current_user.username,
            "po_date": datetime.now().strftime('%d-%b-%Y')
        }
    
        # Generate the PO and Tax Invoice by passing the list of items (pdf_item_list)
        pdf_utils.generate_enterprise_pdf(po_file, "PURCHASE ORDER", new_po.id, customer_dict, pdf_item_list, address_dict, meta_dict)
    
    background_tasks.add_task(
        logger_utils.notify_admins, 
        db, 
        "New Purchase Order", 
        f"A new Purchase Order (#{new_po.id}) has been submitted by User #{current_user.id}.\nCustomer Details: {current_user.first_name} {current_user.last_name} ({current_user.username})\nOrganization: {customer_profile.organization_name if customer_profile else 'Individual Customer'}\nTotal Amount: ₹{total_order_value:.2f}\nStatus: {'Backordered' if is_backordered else 'Approved'}"
    )

    return new_po

@app.get("/purchase-orders")
def get_purchase_orders(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    search_scope: Optional[str] = "all",
    status: Optional[str] = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: Optional[str] = "default",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Fetch paginated POs with server-side aggregation and filtering."""
    query = db.query(models.PurchaseOrder)

    # Role-Based Security Filter
    if current_user.role != "admin":
        query = query.filter(models.PurchaseOrder.customer_id == current_user.id)

    # Apply Status Filter
    if status and status != "all":
        query = query.filter(models.PurchaseOrder.status.ilike(status))

    # Apply Date Filters
    if start_date:
        query = query.filter(models.PurchaseOrder.created_at >= start_date)
    if end_date:
        query = query.filter(models.PurchaseOrder.created_at <= end_date + " 23:59:59")

    # Apply Text Search
    if search or sort_by in ["org_asc", "org_desc"]:
        query = query.outerjoin(models.User, models.PurchaseOrder.customer_id == models.User.id) \
                     .outerjoin(models.CustomerProfile, models.User.id == models.CustomerProfile.user_id)

    if search:
        search_term = f"%{search}%"
        if search_scope == "id":
            try: query = query.filter(models.PurchaseOrder.id == int(search))
            except ValueError: pass
        elif search_scope == "org":
            query = query.filter(models.CustomerProfile.organization_name.ilike(search_term))
        elif search_scope == "name":
            query = query.filter(or_(models.User.first_name.ilike(search_term), models.User.last_name.ilike(search_term), models.User.username.ilike(search_term)))
        else: # "all"
            query = query.filter(
                or_(
                    models.PurchaseOrder.id.cast(String).ilike(search_term),
                    models.CustomerProfile.organization_name.ilike(search_term),
                    models.User.first_name.ilike(search_term),
                    models.User.username.ilike(search_term),
                    models.PurchaseOrder.status.ilike(search_term)
                )
            )

    # Apply Sorting Logic
    if sort_by == "org_asc":
        query = query.order_by(models.CustomerProfile.organization_name.asc())
    elif sort_by == "org_desc":
        query = query.order_by(models.CustomerProfile.organization_name.desc())
    elif sort_by == "val_asc":
        query = query.order_by(models.PurchaseOrder.total_amount.asc())
    elif sort_by == "val_desc":
        query = query.order_by(models.PurchaseOrder.total_amount.desc())
    else:
        query = query.order_by(models.PurchaseOrder.id.desc())

    # Calculate Total Rows
    total_count = query.count()

    # Apply Pagination Slice
    pos = query.offset(skip).limit(limit).all()

    result = []
    
    for po in pos:
        # 1. Fetch Customer Info
        customer = db.query(models.User).filter(models.User.id == po.customer_id).first()
        customer_name = f"{customer.first_name} {customer.last_name}".strip() or customer.username if customer else None
        org_name = "Individual Customer"
        
        if customer:
            profile = db.query(models.CustomerProfile).filter(models.CustomerProfile.user_id == customer.id).first()
            if profile and profile.organization_name:
                org_name = profile.organization_name
                
        # 2. Fetch Admin Info (if invoiced)
        admin_name = None
        if po.invoiced_by_id:
            admin_user = db.query(models.User).filter(models.User.id == po.invoiced_by_id).first()
            if admin_user:
                admin_name = f"{admin_user.first_name} {admin_user.last_name}".strip() or admin_user.username
                
        result.append({
            "id": po.id,
            "customer_id": po.customer_id,
            "status": po.status,
            "total_amount": po.total_amount,
            "created_at": po.created_at,
            "shipping_address": po.shipping_address,
            "billing_address": po.billing_address,
            "invoiced_by_id": po.invoiced_by_id,
            "customer_name": customer_name,
            "organization_name": org_name,
            "invoiced_by_name": admin_name
        })
                
    return {
        "data": result,
        "total": total_count,
        "skip": skip,
        "limit": limit
    }

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


# NOTIFICATION ENDPOINTS
@app.get("/notifications")
def get_user_notifications(
    skip: int = 0, 
    limit: int = 50, 
    status: Optional[str] = "all", 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Fetches all notifications for the currently logged-in user (Admin or Customer)."""
    query = db.query(models.Notification).filter(models.Notification.recipient_id == current_user.id)
    
    if status == "unread": query = query.filter(models.Notification.is_read == False)
    elif status == "read": query = query.filter(models.Notification.is_read == True)

    if start_date: query = query.filter(models.Notification.created_at >= start_date)
    if end_date: query = query.filter(models.Notification.created_at <= end_date + " 23:59:59")

    total = query.count()
    notifs = query.order_by(models.Notification.created_at.desc()).offset(skip).limit(limit).all()

    return {"data": notifs, "total": total, "skip": skip, "limit": limit}

@app.put("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Marks a single notification as read when the user clicks it."""
    # Ensure the notification exists AND belongs to the user requesting the change
    notif = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.recipient_id == current_user.id
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")
        
    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read."}

@app.put("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Bulk action: Marks all unread notifications as read to clear the bell badge."""
    db.query(models.Notification).filter(
        models.Notification.recipient_id == current_user.id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    return {"message": "All notifications cleared."}

# DASHBOARD ANALYTICS ENDPOINTS
@app.get("/admin/analytics")
def get_admin_analytics(
    db: Session = Depends(get_db), 
    admin_user: models.User = Depends(auth_utils.get_current_admin)
):
    """Calculates enterprise KPIs and chart data for the Admin Dashboard."""
    
    current_year = datetime.now().year
    current_month = datetime.now().month
    pos = db.query(models.PurchaseOrder).all()
    
    # 1. Initialize KPI Counters
    kpis = {
        "revenue_ytd": 0.0,
        "revenue_mtd": 0.0,
        "pending_count": 0,
        "pending_value": 0.0,
        "backordered_count": 0,
        "backordered_value": 0.0,
        "low_stock_count": 0,
        "pending_customers": 0
    }
    
    # Dictionaries for Chart Aggregation
    status_dict = {}
    revenue_trend_dict = {}
    
    # 2. Process Purchase Orders
    for po in pos:
        status_dict[po.status] = status_dict.get(po.status, 0) + 1
        
        if po.status == "Invoiced":
            if po.created_at.year == current_year:
                kpis["revenue_ytd"] += po.total_amount
                if po.created_at.month == current_month:
                    kpis["revenue_mtd"] += po.total_amount
                    
            month_key = f"{calendar.month_abbr[po.created_at.month]} {po.created_at.year}"
            revenue_trend_dict[month_key] = revenue_trend_dict.get(month_key, 0.0) + po.total_amount
            
        elif po.status == "Pending":
            kpis["pending_count"] += 1
            kpis["pending_value"] += po.total_amount
            
        elif po.status == "Backordered":
            kpis["backordered_count"] += 1
            kpis["backordered_value"] += po.total_amount

    # 3. Process Inventory Warnings (< 10 units)
    kpis["low_stock_count"] = db.query(models.InventoryItem).filter(models.InventoryItem.quantity < 10).count()
    
    # 4. Process Pending Customers
    kpis["pending_customers"] = db.query(models.User).filter(
        models.User.role == "customer", 
        models.User.is_approved == False
    ).count()
    
    # 5. Build Top 5 Fast-Moving Items Chart
    po_items = db.query(models.PurchaseOrderItem).join(models.PurchaseOrder).filter(
        models.PurchaseOrder.status.in_(["Approved", "Invoiced"])
    ).all()
    
    item_sales = {}
    for po_item in po_items:
        inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == po_item.item_code).first()
        name = inv_item.item_name if inv_item else f"Item #{po_item.item_code}"
        item_sales[name] = item_sales.get(name, 0) + po_item.ordered_quantity
        
    # Sort and slice top 5
    top_items = [{"name": k, "value": v} for k, v in sorted(item_sales.items(), key=lambda item: item[1], reverse=True)[:5]]
    
    # 6. Format Charts for Recharts (React)
    status_chart = [{"name": k, "value": v} for k, v in status_dict.items()]
    
    # Generate a strict 6-month trailing array (ensures months with $0 revenue are still graphed)
    trend_chart = []
    today = datetime.now()
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        if m <= 0:
            m += 12
            y -= 1
        month_str = f"{calendar.month_abbr[m]} {y}"
        trend_chart.append({
            "name": calendar.month_abbr[m],
            "revenue": revenue_trend_dict.get(month_str, 0.0)
        })

    return {
        "kpis": kpis,
        "charts": {
            "trend": trend_chart,
            "status": status_chart,
            "top_items": top_items
        }
    }

@app.get("/customer/analytics")
def get_customer_analytics(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Calculates specific fulfillment KPIs and charts for a single customer."""
    pos = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.customer_id == current_user.id).all()
    
    kpis = {
        "pipeline_count": 0,
        "pipeline_value": 0.0,
        "backordered_count": 0,
        "backordered_value": 0.0,
        "total_orders": len(pos)
    }
    
    for po in pos:
        if po.status in ["Approved", "Pending"]:
            kpis["pipeline_count"] += 1
            kpis["pipeline_value"] += po.total_amount
        elif po.status == "Backordered":
            kpis["backordered_count"] += 1
            kpis["backordered_value"] += po.total_amount

    # Aggregate Most Purchased Items
    po_items = db.query(models.PurchaseOrderItem).join(models.PurchaseOrder).filter(
        models.PurchaseOrder.customer_id == current_user.id
    ).all()
    
    item_sales = {}
    for po_item in po_items:
        inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_code == po_item.item_code).first()
        name = inv_item.item_name if inv_item else f"Item #{po_item.item_code}"
        item_sales[name] = item_sales.get(name, 0) + po_item.ordered_quantity
        
    top_items = [{"name": k, "value": v} for k, v in sorted(item_sales.items(), key=lambda item: item[1], reverse=True)[:5]]
    
    return {
        "kpis": kpis,
        "charts": { "top_items": top_items }
    }

@app.get("/user/profile")
def get_user_profile(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Fetches the core profile data, merging organization details if the user is a customer."""
    profile_data = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role,
    }
    
    # If the user is a customer, fetch their organization data
    if current_user.role == "customer":
        customer_profile = db.query(models.CustomerProfile).filter(models.CustomerProfile.user_id == current_user.id).first()
        if customer_profile:
            profile_data["organization_name"] = customer_profile.organization_name
            profile_data["gst_number"] = customer_profile.gst_number
            
    return profile_data

@app.put("/user/profile")
def update_user_profile(
    profile_update: schemas.UserProfileUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Updates basic personal details."""
    
    # Security Check: Ensure the new email isn't already taken by another account
    if profile_update.email != current_user.email:
        existing_email = db.query(models.User).filter(models.User.email == profile_update.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered to another account.")

    if profile_update.username != current_user.username:
        existing_username = db.query(models.User).filter(models.User.username == profile_update.username).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already taken by another account.")
            
    current_user.first_name = profile_update.first_name
    current_user.last_name = profile_update.last_name
    current_user.email = profile_update.email
    current_user.username = profile_update.username
    db.commit()
    
    # Audit Trail: Log the action if an admin alters their own profile
    if current_user.role == "admin":
        log = models.AdminActivityLog(
            admin_id=current_user.id, 
            admin_name=f"{current_user.first_name} {current_user.last_name}".strip() or current_user.username, 
            admin_email=current_user.email,
            action_type="UPDATE", 
            entity_type="User Profile", 
            entity_id=current_user.id,
            changes={"profile": {"old": "Previous Details", "new": "Updated Details"}}
        )
        db.add(log)
        db.commit()
        
    return {"message": "Profile updated successfully."}


@app.put("/user/security/password")
def update_password(
    pass_update: schemas.UserPasswordUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Securely verifies the old password before hashing and saving the new one."""
    
    # Verify the current password against the cryptographic hash in the database
    if not auth_utils.verify_password(pass_update.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
        
    # Hash the new password and save it
    current_user.hashed_password = auth_utils.get_password_hash(pass_update.new_password)
    db.commit()
    
    # Audit Trail: Log the security event (in case of admin)
    if current_user.role == "admin":
        log = models.AdminActivityLog(
            admin_id=current_user.id, 
            admin_name=f"{current_user.first_name} {current_user.last_name}".strip() or current_user.username, 
            admin_email=current_user.email,
            action_type="UPDATE", 
            entity_type="Security", 
            entity_id=current_user.id,
            changes={"password": {"old": "***", "new": "***"}}
        )
        db.add(log)
        db.commit()
        
    return {"message": "Password updated successfully."}

@app.get("/user/preferences")
def get_user_preferences(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Fetches the current user's email notification preference."""
    return {"email_notifications": current_user.email_notifications}

@app.put("/user/preferences")
def update_user_preferences(
    prefs: schemas.UserPreferencesUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Updates the user's email notification preference in the database."""
    current_user.email_notifications = prefs.email_notifications
    db.commit()
    return {"message": "Preferences updated successfully", "email_notifications": current_user.email_notifications}

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to Motherson Sumi Wiring India Ltd. Inventory System API",
        "database": "Connected and schemas generated"
    }