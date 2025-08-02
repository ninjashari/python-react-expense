from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
import uuid
import pandas as pd
import io
import PyPDF2
import pytesseract
from PIL import Image
import openpyxl
from database import get_db
from models.transactions import Transaction
from models.accounts import Account
from models.payees import Payee
from models.categories import Category
from models.users import User
from schemas.transactions import TransactionCreate
from utils.color_generator import generate_unique_color
from utils.slug import create_slug
from utils.auth import get_current_active_user
from routers.transactions import update_account_balance

router = APIRouter()

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF using PyPDF2"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading PDF: {str(e)}")

def extract_text_from_image(file_content: bytes) -> str:
    """Extract text from image using OCR"""
    try:
        image = Image.open(io.BytesIO(file_content))
        text = pytesseract.image_to_string(image)
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")

def parse_csv_data(file_content: bytes) -> pd.DataFrame:
    """Parse CSV file and return DataFrame"""
    try:
        df = pd.read_csv(io.BytesIO(file_content))
        return df
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading CSV: {str(e)}")

def parse_excel_data(file_content: bytes) -> pd.DataFrame:
    """Parse Excel file and return DataFrame"""
    try:
        df = pd.read_excel(io.BytesIO(file_content))
        return df
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel: {str(e)}")

def create_or_get_payee(db: Session, name: str, user_id: uuid.UUID) -> Optional[uuid.UUID]:
    """Create a new payee or get existing one for the current user"""
    if not name or name.strip() == "":
        return None
    
    payee = db.query(Payee).filter(
        Payee.name == name.strip(),
        Payee.user_id == user_id
    ).first()
    if not payee:
        slug = create_slug(name.strip())
        payee = Payee(
            name=name.strip(),
            slug=slug,
            user_id=user_id
        )
        db.add(payee)
        db.commit()
        db.refresh(payee)
    return payee.id

def create_or_get_category(db: Session, name: str, user_id: uuid.UUID) -> Optional[uuid.UUID]:
    """Create a new category or get existing one for the current user"""
    if not name or name.strip() == "":
        return None
    
    category = db.query(Category).filter(
        Category.name == name.strip(),
        Category.user_id == user_id
    ).first()
    if not category:
        slug = create_slug(name.strip())
        color = generate_unique_color(db, name.strip(), str(user_id))
        category = Category(
            name=name.strip(),
            slug=slug,
            color=color,
            user_id=user_id
        )
        db.add(category)
        db.commit()
        db.refresh(category)
    return category.id

def process_transactions_data(
    df: pd.DataFrame,
    db: Session,
    current_user: User,
    account_id: uuid.UUID,
    date_column: str,
    amount_column: str,
    description_column: str,
    payee_column: Optional[str] = None,
    category_column: Optional[str] = None,
    transaction_type_column: Optional[str] = None,
    default_transaction_type: str = "expense"
) -> tuple[int, List[str]]:
    """Process DataFrame rows and create transactions"""
    transactions_created = 0
    errors = []
    
    for index, row in df.iterrows():
        try:
            # Parse transaction data
            transaction_date = pd.to_datetime(row[date_column]).date()
            amount = float(row[amount_column])
            description = str(row[description_column]) if pd.notna(row[description_column]) else ""
            
            # Determine transaction type
            transaction_type = default_transaction_type
            if transaction_type_column and transaction_type_column in df.columns:
                type_value = str(row[transaction_type_column]).lower().strip()
                if type_value in ['income', 'expense', 'transfer']:
                    transaction_type = type_value
            
            # Validate transaction type
            if transaction_type not in ['income', 'expense', 'transfer']:
                transaction_type = 'expense'  # Default fallback
            
            # Handle payee
            payee_id = None
            if payee_column and payee_column in df.columns and pd.notna(row[payee_column]):
                payee_id = create_or_get_payee(db, str(row[payee_column]), current_user.id)
            
            # Handle category
            category_id = None
            if category_column and category_column in df.columns and pd.notna(row[category_column]):
                category_id = create_or_get_category(db, str(row[category_column]), current_user.id)
            
            # Create transaction
            transaction_data = TransactionCreate(
                date=transaction_date,
                amount=abs(amount),  # Ensure positive amount
                description=description,
                type=transaction_type,
                account_id=account_id,
                payee_id=payee_id,
                category_id=category_id
            )
            
            db_transaction = Transaction(**transaction_data.model_dump(), user_id=current_user.id)
            db.add(db_transaction)
            
            # Update account balance for imported transaction
            update_account_balance(db, account_id, abs(amount), transaction_type)
            
            transactions_created += 1
            
        except Exception as e:
            errors.append(f"Row {index + 1}: {str(e)}")
    
    return transactions_created, errors

