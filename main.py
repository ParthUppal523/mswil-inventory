from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
import models
import schemas
import auth_utils
from database import engine, get_db

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


@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to Motherson Sumi Wiring India Ltd. Inventory System API",
        "database": "Connected and schemas generated"
    }
