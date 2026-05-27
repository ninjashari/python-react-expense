from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import uuid
import pandas as pd
import io
import json
from database import get_db
from models.categories import Category
from models.users import User
from models.transactions import Transaction
from schemas.categories import CategoryCreate, CategoryUpdate, CategoryResponse
from utils.auth import get_current_active_user
from utils.color_generator import assign_unique_colors_bulk, generate_unique_color
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
        color = category.color or generate_unique_color(db, category.name, str(current_user.id), "categories")
        
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
    search: str = "", 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Category).filter(Category.user_id == current_user.id)
    if search:
        query = query.filter(Category.name.ilike(f"%{search}%"))
    
    # Order by creation date descending (newest first)
    query = query.order_by(Category.created_at.desc())
    
    categories = query.all()  # No pagination - return all results
    
    # Auto-assign colors to categories that don't have them
    needs_update = False
    for category in categories:
        if not category.color:
            try:
                category.color = generate_unique_color(db, category.name, str(current_user.id), "categories")
                needs_update = True
            except Exception as e:
                print(f"Failed to generate color for category {category.name}: {e}")
    
    if needs_update:
        db.commit()
    
    return categories

@router.delete("/unused")
def delete_unused_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Remove all categories that are not referenced by any transactions.
    """
    try:
        # Get all categories for the current user
        all_categories = db.query(Category).filter(Category.user_id == current_user.id).all()
        
        if not all_categories:
            return {
                "message": "No categories found",
                "deleted_count": 0,
                "deleted_categories": []
            }
        
        # Find categories that are not referenced by any transactions
        unused_categories = []
        deleted_categories = []
        
        for category in all_categories:
            transaction_count = db.query(Transaction).filter(
                Transaction.category_id == category.id,
                Transaction.user_id == current_user.id
            ).count()
            
            if transaction_count == 0:
                unused_categories.append(category)
                deleted_categories.append({
                    "id": category.id,
                    "name": category.name,
                    "color": category.color
                })
        
        # Delete unused categories
        for category in unused_categories:
            db.delete(category)
        
        db.commit()
        
        return {
            "message": f"Successfully deleted {len(unused_categories)} unused category(s)",
            "deleted_count": len(unused_categories),
            "deleted_categories": deleted_categories
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete unused categories: {str(e)}")

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
    Color Distribution - Reassign unique colors to all categories.
    
    Creates visually distinct and accessible colors for all categories.
    Each category gets a unique color optimized for visual distinction.
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
        
        # Store old colors for comparison
        old_colors = {}
        for category in categories:
            old_colors[category.id] = category.color
        
        # Sort categories by name for consistent ordering
        sorted_categories = sorted(categories, key=lambda c: c.name.lower())
        
        # Use bulk assignment to ensure global uniqueness
        assigned_colors = assign_unique_colors_bulk(db, sorted_categories, str(current_user.id), "categories")
        
        # Apply the assigned colors
        updated_categories = []
        colors_assigned = 0
        
        for i, category in enumerate(sorted_categories):
            if i < len(assigned_colors):
                new_color = assigned_colors[i]
                category.color = new_color
                
                updated_categories.append({
                    "category_id": category.id,
                    "category_name": category.name,
                    "old_color": old_colors[category.id],
                    "new_color": new_color,
                    "distribution_index": i
                })
                
                colors_assigned += 1
        
        db.commit()
        
        return {
            "message": f"Color distribution complete - {colors_assigned} unique colors assigned",
            "categories_updated": colors_assigned,
            "total_categories": len(categories),
            "updated_categories": updated_categories,
            "distribution_method": "Optimized Color Distribution"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reassign category colors: {str(e)}")

@router.get("/export")
def export_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export all categories to Excel/CSV format"""
    try:
        # Get all categories for the current user
        categories = db.query(Category).filter(
            Category.user_id == current_user.id
        ).order_by(Category.name).all()
        
        if not categories:
            raise HTTPException(status_code=404, detail="No categories found to export")
        
        # Convert to DataFrame
        data = []
        for category in categories:
            data.append({
                'Name': category.name,
                'Color': category.color,
                'Created At': category.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'Slug': category.slug
            })
        
        df = pd.DataFrame(data)
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Categories')
        
        output.seek(0)
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(output.getvalue()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": "attachment; filename=categories_export.xlsx"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export categories: {str(e)}")

@router.post("/import")
def import_categories(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import categories from Excel/CSV file"""
    try:
        # Validate file type
        if not file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
            raise HTTPException(
                status_code=400, 
                detail="Invalid file format. Only Excel (.xlsx, .xls) and CSV files are supported."
            )
        
        # Read file content
        content = file.file.read()
        
        try:
            # Try to read as Excel first, then CSV
            if file.filename.lower().endswith('.csv'):
                df = pd.read_csv(io.StringIO(content.decode('utf-8')))
            else:
                df = pd.read_excel(io.BytesIO(content))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to read file: {str(e)}. Please ensure the file is not corrupted."
            )
        
        # Validate required columns
        required_columns = ['Name']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_columns)}. Required: {', '.join(required_columns)}"
            )
        
        # Clean and validate data
        df = df.dropna(subset=['Name'])  # Remove rows with empty names
        df['Name'] = df['Name'].astype(str).str.strip()  # Clean names
        df = df[df['Name'] != '']  # Remove empty names after cleaning
        
        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="No valid category data found in the file"
            )
        
        # Track results
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                name = row['Name']
                color = row.get('Color', None)
                
                # Check if category already exists (case-insensitive)
                existing_category = db.query(Category).filter(
                    Category.name.ilike(name),
                    Category.user_id == current_user.id
                ).first()
                
                if existing_category:
                    # Update existing category if color is provided and different
                    if color and color != existing_category.color:
                        existing_category.color = color
                        updated_count += 1
                    else:
                        skipped_count += 1
                else:
                    # Create new category
                    # Generate unique slug from name
                    base_slug = create_slug(name)
                    slug = base_slug
                    counter = 1
                    
                    # Ensure slug is unique for this user
                    while db.query(Category).filter(
                        Category.slug == slug,
                        Category.user_id == current_user.id
                    ).first():
                        slug = f"{base_slug}-{counter}"
                        counter += 1
                    
                    # Generate color if not provided
                    final_color = color or generate_unique_color(db, name, str(current_user.id), "categories")
                    
                    new_category = Category(
                        name=name,
                        slug=slug,
                        color=final_color,
                        user_id=current_user.id
                    )
                    db.add(new_category)
                    created_count += 1
                    
            except Exception as row_error:
                errors.append(f"Row {index + 2}: {str(row_error)}")
                continue
        
        # Commit all changes
        db.commit()
        
        return {
            "message": f"Import completed successfully",
            "total_rows": len(df),
            "created_count": created_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "error_count": len(errors),
            "errors": errors[:10]  # Limit to first 10 errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to import categories: {str(e)}")