@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    account_id: uuid.UUID = Form(...),
    date_column: str = Form("date"),
    amount_column: str = Form("amount"),
    description_column: str = Form("description"),
    payee_column: Optional[str] = Form(None),
    category_column: Optional[str] = Form(None),
    transaction_type_column: Optional[str] = Form(None),
    default_transaction_type: str = Form("expense"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import transactions from CSV file"""
    
    # Verify account exists and belongs to current user
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    content = await file.read()
    df = parse_csv_data(content)
    
    # Validate required columns exist
    required_columns = [date_column, amount_column, description_column]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing_columns}")
    
    # Process transactions using common utility function
    transactions_created, errors = process_transactions_data(
        df=df,
        db=db,
        current_user=current_user,
        account_id=account_id,
        date_column=date_column,
        amount_column=amount_column,
        description_column=description_column,
        payee_column=payee_column,
        category_column=category_column,
        transaction_type_column=transaction_type_column,
        default_transaction_type=default_transaction_type
    )
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    return {
        "message": f"Successfully imported {transactions_created} transactions",
        "transactions_created": transactions_created,
        "errors": errors
    }

@router.post("/excel")
async def import_excel(
    file: UploadFile = File(...),
    account_id: uuid.UUID = Form(...),
    sheet_name: Optional[str] = Form(None),
    date_column: str = Form("date"),
    amount_column: str = Form("amount"),
    description_column: str = Form("description"),
    payee_column: Optional[str] = Form(None),
    category_column: Optional[str] = Form(None),
    transaction_type_column: Optional[str] = Form(None),
    default_transaction_type: str = Form("expense"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import transactions from Excel file"""
    
    # Verify account exists and belongs to current user
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    content = await file.read()
    
    try:
        if sheet_name:
            df = pd.read_excel(io.BytesIO(content), sheet_name=sheet_name)
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
    
    # Validate required columns exist
    required_columns = [date_column, amount_column, description_column]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing_columns}")
    
    # Process transactions using common utility function
    transactions_created, errors = process_transactions_data(
        df=df,
        db=db,
        current_user=current_user,
        account_id=account_id,
        date_column=date_column,
        amount_column=amount_column,
        description_column=description_column,
        payee_column=payee_column,
        category_column=category_column,
        transaction_type_column=transaction_type_column,
        default_transaction_type=default_transaction_type
    )
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    return {
        "message": f"Successfully imported {transactions_created} transactions",
        "transactions_created": transactions_created,
        "errors": errors
    }

@router.post("/pdf-ocr")
async def import_pdf_with_ocr(
    file: UploadFile = File(...),
    account_id: uuid.UUID = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Extract text from PDF using OCR (basic implementation)"""
    
    # Verify account exists and belongs to current user
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    content = await file.read()
    
    # Try to extract text from PDF first
    try:
        extracted_text = extract_text_from_pdf(content)
    except:
        # If PDF text extraction fails, convert to image and use OCR
        try:
            extracted_text = extract_text_from_image(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to extract text: {str(e)}")
    
    # This is a basic implementation that returns the extracted text
    # In a production system, you would use LLM here to parse the text
    # and extract transaction data automatically
    
    return {
        "message": "Text extracted successfully",
        "extracted_text": extracted_text,
        "note": "This is raw extracted text. In production, an LLM would parse this into structured transaction data."
    }

@router.post("/column-mapping/{file_type}")
async def get_suggested_column_mapping(
    file_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Analyze uploaded file and suggest column mappings"""
    
    content = await file.read()
    
    try:
        if file_type.lower() == "csv":
            df = parse_csv_data(content)
        elif file_type.lower() in ["xlsx", "xls", "excel"]:
            df = parse_excel_data(content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    columns = df.columns.tolist()
    sample_data = df.head(3).to_dict('records')
    
    # Simple heuristics for column mapping suggestions
    suggestions = {}
    
    for col in columns:
        col_lower = col.lower()
        if any(keyword in col_lower for keyword in ['date', 'time', 'when']):
            suggestions['date'] = col
        elif any(keyword in col_lower for keyword in ['amount', 'value', 'sum', 'total']):
            suggestions['amount'] = col
        elif any(keyword in col_lower for keyword in ['desc', 'description', 'memo', 'note']):
            suggestions['description'] = col
        elif any(keyword in col_lower for keyword in ['payee', 'merchant', 'vendor', 'to', 'from']):
            suggestions['payee'] = col
        elif any(keyword in col_lower for keyword in ['category', 'type', 'class']):
            suggestions['category'] = col
    
    return {
        "columns": columns,
        "sample_data": sample_data,
        "suggested_mappings": suggestions
    }