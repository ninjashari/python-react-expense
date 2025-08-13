from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from database import get_db
from models.categories import Category
from models.users import User
from schemas.categories import CategoryCreate, CategoryUpdate, CategoryResponse
from utils.auth import get_current_active_user
from utils.color_generator import generate_unique_color
from utils.slug import create_slug

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
        
        # Generate slug from name
        slug = create_slug(category.name)
        
        # Generate color if not provided
        color = category.color or generate_unique_color(db, category.name, str(current_user.id))
        
        db_category = Category(
            name=category.name,
            slug=slug,
            color=color,
            user_id=current_user.id
        )
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
        
        # If name is being updated, regenerate slug
        if 'name' in update_data:
            update_data['slug'] = create_slug(update_data['name'])
        
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

@router.post("/reassign-colors")
def reassign_category_colors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Golden Ratio Color Distribution - Reassign mathematically optimal unique colors to all categories.
    
    Uses the golden angle (137.5°) to create maximally distributed colors in perceptual color space.
    Each category gets a unique, visually distinct, and accessible color using elegant mathematical principles.
    """
    try:
        # Get all categories for the current user
        categories = db.query(Category).filter(Category.user_id == current_user.id).all()
        
        if not categories:
            return {
                "message": "No categories found to reassign colors",
                "categories_updated": 0,
                "total_categories": 0,
                "updated_categories": []
            }
        
        # Clear all existing colors first to enable fresh golden distribution
        old_colors = {}
        for category in categories:
            old_colors[category.id] = category.color
            category.color = None
        
        db.commit()  # Commit the clearing to ensure clean slate
        
        # Generate new mathematically distributed colors
        updated_categories = []
        colors_assigned = 0
        
        # Sort categories by name for consistent ordering
        sorted_categories = sorted(categories, key=lambda c: c.name.lower())
        
        for category in sorted_categories:
            try:
                # Generate unique color using golden ratio distribution
                new_color = generate_unique_color(db, category.name, str(current_user.id))
                category.color = new_color
                
                updated_categories.append({
                    "category_id": category.id,
                    "category_name": category.name,
                    "old_color": old_colors[category.id],
                    "new_color": new_color,
                    "distribution_index": colors_assigned
                })
                
                colors_assigned += 1
                
            except Exception as e:
                # Fallback to old color if generation fails
                category.color = old_colors[category.id]
                print(f"Failed to generate color for category {category.name}: {e}")
        
        db.commit()
        
        return {
            "message": f"Golden ratio distribution complete - {colors_assigned} unique colors assigned",
            "categories_updated": colors_assigned,
            "total_categories": len(categories),
            "updated_categories": updated_categories,
            "distribution_method": "Golden Angle (137.5°) Mathematical Distribution"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reassign category colors: {str(e)}")