from sqlalchemy.orm import Session
import models

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