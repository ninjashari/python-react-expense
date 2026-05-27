from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import uuid
import pandas as pd
import io
import json
from database import get_db
from models.payees import Payee
from models.users import User
from models.transactions import Transaction
from schemas.payees import PayeeCreate, PayeeUpdate, PayeeResponse
from utils.auth import get_current_active_user
from utils.slug import create_slug
from utils.color_generator import assign_unique_colors_bulk, generate_unique_color

router = APIRouter()

@router.post("/", response_model=PayeeResponse)
def create_payee(
    payee: PayeeCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        # Validate input
        if not payee.name or not payee.name.strip():
            raise HTTPException(status_code=400, detail="Payee name is required and cannot be empty")
        
        # Trim whitespace from name
        payee.name = payee.name.strip()
        
        # Check for case-insensitive name conflicts
        existing_payee = db.query(Payee).filter(
            Payee.name.ilike(payee.name),
            Payee.user_id == current_user.id
        ).first()
        if existing_payee:
            raise HTTPException(status_code=400, detail=f"Payee with name '{existing_payee.name}' already exists")
        
        # Generate unique slug from name
        base_slug = create_slug(payee.name)
        slug = base_slug
        counter = 1
        
        # Ensure slug is unique for this user
        while db.query(Payee).filter(
            Payee.slug == slug,
            Payee.user_id == current_user.id
        ).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
        
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
        # Provide more specific error message
        error_msg = str(e)
        if "duplicate key" in error_msg.lower() or "unique constraint" in error_msg.lower():
            raise HTTPException(status_code=400, detail="A payee with this name or identifier already exists")
        elif "not null" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Required payee information is missing")
        else:
            raise HTTPException(status_code=400, detail=f"Failed to create payee: {error_msg}")

@router.get("/", response_model=List[PayeeResponse])
def get_payees(
    search: str = "", 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Payee).filter(Payee.user_id == current_user.id)
    if search:
        query = query.filter(Payee.name.ilike(f"%{search}%"))
    
    # Order by creation date descending (newest first) to ensure new payees appear
    query = query.order_by(Payee.created_at.desc())
    
    payees = query.all()  # No pagination - return all results
    
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

@router.delete("/unused")
def delete_unused_payees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Remove all payees that are not referenced by any transactions.
    """
    try:
        # Get all payees for the current user
        all_payees = db.query(Payee).filter(Payee.user_id == current_user.id).all()
        
        if not all_payees:
            return {
                "message": "No payees found",
                "deleted_count": 0,
                "deleted_payees": []
            }
        
        # Find payees that are not referenced by any transactions
        unused_payees = []
        deleted_payees = []
        
        for payee in all_payees:
            transaction_count = db.query(Transaction).filter(
                Transaction.payee_id == payee.id,
                Transaction.user_id == current_user.id
            ).count()
            
            if transaction_count == 0:
                unused_payees.append(payee)
                deleted_payees.append({
                    "id": payee.id,
                    "name": payee.name,
                    "color": payee.color
                })
        
        # Delete unused payees
        for payee in unused_payees:
            db.delete(payee)
        
        db.commit()
        
        return {
            "message": f"Successfully deleted {len(unused_payees)} unused payee(s)",
            "deleted_count": len(unused_payees),
            "deleted_payees": deleted_payees
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete unused payees: {str(e)}")

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
        
        # If name is being updated, regenerate unique slug
        if 'name' in update_data:
            base_slug = create_slug(update_data['name'])
            slug = base_slug
            counter = 1
            
            # Ensure slug is unique for this user (excluding current payee)
            while db.query(Payee).filter(
                Payee.slug == slug,
                Payee.user_id == current_user.id,
                Payee.id != payee_id
            ).first():
                slug = f"{base_slug}-{counter}"
                counter += 1
            
            update_data['slug'] = slug
        
        for field, value in update_data.items():
            setattr(payee, field, value)
        
        db.commit()
        db.refresh(payee)
        return payee
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # Provide more specific error message
        error_msg = str(e)
        if "duplicate key" in error_msg.lower() or "unique constraint" in error_msg.lower():
            raise HTTPException(status_code=400, detail="A payee with this name or identifier already exists")
        elif "not null" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Required payee information is missing")
        else:
            raise HTTPException(status_code=400, detail=f"Failed to update payee: {error_msg}")

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
    Color Distribution - Reassign unique colors to all payees.
    
    Creates visually distinct and accessible colors for all payees.
    Each payee gets a unique color optimized for visual distinction.
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
        
        # Store old colors for comparison
        old_colors = {}
        for payee in payees:
            old_colors[payee.id] = payee.color
        
        # Sort payees by name for consistent ordering
        sorted_payees = sorted(payees, key=lambda p: p.name.lower())
        
        # Use bulk assignment to ensure global uniqueness
        assigned_colors = assign_unique_colors_bulk(db, sorted_payees, str(current_user.id), "payees")
        
        # Apply the assigned colors
        updated_payees = []
        colors_assigned = 0
        
        for i, payee in enumerate(sorted_payees):
            if i < len(assigned_colors):
                new_color = assigned_colors[i]
                payee.color = new_color
                
                updated_payees.append({
                    "payee_id": payee.id,
                    "payee_name": payee.name,
                    "old_color": old_colors[payee.id],
                    "new_color": new_color,
                    "distribution_index": i
                })
                
                colors_assigned += 1
        
        db.commit()
        
        return {
            "message": f"Color distribution complete - {colors_assigned} unique colors assigned",
            "payees_updated": colors_assigned,
            "total_payees": len(payees),
            "updated_payees": updated_payees,
            "distribution_method": "Optimized Color Distribution"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reassign payee colors: {str(e)}")

@router.get("/export")
def export_payees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export all payees to Excel/CSV format"""
    try:
        # Get all payees for the current user
        payees = db.query(Payee).filter(
            Payee.user_id == current_user.id
        ).order_by(Payee.name).all()
        
        if not payees:
            raise HTTPException(status_code=404, detail="No payees found to export")
        
        # Convert to DataFrame
        data = []
        for payee in payees:
            data.append({
                'Name': payee.name,
                'Color': payee.color,
                'Created At': payee.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'Slug': payee.slug
            })
        
        df = pd.DataFrame(data)
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Payees')
        
        output.seek(0)
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(output.getvalue()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": "attachment; filename=payees_export.xlsx"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export payees: {str(e)}")

@router.post("/import")
def import_payees(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import payees from Excel/CSV file"""
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
                detail="No valid payee data found in the file"
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
                
                # Check if payee already exists (case-insensitive)
                existing_payee = db.query(Payee).filter(
                    Payee.name.ilike(name),
                    Payee.user_id == current_user.id
                ).first()
                
                if existing_payee:
                    # Update existing payee if color is provided and different
                    if color and color != existing_payee.color:
                        existing_payee.color = color
                        updated_count += 1
                    else:
                        skipped_count += 1
                else:
                    # Create new payee
                    # Generate unique slug from name
                    base_slug = create_slug(name)
                    slug = base_slug
                    counter = 1
                    
                    # Ensure slug is unique for this user
                    while db.query(Payee).filter(
                        Payee.slug == slug,
                        Payee.user_id == current_user.id
                    ).first():
                        slug = f"{base_slug}-{counter}"
                        counter += 1
                    
                    # Generate color if not provided
                    final_color = color or generate_unique_color(db, name, str(current_user.id), "payees")
                    
                    new_payee = Payee(
                        name=name,
                        slug=slug,
                        color=final_color,
                        user_id=current_user.id
                    )
                    db.add(new_payee)
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
        raise HTTPException(status_code=500, detail=f"Failed to import payees: {str(e)}")