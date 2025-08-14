from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
import uuid
import pandas as pd
import io
from datetime import datetime
from decimal import Decimal
import PyPDF2
import pytesseract
from PIL import Image
import openpyxl
from database import get_db
from models.transactions import Transaction
from models.accounts import Account
from models.users import User
from schemas.transactions import TransactionCreate
from schemas.import_schemas import (
    PDFLLMImportRequest, PDFLLMImportResponse, 
    PDFLLMPreviewResponse, PDFLLMSystemStatusResponse,
    XLSLLMImportRequest, XLSLLMImportResponse,
    XLSLLMPreviewResponse, XLSLLMSystemStatusResponse,
    LLMTransactionData, BatchImportRequest
)
from services.pdf_llm_processor import PDFLLMProcessor
from services.xls_llm_processor import XLSLLMProcessor
from services.ai_trainer import TransactionAITrainer
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
    """Parse Excel file and return DataFrame with smart header detection"""
    try:
        # First, try standard reading
        df = pd.read_excel(io.BytesIO(file_content))
        
        # Check if this looks like an ICICI bank statement by looking at column names
        # ICICI format has specific column headers that we can detect
        icici_header_found = False
        header_row = 0
        
        # Check if current column headers match ICICI format
        column_names = [str(col).lower() for col in df.columns]
        column_str = ' '.join(column_names)
        
        # ICICI specific patterns in column headers
        if ('transaction date' in column_str and 'withdrawal amount' in column_str and 'deposit amount' in column_str):
            print(f"Found ICICI bank format headers at row 0 (columns)")
            icici_header_found = True
        elif ('s no.' in column_str and 'transaction remarks' in column_str):
            print(f"Found ICICI bank format headers at row 0 (columns)")
            icici_header_found = True
        else:
            # Fallback: scan first 20 rows for ICICI-style headers
            for i in range(min(20, len(df))):
                row_values = [str(val).lower() for val in df.iloc[i].values if pd.notna(val)]
                row_str = ' '.join(row_values)
                
                # ICICI specific patterns
                if ('transaction date' in row_str and 'withdrawal amount' in row_str and 'deposit amount' in row_str):
                    print(f"Found ICICI bank format headers at row {i}")
                    header_row = i
                    icici_header_found = True
                    break
                elif ('s no.' in row_str and 'transaction remarks' in row_str):
                    print(f"Found ICICI bank format headers at row {i}")
                    header_row = i
                    icici_header_found = True
                    break
        
        # If ICICI format detected, handle accordingly
        if icici_header_found:
            if header_row > 0:
                # Re-read with proper header
                df = pd.read_excel(io.BytesIO(file_content), skiprows=header_row, date_format=None)
                # Clean up column names - remove extra spaces and standardize
                df.columns = [str(col).strip() if pd.notna(col) else f'Unnamed_{i}' 
                             for i, col in enumerate(df.columns)]
            else:
                # Headers are already at row 0, just ensure proper formatting
                df.columns = [str(col).strip() if pd.notna(col) else f'Unnamed_{i}' 
                             for i, col in enumerate(df.columns)]
            
            # Remove completely empty rows
            df = df.dropna(how='all')
            
            # For ICICI files, ensure date columns remain as strings to preserve DD/MM/YYYY format
            for col in df.columns:
                col_lower = str(col).lower()
                if 'transaction date' in col_lower or 'value date' in col_lower or 'date' in col_lower:
                    # Convert date column to string to preserve original format
                    df[col] = df[col].astype(str)
                    # Clean up any Excel date serial numbers that got converted
                    df[col] = df[col].replace('nan', '')
            
            # Replace NaN values with empty strings to avoid JSON serialization issues
            df = df.fillna('')
            
            print(f"ICICI format detected. Final columns: {list(df.columns)}")
            print(f"Data shape: {df.shape}")
            
            # Print sample date values for debugging
            date_col = None
            for col in df.columns:
                if 'transaction date' in str(col).lower():
                    date_col = col
                    break
            if date_col and len(df) > 0:
                print(f"Sample date values from {date_col}: {df[date_col].head(3).tolist()}")
        
        # Always clean NaN values to prevent JSON serialization errors
        df = df.fillna('')
        
        return df
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel: {str(e)}")


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
    withdrawal_column: Optional[str] = None,
    deposit_column: Optional[str] = None,
    default_transaction_type: str = "expense"
) -> tuple[int, List[str]]:
    """Process DataFrame rows and create transactions with AI categorization"""
    
    # Initialize AI trainer and train on historical data
    print(f"Training AI on user's historical transaction data...")
    ai_trainer = TransactionAITrainer(db, current_user.id)
    training_stats = ai_trainer.train_from_historical_data()
    print(f"AI training completed: {training_stats}")
    
    transactions_created = 0
    errors = []
    ai_predictions_made = 0
    
    for index, row in df.iterrows():
        try:
            # Parse transaction data - handle DD/MM/YYYY format for ICICI files
            date_value = str(row[date_column]).strip()
            
            # Check if this looks like DD/MM/YYYY format (ICICI style)
            if '/' in date_value and len(date_value.split('/')) == 3:
                try:
                    # Try parsing as DD/MM/YYYY first (ICICI format)
                    transaction_date = pd.to_datetime(date_value, format='%d/%m/%Y', dayfirst=True).date()
                except (ValueError, TypeError):
                    try:
                        # Fallback to automatic parsing with dayfirst=True
                        transaction_date = pd.to_datetime(date_value, dayfirst=True).date()
                    except (ValueError, TypeError):
                        # Last resort - pandas automatic parsing
                        transaction_date = pd.to_datetime(row[date_column]).date()
            else:
                # For other formats, use automatic parsing
                transaction_date = pd.to_datetime(row[date_column]).date()
            
            # Handle amount parsing for both single amount column and withdrawal/deposit columns
            if withdrawal_column and deposit_column:
                # ICICI style: separate withdrawal and deposit columns
                withdrawal_amt = float(row[withdrawal_column]) if pd.notna(row[withdrawal_column]) and str(row[withdrawal_column]).strip() != '' else 0.0
                deposit_amt = float(row[deposit_column]) if pd.notna(row[deposit_column]) and str(row[deposit_column]).strip() != '' else 0.0
                
                if withdrawal_amt > 0:
                    amount = withdrawal_amt
                    transaction_type = 'expense'  # Override for withdrawal
                elif deposit_amt > 0:
                    amount = deposit_amt
                    transaction_type = 'income'   # Override for deposit
                else:
                    continue  # Skip rows with no amount
            else:
                # Standard style: single amount column
                amount = float(row[amount_column])
                transaction_type = default_transaction_type
            
            description = str(row[description_column]) if pd.notna(row[description_column]) else ""
            
            # Determine transaction type (only override if transaction_type_column is specified)
            if transaction_type_column and transaction_type_column in df.columns:
                type_value = str(row[transaction_type_column]).lower().strip()
                if type_value in ['income', 'expense', 'transfer']:
                    transaction_type = type_value
            
            # Validate transaction type
            if transaction_type not in ['income', 'expense', 'transfer']:
                transaction_type = 'expense'  # Default fallback
            
            # Use AI to predict payee and category from existing entities only
            payee_id = None
            category_id = None
            
            ai_prediction = ai_trainer.predict_payee_and_category(
                description,
                transaction_type,
                amount
            )
            
            if ai_prediction['payee'] and ai_prediction['payee']['confidence'] >= 0.6:
                payee_id = ai_prediction['payee']['id']
                print(f"AI predicted payee: {ai_prediction['payee']['name']} (confidence: {ai_prediction['payee']['confidence']:.2f})")
                ai_predictions_made += 1
            
            if ai_prediction['category'] and ai_prediction['category']['confidence'] >= 0.6:
                category_id = ai_prediction['category']['id']
                print(f"AI predicted category: {ai_prediction['category']['name']} (confidence: {ai_prediction['category']['confidence']:.2f})")
                ai_predictions_made += 1
            
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
    
    print(f"AI made {ai_predictions_made} predictions for payees and categories")
    return transactions_created, errors, ai_predictions_made, training_stats

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
    transactions_created, errors, ai_predictions_made, training_stats = process_transactions_data(
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
        withdrawal_column=None,
        deposit_column=None,
        default_transaction_type=default_transaction_type
    )
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    return {
        "message": f"Successfully imported {transactions_created} transactions with {ai_predictions_made} AI predictions",
        "transactions_created": transactions_created,
        "ai_predictions_made": ai_predictions_made,
        "training_stats": training_stats,
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
    withdrawal_column: Optional[str] = Form(None),
    deposit_column: Optional[str] = Form(None),
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
        # Use the same parsing function as column mapping to support ICICI format
        df = parse_excel_data(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
    
    # Validate required columns exist - either amount_column OR (withdrawal_column + deposit_column)
    required_columns = [date_column, description_column]
    if withdrawal_column and deposit_column:
        # ICICI style: separate withdrawal and deposit columns
        required_columns.extend([withdrawal_column, deposit_column])
    else:
        # Standard style: single amount column
        required_columns.append(amount_column)
    
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing_columns}")
    
    # Process transactions using common utility function
    transactions_created, errors, ai_predictions_made, training_stats = process_transactions_data(
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
        withdrawal_column=withdrawal_column,
        deposit_column=deposit_column,
        default_transaction_type=default_transaction_type
    )
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    return {
        "message": f"Successfully imported {transactions_created} transactions with {ai_predictions_made} AI predictions",
        "transactions_created": transactions_created,
        "ai_predictions_made": ai_predictions_made,
        "training_stats": training_stats,
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
    
    # Filter out completely empty/unnamed columns and clean column names
    cleaned_columns = []
    for col in df.columns:
        col_str = str(col).strip()
        if col_str and col_str != 'nan' and not col_str.startswith('Unnamed'):
            cleaned_columns.append(col_str)
        elif col_str.startswith('Unnamed') and df[col].notna().any():
            # Keep unnamed columns that have data
            cleaned_columns.append(col_str)
    
    # If we lost too many columns, fall back to original
    if len(cleaned_columns) < 3:
        columns = [str(col) for col in df.columns.tolist()]
    else:
        columns = cleaned_columns
        # Update dataframe to only include these columns
        df = df[columns]
    
    # Clean up sample data - replace NaN with empty strings
    sample_data = df.head(3).fillna('').to_dict('records')
    
    # Enhanced heuristics for column mapping suggestions including ICICI bank format
    suggestions = {}
    
    for col in columns:
        col_lower = col.lower()
        col_str = str(col).lower()
        
        # Date column detection - prioritize Transaction Date over Value Date for ICICI
        if 'transaction date' in col_lower:
            suggestions['date'] = col
        elif any(keyword in col_lower for keyword in ['value date', 'date', 'time', 'when']) and 'date' not in suggestions:
            suggestions['date'] = col
        # Amount column detection (single amount column)
        elif any(keyword in col_lower for keyword in ['amount', 'value', 'sum', 'total']) and 'withdrawal' not in col_lower and 'deposit' not in col_lower:
            suggestions['amount'] = col
        # ICICI specific: Withdrawal/Debit column (exact match for ICICI format)
        elif 'withdrawal amount (inr' in col_lower or (any(keyword in col_lower for keyword in ['withdrawal', 'debit', 'out']) and 'amount' in col_lower):
            suggestions['withdrawal'] = col
        # ICICI specific: Deposit/Credit column (exact match for ICICI format)
        elif 'deposit amount (inr' in col_lower or (any(keyword in col_lower for keyword in ['deposit', 'credit', 'in']) and 'amount' in col_lower):
            suggestions['deposit'] = col
        # Description/Remarks column - prioritize Transaction Remarks for ICICI
        elif 'transaction remarks' in col_lower:
            suggestions['description'] = col
        elif any(keyword in col_lower for keyword in ['desc', 'description', 'memo', 'note', 'remarks']) and 'description' not in suggestions:
            suggestions['description'] = col
        # Payee column
        elif any(keyword in col_lower for keyword in ['payee', 'merchant', 'vendor', 'to', 'from']):
            suggestions['payee'] = col
        # Category column
        elif any(keyword in col_lower for keyword in ['category', 'type', 'class']) and 'transaction' not in col_lower:
            suggestions['category'] = col
        # Balance column
        elif any(keyword in col_lower for keyword in ['balance', 'running balance']):
            suggestions['balance'] = col
    
    # If we found both withdrawal and deposit columns, don't suggest a single amount column
    if 'withdrawal' in suggestions and 'deposit' in suggestions:
        suggestions.pop('amount', None)
    
    # If we have transaction date, use it over other date columns
    transaction_date_col = None
    for col in columns:
        if 'transaction date' in col.lower():
            transaction_date_col = col
            break
    if transaction_date_col:
        suggestions['date'] = transaction_date_col
    
    # Final cleanup - ensure no NaN values in the response
    cleaned_sample_data = []
    for row in sample_data:
        cleaned_row = {}
        for key, value in row.items():
            if pd.isna(value) or value is None:
                cleaned_row[key] = ""
            else:
                cleaned_row[key] = str(value) if not isinstance(value, (int, float, bool)) else value
        cleaned_sample_data.append(cleaned_row)
    
    # Clean suggestions dictionary
    cleaned_suggestions = {k: v for k, v in suggestions.items() if v is not None and str(v) != 'nan'}
    
    return {
        "columns": columns,
        "sample_data": cleaned_sample_data,
        "suggested_mappings": cleaned_suggestions
    }


@router.get("/pdf-llm/status")
async def get_pdf_llm_status(
    current_user: User = Depends(get_current_active_user)
) -> PDFLLMSystemStatusResponse:
    """Get status of PDF-LLM processing system"""
    try:
        processor = PDFLLMProcessor()
        status = processor.get_system_status()
        return PDFLLMSystemStatusResponse(**status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking system status: {str(e)}")


@router.post("/pdf-llm/preview")
async def preview_pdf_llm_extraction(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
) -> PDFLLMPreviewResponse:
    """Preview PDF text extraction without full LLM processing"""
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        content = await file.read()
        processor = PDFLLMProcessor()
        preview_result = processor.preview_extraction(content)
        return PDFLLMPreviewResponse(**preview_result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error previewing PDF: {str(e)}")


@router.post("/pdf-llm")
async def import_pdf_with_llm(
    file: UploadFile = File(...),
    account_id: uuid.UUID = Form(...),
    llm_model: Optional[str] = Form("llama3.1"),
    preview_only: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> PDFLLMImportResponse:
    """Import transactions from PDF using LLM extraction"""
    
    # Verify account exists and belongs to current user
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        content = await file.read()
        processor = PDFLLMProcessor(llm_model)
        
        # Process PDF and extract transactions
        result = processor.process_pdf_file(content)
        
        if preview_only or result["status"] != "success":
            return PDFLLMImportResponse(**result)
        
        # Initialize AI trainer and train on historical data
        print(f"Training AI on user's historical transaction data...")
        ai_trainer = TransactionAITrainer(db, current_user.id)
        training_stats = ai_trainer.train_from_historical_data()
        print(f"AI training completed: {training_stats}")
        
        # Import transactions to database
        transactions_created = 0
        errors = []
        ai_predictions_made = 0
        
        for transaction_data in result["transactions"]:
            try:
                # Convert LLM data to database format
                llm_transaction = LLMTransactionData(**transaction_data)
                
                # Use AI to predict payee and category from existing entities only
                payee_id = None
                category_id = None
                
                ai_prediction = ai_trainer.predict_payee_and_category(
                    llm_transaction.description,
                    llm_transaction.transaction_type,
                    llm_transaction.amount
                )
                
                if ai_prediction['payee'] and ai_prediction['payee']['confidence'] >= 0.6:
                    payee_id = ai_prediction['payee']['id']
                    print(f"AI predicted payee: {ai_prediction['payee']['name']} (confidence: {ai_prediction['payee']['confidence']:.2f})")
                    ai_predictions_made += 1
                
                if ai_prediction['category'] and ai_prediction['category']['confidence'] >= 0.6:
                    category_id = ai_prediction['category']['id']
                    print(f"AI predicted category: {ai_prediction['category']['name']} (confidence: {ai_prediction['category']['confidence']:.2f})")
                    ai_predictions_made += 1
                
                # Create transaction
                transaction_create = TransactionCreate(
                    date=llm_transaction.date,
                    amount=llm_transaction.amount,
                    description=llm_transaction.description,
                    type=llm_transaction.transaction_type,
                    account_id=account_id,
                    payee_id=payee_id,
                    category_id=category_id
                )
                
                db_transaction = Transaction(**transaction_create.model_dump(), user_id=current_user.id)
                db.add(db_transaction)
                
                # Update account balance
                update_account_balance(db, account_id, llm_transaction.amount, llm_transaction.transaction_type)
                
                transactions_created += 1
                
            except Exception as e:
                errors.append(f"Transaction {transactions_created + 1}: {str(e)}")
        
        # Commit all transactions
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
        # Update result with import statistics
        result["transactions_created"] = transactions_created
        result["import_errors"] = errors
        result["ai_predictions_made"] = ai_predictions_made
        result["training_stats"] = training_stats
        result["message"] = f"Successfully imported {transactions_created} transactions from PDF using LLM with {ai_predictions_made} AI predictions"
        print(f"AI made {ai_predictions_made} predictions for payees and categories")
        
        return PDFLLMImportResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF with LLM: {str(e)}")


@router.post("/transactions/batch")
async def import_transactions_batch(
    request: BatchImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import a batch of pre-processed transactions directly with AI categorization"""
    
    # Verify account exists and belongs to current user
    account = db.query(Account).filter(
        Account.id == request.account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Initialize AI trainer and train on historical data
    print(f"Training AI on user's historical transaction data...")
    ai_trainer = TransactionAITrainer(db, current_user.id)
    training_stats = ai_trainer.train_from_historical_data()
    print(f"AI training completed: {training_stats}")
    
    transactions_created = 0
    errors = []
    ai_predictions_made = 0
    
    try:
        print(f"Starting batch import of {len(request.transactions_data)} transactions")
        for i, transaction_data in enumerate(request.transactions_data):
            try:
                print(f"Processing transaction {i + 1}: {transaction_data.description}")
                print(f"Transaction data: date={transaction_data.date}, amount={transaction_data.amount}, type={transaction_data.transaction_type}")
                
                # Use AI to predict payee and category from existing entities only
                payee_id = None
                category_id = None
                
                ai_prediction = ai_trainer.predict_payee_and_category(
                    transaction_data.description,
                    transaction_data.transaction_type,
                    transaction_data.amount
                )
                
                if ai_prediction['payee'] and ai_prediction['payee']['confidence'] >= 0.6:
                    payee_id = ai_prediction['payee']['id']
                    print(f"AI predicted payee: {ai_prediction['payee']['name']} (confidence: {ai_prediction['payee']['confidence']:.2f})")
                    ai_predictions_made += 1
                
                if ai_prediction['category'] and ai_prediction['category']['confidence'] >= 0.6:
                    category_id = ai_prediction['category']['id']
                    print(f"AI predicted category: {ai_prediction['category']['name']} (confidence: {ai_prediction['category']['confidence']:.2f})")
                    ai_predictions_made += 1

                # Create the transaction
                # Parse date string to date object
                try:
                    transaction_date = datetime.strptime(transaction_data.date, '%Y-%m-%d').date()
                except ValueError:
                    # Try alternative date formats
                    transaction_date = datetime.strptime(transaction_data.date, '%Y-%m-%d').date()
                
                transaction = Transaction(
                    date=transaction_date,
                    amount=Decimal(str(transaction_data.amount)),
                    description=transaction_data.description,
                    type=transaction_data.transaction_type,
                    account_id=request.account_id,
                    payee_id=payee_id,
                    category_id=category_id,
                    user_id=current_user.id
                )
                
                db.add(transaction)
                db.flush()
                
                # Update account balance
                update_account_balance(db, request.account_id, float(transaction_data.amount), transaction_data.transaction_type)
                
                transactions_created += 1
                print(f"Successfully created transaction {i + 1}")
                
            except Exception as e:
                print(f"Error creating transaction {i + 1}: {str(e)}")
                # Don't rollback here, just log the error and continue
                errors.append(f"Transaction {i + 1}: {str(e)}")
                continue
        
        # Commit all transactions
        print(f"Committing {transactions_created} transactions to database")
        db.commit()
        print(f"Database commit successful")
        print(f"AI made {ai_predictions_made} predictions for payees and categories")
        
        return {
            "transactions_created": transactions_created,
            "import_errors": errors,
            "ai_predictions_made": ai_predictions_made,
            "training_stats": training_stats,
            "message": f"Successfully imported {transactions_created} transactions with {ai_predictions_made} AI predictions"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error importing transactions: {str(e)}")


# XLS LLM Import Endpoints

@router.get("/xls-llm/status")
async def get_xls_llm_status(
    current_user: User = Depends(get_current_active_user)
) -> XLSLLMSystemStatusResponse:
    """Get status of XLS-LLM processing system"""
    try:
        processor = XLSLLMProcessor()
        status_data = processor.get_system_status()
        return XLSLLMSystemStatusResponse(**status_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking XLS-LLM system status: {str(e)}")


@router.post("/xls-llm/preview")
async def preview_xls_llm_extraction(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
) -> XLSLLMPreviewResponse:
    """Preview XLS text extraction without full LLM processing"""
    
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(('.xls', '.xlsx')):
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Please upload an XLS or XLSX file."
        )
    
    try:
        print(f"DEBUG: XLS LLM preview endpoint called with file: {file.filename}")
        
        # Read file content
        file_content = await file.read()
        print(f"DEBUG: Read {len(file_content)} bytes from uploaded file")
        
        # Process with XLS LLM processor
        processor = XLSLLMProcessor()
        preview_data = processor.preview_extraction(file_content, file.filename)
        
        print(f"DEBUG: Preview data keys: {preview_data.keys()}")
        
        response = XLSLLMPreviewResponse(**preview_data)
        print(f"DEBUG: Created response successfully")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error previewing XLS file: {str(e)}")


@router.post("/xls-llm")
async def import_xls_with_llm(
    file: UploadFile = File(...),
    account_id: uuid.UUID = Form(...),
    llm_model: Optional[str] = Form("llama3.1"),
    preview_only: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> XLSLLMImportResponse:
    """Import transactions from XLS file using LLM processing"""
    
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(('.xls', '.xlsx')):
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Please upload an XLS or XLSX file."
        )
    
    # Verify account exists and belongs to current user
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Process with XLS LLM processor
        processor = XLSLLMProcessor(llm_model)
        result = processor.process_xls_file(file_content, file.filename)
        
        # If preview only, return early
        if preview_only:
            return XLSLLMImportResponse(**result)
        
        # If extraction failed, return the error result
        if result["status"] != "success":
            return XLSLLMImportResponse(**result)
        
        # Initialize AI trainer and train on historical data
        print(f"Training AI on user's historical transaction data...")
        ai_trainer = TransactionAITrainer(db, current_user.id)
        training_stats = ai_trainer.train_from_historical_data()
        print(f"AI training completed: {training_stats}")
        
        # Import the extracted transactions with AI predictions
        transactions_created = 0
        errors = []
        ai_predictions_made = 0
        
        try:
            print(f"Starting import of {len(result['transactions'])} transactions from XLS")
            for i, transaction_data in enumerate(result["transactions"]):
                try:
                    # Convert dict to LLMTransactionData object for consistency
                    if isinstance(transaction_data, dict):
                        transaction_obj = LLMTransactionData(**transaction_data)
                    else:
                        transaction_obj = transaction_data
                    
                    print(f"Processing transaction {i + 1}: {transaction_obj.description}")
                    
                    # Use AI to predict payee and category from existing entities only
                    payee_id = None
                    category_id = None
                    
                    ai_prediction = ai_trainer.predict_payee_and_category(
                        transaction_obj.description,
                        transaction_obj.transaction_type,
                        transaction_obj.amount
                    )
                    
                    if ai_prediction['payee'] and ai_prediction['payee']['confidence'] >= 0.6:
                        payee_id = ai_prediction['payee']['id']
                        print(f"AI predicted payee: {ai_prediction['payee']['name']} (confidence: {ai_prediction['payee']['confidence']:.2f})")
                        ai_predictions_made += 1
                    
                    if ai_prediction['category'] and ai_prediction['category']['confidence'] >= 0.6:
                        category_id = ai_prediction['category']['id']
                        print(f"AI predicted category: {ai_prediction['category']['name']} (confidence: {ai_prediction['category']['confidence']:.2f})")
                        ai_predictions_made += 1
                    
                    # Create the transaction
                    try:
                        transaction_date = datetime.strptime(transaction_obj.date, '%Y-%m-%d').date()
                    except ValueError:
                        print(f"Error parsing date: {transaction_obj.date}")
                        errors.append(f"Transaction {i + 1}: Invalid date format")
                        continue
                    
                    transaction = Transaction(
                        date=transaction_date,
                        amount=Decimal(str(transaction_obj.amount)),
                        description=transaction_obj.description,
                        type=transaction_obj.transaction_type,
                        account_id=account_id,
                        payee_id=payee_id,
                        category_id=category_id,
                        user_id=current_user.id
                    )
                    
                    db.add(transaction)
                    db.flush()
                    
                    # Update account balance
                    update_account_balance(db, account_id, float(transaction_obj.amount), transaction_obj.transaction_type)
                    
                    transactions_created += 1
                    print(f"Successfully created transaction {i + 1}")
                    
                except Exception as e:
                    print(f"Error creating transaction {i + 1}: {str(e)}")
                    errors.append(f"Transaction {i + 1}: {str(e)}")
                    continue
            
            # Commit all transactions
            print(f"Committing {transactions_created} transactions to database")
            db.commit()
            print(f"Database commit successful")
            
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
        # Update result with import statistics
        result["transactions_created"] = transactions_created
        result["import_errors"] = errors
        result["ai_predictions_made"] = ai_predictions_made
        result["training_stats"] = training_stats
        result["message"] = f"Successfully imported {transactions_created} transactions from XLS using LLM with {ai_predictions_made} AI predictions"
        print(f"AI made {ai_predictions_made} predictions for payees and categories")
        
        return XLSLLMImportResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing XLS with LLM: {str(e)}")