from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
import pandas as pd
import io
import PyPDF2
import pytesseract
from PIL import Image
import openpyxl
from database import get_db
from models.transactions import Transaction, TransactionType
from models.accounts import Account
from models.payees import Payee
from models.categories import Category
from schemas.transactions import TransactionCreate
from utils.color_generator import generate_unique_color

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

def create_or_get_payee(db: Session, name: str) -> Optional[int]:
    """Create a new payee or get existing one"""
    if not name or name.strip() == "":
        return None
    
    payee = db.query(Payee).filter(Payee.name == name.strip()).first()
    if not payee:
        payee = Payee(name=name.strip())
        db.add(payee)
        db.commit()
        db.refresh(payee)
    return payee.id

def create_or_get_category(db: Session, name: str) -> Optional[int]:
    """Create a new category or get existing one"""
    if not name or name.strip() == "":
        return None
    
    category = db.query(Category).filter(Category.name == name.strip()).first()
    if not category:
        color = generate_unique_color(db)
        category = Category(name=name.strip(), color=color)
        db.add(category)
        db.commit()
        db.refresh(category)
    return category.id

@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    date_column: str = Form("date"),
    amount_column: str = Form("amount"),
    description_column: str = Form("description"),
    payee_column: Optional[str] = Form(None),
    category_column: Optional[str] = Form(None),
    transaction_type_column: Optional[str] = Form(None),
    default_transaction_type: TransactionType = Form(TransactionType.WITHDRAWAL),
    db: Session = Depends(get_db)
):
    """Import transactions from CSV file"""
    
    # Verify account exists
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    content = await file.read()
    df = parse_csv_data(content)
    
    # Validate required columns exist
    required_columns = [date_column, amount_column, description_column]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing_columns}")
    
    transactions_created = 0
    errors = []
    
    for index, row in df.iterrows():
        try:
            # Parse transaction data
            transaction_date = pd.to_datetime(row[date_column]).date()
            amount = float(row[amount_column])
            description = str(row[description_column]) if pd.notna(row[description_column]) else ""
            
            # Determine transaction type
            if transaction_type_column and transaction_type_column in df.columns:
                try:
                    transaction_type = TransactionType(row[transaction_type_column].lower())
                except (ValueError, AttributeError):
                    transaction_type = default_transaction_type
            else:
                transaction_type = default_transaction_type
            
            # Handle payee
            payee_id = None
            if payee_column and payee_column in df.columns and pd.notna(row[payee_column]):
                payee_id = create_or_get_payee(db, str(row[payee_column]))
            
            # Handle category
            category_id = None
            if category_column and category_column in df.columns and pd.notna(row[category_column]):
                category_id = create_or_get_category(db, str(row[category_column]))
            
            # Create transaction
            transaction_data = TransactionCreate(
                date=transaction_date,
                amount=abs(amount),  # Ensure positive amount
                description=description,
                transaction_type=transaction_type,
                account_id=account_id,
                payee_id=payee_id,
                category_id=category_id
            )
            
            db_transaction = Transaction(**transaction_data.dict())
            db.add(db_transaction)
            transactions_created += 1
            
        except Exception as e:
            errors.append(f"Row {index + 1}: {str(e)}")
    
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
    account_id: int = Form(...),
    sheet_name: Optional[str] = Form(None),
    date_column: str = Form("date"),
    amount_column: str = Form("amount"),
    description_column: str = Form("description"),
    payee_column: Optional[str] = Form(None),
    category_column: Optional[str] = Form(None),
    transaction_type_column: Optional[str] = Form(None),
    default_transaction_type: TransactionType = Form(TransactionType.WITHDRAWAL),
    db: Session = Depends(get_db)
):
    """Import transactions from Excel file"""
    
    # Verify account exists
    account = db.query(Account).filter(Account.id == account_id).first()
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
    
    # Use same logic as CSV import
    # (This could be refactored into a common function)
    required_columns = [date_column, amount_column, description_column]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing_columns}")
    
    transactions_created = 0
    errors = []
    
    for index, row in df.iterrows():
        try:
            transaction_date = pd.to_datetime(row[date_column]).date()
            amount = float(row[amount_column])
            description = str(row[description_column]) if pd.notna(row[description_column]) else ""
            
            if transaction_type_column and transaction_type_column in df.columns:
                try:
                    transaction_type = TransactionType(row[transaction_type_column].lower())
                except (ValueError, AttributeError):
                    transaction_type = default_transaction_type
            else:
                transaction_type = default_transaction_type
            
            payee_id = None
            if payee_column and payee_column in df.columns and pd.notna(row[payee_column]):
                payee_id = create_or_get_payee(db, str(row[payee_column]))
            
            category_id = None
            if category_column and category_column in df.columns and pd.notna(row[category_column]):
                category_id = create_or_get_category(db, str(row[category_column]))
            
            transaction_data = TransactionCreate(
                date=transaction_date,
                amount=abs(amount),
                description=description,
                transaction_type=transaction_type,
                account_id=account_id,
                payee_id=payee_id,
                category_id=category_id
            )
            
            db_transaction = Transaction(**transaction_data.dict())
            db.add(db_transaction)
            transactions_created += 1
            
        except Exception as e:
            errors.append(f"Row {index + 1}: {str(e)}")
    
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
    account_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """Extract text from PDF using OCR (basic implementation)"""
    
    # Verify account exists
    account = db.query(Account).filter(Account.id == account_id).first()
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

@router.get("/column-mapping/{file_type}")
async def get_suggested_column_mapping(
    file: UploadFile = File(...),
    file_type: str = "csv"
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