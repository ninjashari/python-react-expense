from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid

from database import get_db
from models.users import User
from schemas.users import UserResponse
from utils.auth import get_current_admin_user

router = APIRouter()


def _table_exists(db: Session, table_name: str) -> bool:
    result = db.execute(
        text("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :t"),
        {"t": table_name},
    )
    return result.fetchone() is not None


def _safe_delete(db: Session, sql: str, params: dict, table: str) -> None:
    if _table_exists(db, table):
        db.execute(text(sql), params)


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    return db.query(User).order_by(User.created_at).all()


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Cannot delete your own admin account")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    uid = str(user_id)
    try:
        # Learning tables (may not exist on fresh DBs without full migration history)
        _safe_delete(db, "DELETE FROM user_transaction_patterns WHERE user_id = :uid", {"uid": uid}, "user_transaction_patterns")
        _safe_delete(db, "DELETE FROM user_selection_history WHERE user_id = :uid", {"uid": uid}, "user_selection_history")
        _safe_delete(db, "DELETE FROM user_correction_patterns WHERE user_id = :uid", {"uid": uid}, "user_correction_patterns")
        _safe_delete(db, "DELETE FROM learning_statistics WHERE user_id = :uid", {"uid": uid}, "learning_statistics")

        # transaction_splits (may not exist on all deployments)
        _safe_delete(db,
            "DELETE FROM transaction_splits WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = :uid)",
            {"uid": uid}, "transaction_splits")

        # Reward points
        _safe_delete(db, "DELETE FROM reward_point_redemptions WHERE user_id = :uid", {"uid": uid}, "reward_point_redemptions")
        _safe_delete(db, "DELETE FROM reward_point_bonuses WHERE user_id = :uid", {"uid": uid}, "reward_point_bonuses")

        # Core data (always exists)
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
