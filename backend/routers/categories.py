from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from database import get_db
from models.categories import Category
from models.users import User
from schemas.categories import CategoryCreate, CategoryUpdate, CategoryResponse
from utils.auth import get_current_active_user

router = APIRouter()

@router.post("/", response_model=CategoryResponse)
def create_category(
    category: CategoryCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        existing_category = db.query(Category).filter(
            Category.name == category.name,
            Category.user_id == current_user.id
        ).first()
        if existing_category:
            raise HTTPException(status_code=400, detail="Category with this name already exists")
        
        db_category = Category(**category.dict(), user_id=current_user.id)
        db.add(db_category)
        db.commit()
        db.refresh(db_category)
        return db_category
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create category")

@router.get("/", response_model=List[CategoryResponse])
def get_categories(
    skip: int = 0, 
    limit: int = 100, 
    search: str = "", 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Category).filter(Category.user_id == current_user.id)
    if search:
        query = query.filter(Category.name.ilike(f"%{search}%"))
    categories = query.offset(skip).limit(limit).all()
    return categories

@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: uuid.UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user.id
    ).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: uuid.UUID, 
    category_update: CategoryUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        category = db.query(Category).filter(
            Category.id == category_id,
            Category.user_id == current_user.id
        ).first()
        if category is None:
            raise HTTPException(status_code=404, detail="Category not found")
        
        update_data = category_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(category, field, value)
        
        db.commit()
        db.refresh(category)
        return category
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update category")

@router.delete("/{category_id}")
def delete_category(
    category_id: uuid.UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        category = db.query(Category).filter(
            Category.id == category_id,
            Category.user_id == current_user.id
        ).first()
        if category is None:
            raise HTTPException(status_code=404, detail="Category not found")
        
        db.delete(category)
        db.commit()
        return {"message": "Category deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to delete category")