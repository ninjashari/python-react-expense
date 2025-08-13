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
    LLMTransactionData, BatchImportRequest
)
from services.pdf_llm_processor import PDFLLMProcessor
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
    """Parse Excel file and return DataFrame"""
    try:
        df = pd.read_excel(io.BytesIO(file_content))
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