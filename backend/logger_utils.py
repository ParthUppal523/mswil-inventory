import os
import smtplib
from email.message import EmailMessage
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import models

# --- EMAIL CONFIGURATION ---
load_dotenv()  # Load environment variables from .env file

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

def send_email_alert(to_email: str, subject: str, body: str):
    """Fires a standard SMTP email."""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("SMTP credentials are not set. Cannot send email.")
        return

    try:
        msg = EmailMessage()
        msg.set_content(body)
        msg['Subject'] = subject
        msg['From'] = SMTP_USERNAME
        msg['To'] = to_email

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

def create_notification(db: Session, recipient_id: int, title: str, message: str):
    """Creates an in-app notification and checks if an email should be sent."""
    # Create In-App Notification
    new_notif = models.Notification(
        recipient_id=recipient_id,
        title=title,
        message=message
    )
    db.add(new_notif)
    db.commit()

    # Check if user wants Email Notifications
    user = db.query(models.User).filter(models.User.id == recipient_id).first()
    if user and user.email_notifications:
        send_email_alert(user.email, title, message)

def notify_admins(db: Session, title: str, message: str):
    """Global router to alert all system administrators of an event."""
    admins = db.query(models.User).filter(models.User.role == "admin").all()
    for admin in admins:
        create_notification(db, recipient_id=admin.id, title=title, message=message)

def generate_delta(old_data: dict, new_data: dict) -> dict:
    """
    Compares two dictionaries and returns only the fields that changed.
    Ignores structural keys like SQLAlchemy state objects.
    """
    changes = {}
    
    for key, new_val in new_data.items():
        if key.startswith("_"):
            continue
            
        if key in old_data:
            old_val = old_data[key]
            if old_val != new_val:
                changes[key] = {
                    "old": old_val,
                    "new": new_val
                }
                
    return changes

def log_admin_activity(
    db: Session,
    admin_user: models.User,
    action_type: str,
    entity_type: str,
    entity_id: str,
    changes: dict = None
):
    """
    Physically writes the audit log to the database.
    Designed to be run as a FastAPI Background Task.
    """
    # Create the snapshot
    admin_name = f"{admin_user.first_name} {admin_user.last_name}".strip() or admin_user.username
    
    new_log = models.AdminActivityLog(
        admin_id=admin_user.id,
        admin_name=admin_name,
        admin_email=admin_user.email,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=str(entity_id), # Converted to string to safely handle both int IDs and string codes
        changes=changes
    )
    
    db.add(new_log)
    db.commit()

    # --- EVENT DISPACTCHER ---
    # Event A: Admin Invoices a Purchase Order
    if action_type == "INVOICE" and entity_type == "PurchaseOrder":
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == int(entity_id)).first()
        if po:
            create_notification(
                db, 
                recipient_id=po.customer_id, 
                title="Invoice Generated", 
                message=f"Purchase Order #{po.id} has been invoiced. You can now download it from your Order History."
            )

    # Event B: Admin Approves a Customer Account
    elif action_type == "APPROVE" and entity_type == "User":
        create_notification(
            db, 
            recipient_id=int(entity_id), 
            title="Account Approved", 
            message="Your MSWIL account has been approved by an administrator. You can now submit Purchase Orders."
        )

    # Event C: Admin Revokes a Customer Account
    elif action_type == "REVOKE" and entity_type == "User":
        create_notification(
            db, 
            recipient_id=int(entity_id), 
            title="Account Suspended", 
            message="Your MSWIL account access has been temporarily revoked by an administrator."
        )