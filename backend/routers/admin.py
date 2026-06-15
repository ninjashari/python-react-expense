from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid

from database import get_db
from models.users import User
from schemas.users import UserResponse
from utils.auth import get_current_admin_user

router = APIRouter()


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    """List all registered users (admin only)"""
    return db.query(User).order_by(User.created_at).all()


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Delete a user and all their data (admin only)"""
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own admin account"
        )

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    uid = str(user_id)
    try:
        # Delete in FK-safe order
        db.execute(text("DELETE FROM user_transaction_patterns WHERE user_id = :uid"), {"uid": uid})
        db.execute(text("DELETE FROM user_selection_history WHERE user_id = :uid"), {"uid": uid})
        db.execute(text("DELETE FROM user_correction_patterns WHERE user_id = :uid"), {"uid": uid})
        db.execute(text("DELETE FROM learning_statistics WHERE user_id = :uid"), {"uid": uid})
        db.execute(text(
            "DELETE FROM transaction_splits WHERE transaction_id IN "
            "(SELECT id FROM transactions WHERE user_id = :uid)"
        ), {"uid": uid})
        db.execute(text("DELETE FROM reward_point_redemptions WHERE user_id = :uid"), {"uid": uid})
        db.execute(text("DELETE FROM reward_point_bonuses WHERE user_id = :uid"), {"uid": uid})
        db.execute(text("DELETE FROM transactions WHERE user_id = :uid"), {"uid": uid})
        db.execute(text("DELETE FROM accounts WHERE user_id = :uid"), {"uid": uid})
        db.execute(text("DELETE FROM categories WHERE user_id = :uid"), {"uid": uid})
        db.execute(text("DELETE FROM payees WHERE user_id = :uid"), {"uid": uid})
        db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": uid})
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )

    return {"message": f"User {target.email} and all their data deleted successfully"}
