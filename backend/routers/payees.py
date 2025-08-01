from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from database import get_db
from models.payees import Payee
from models.users import User
from schemas.payees import PayeeCreate, PayeeUpdate, PayeeResponse
from utils.auth import get_current_active_user

router = APIRouter()

@router.post("/", response_model=PayeeResponse)
def create_payee(
    payee: PayeeCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        existing_payee = db.query(Payee).filter(
            Payee.name == payee.name,
            Payee.user_id == current_user.id
        ).first()
        if existing_payee:
            raise HTTPException(status_code=400, detail="Payee with this name already exists")
        
        db_payee = Payee(**payee.dict(), user_id=current_user.id)
        db.add(db_payee)
        db.commit()
        db.refresh(db_payee)
        return db_payee
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create payee")

@router.get("/", response_model=List[PayeeResponse])
def get_payees(
    skip: int = 0, 
    limit: int = 100, 
    search: str = "", 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Payee).filter(Payee.user_id == current_user.id)
    if search:
        query = query.filter(Payee.name.ilike(f"%{search}%"))
    payees = query.offset(skip).limit(limit).all()
    return payees

@router.get("/{payee_id}", response_model=PayeeResponse)
def get_payee(
    payee_id: uuid.UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    payee = db.query(Payee).filter(
        Payee.id == payee_id, 
        Payee.user_id == current_user.id
    ).first()
    if payee is None:
        raise HTTPException(status_code=404, detail="Payee not found")
    return payee

@router.put("/{payee_id}", response_model=PayeeResponse)
def update_payee(
    payee_id: uuid.UUID, 
    payee_update: PayeeUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    try:
        payee = db.query(Payee).filter(
            Payee.id == payee_id, 
            Payee.user_id == current_user.id
        ).first()
        if payee is None:
            raise HTTPException(status_code=404, detail="Payee not found")
        
        update_data = payee_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(payee, field, value)
        
        db.commit()
        db.refresh(payee)
        return payee
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update payee")

@router.delete("/{payee_id}")
def delete_payee(
    payee_id: uuid.UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    try:
        payee = db.query(Payee).filter(
            Payee.id == payee_id, 
            Payee.user_id == current_user.id
        ).first()
        if payee is None:
            raise HTTPException(status_code=404, detail="Payee not found")
        
        db.delete(payee)
        db.commit()
        return {"message": "Payee deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to delete payee")