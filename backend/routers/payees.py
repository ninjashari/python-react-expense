from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from database import get_db
from models.payees import Payee
from models.users import User
from schemas.payees import PayeeCreate, PayeeUpdate, PayeeResponse
from utils.auth import get_current_active_user
from utils.slug import create_slug
from utils.color_generator import generate_unique_color

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
        
        # Generate slug from name
        slug = create_slug(payee.name)
        
        # Generate color if not provided
        color = payee.color or generate_unique_color(db, payee.name, str(current_user.id), "payees")
        
        db_payee = Payee(
            name=payee.name,
            slug=slug,
            color=color,
            user_id=current_user.id
        )
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
    
    # Auto-assign colors to payees that don't have them
    needs_update = False
    for payee in payees:
        if not payee.color:
            try:
                payee.color = generate_unique_color(db, payee.name, str(current_user.id), "payees")
                needs_update = True
            except Exception as e:
                print(f"Failed to generate color for payee {payee.name}: {e}")
    
    if needs_update:
        db.commit()
    
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
        
        # If name is being updated, regenerate slug
        if 'name' in update_data:
            update_data['slug'] = create_slug(update_data['name'])
        
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

@router.post("/reassign-colors")
def reassign_payee_colors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Golden Ratio Color Distribution - Reassign mathematically optimal unique colors to all payees.
    
    Uses the golden angle (137.5°) to create maximally distributed colors in perceptual color space.
    Each payee gets a unique, visually distinct, and accessible color using elegant mathematical principles.
    """
    try:
        # Get all payees for the current user
        payees = db.query(Payee).filter(Payee.user_id == current_user.id).all()
        
        if not payees:
            return {
                "message": "No payees found to reassign colors",
                "payees_updated": 0,
                "total_payees": 0,
                "updated_payees": []
            }
        
        # Clear all existing colors first to enable fresh golden distribution
        old_colors = {}
        for payee in payees:
            old_colors[payee.id] = payee.color
            payee.color = None
        
        db.commit()  # Commit the clearing to ensure clean slate
        
        # Generate new mathematically distributed colors
        updated_payees = []
        colors_assigned = 0
        
        # Sort payees by name for consistent ordering
        sorted_payees = sorted(payees, key=lambda p: p.name.lower())
        
        for payee in sorted_payees:
            try:
                # Generate unique color using golden ratio distribution
                new_color = generate_unique_color(db, payee.name, str(current_user.id), "payees")
                payee.color = new_color
                
                updated_payees.append({
                    "payee_id": payee.id,
                    "payee_name": payee.name,
                    "old_color": old_colors[payee.id],
                    "new_color": new_color,
                    "distribution_index": colors_assigned
                })
                
                colors_assigned += 1
                
            except Exception as e:
                # Fallback to old color if generation fails
                payee.color = old_colors[payee.id]
                print(f"Failed to generate color for payee {payee.name}: {e}")
        
        db.commit()
        
        return {
            "message": f"Golden ratio distribution complete - {colors_assigned} unique colors assigned",
            "payees_updated": colors_assigned,
            "total_payees": len(payees),
            "updated_payees": updated_payees,
            "distribution_method": "Golden Angle (137.5°) Mathematical Distribution"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reassign payee colors: {str(e)}")