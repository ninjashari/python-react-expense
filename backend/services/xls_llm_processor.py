from typing import List, Dict, Any, Tuple
from fastapi import HTTPException
from .xls_processor import XLSProcessor
from .llm_service import LLMService, TransactionData


class XLSLLMProcessor:
    """Main orchestrator for XLS processing and LLM-based transaction extraction"""
    
    def __init__(self, llm_model: str = "llama3.1"):
        self.xls_processor = XLSProcessor()
        self.llm_service = LLMService(llm_model)
        
    def validate_prerequisites(self) -> Dict[str, bool]:
        """Check if all required services are available"""
        status = {
            "ollama_connected": self.llm_service.check_ollama_connection(),
            "models_available": len(self.llm_service.get_available_models()) > 0,
        }
        return status
    
    def process_xls_file(self, file_bytes: bytes, filename: str = "") -> Dict[str, Any]:
        """
        Complete pipeline: XLS → Text → LLM → Structured Transactions
        
        Returns:
        {
            "status": "success|error",
            "extraction_method": "openpyxl_xlsx|pandas_xls",
            "extracted_text": "...",
            "transactions": [...],
            "processing_notes": [...],
            "file_info": {...}
        }
        """
        processing_notes = []
        
        try:
            # Step 1: Validate prerequisites
            prereq_status = self.validate_prerequisites()
            if not prereq_status["ollama_connected"]:
                raise HTTPException(
                    status_code=503, 
                    detail="Ollama LLM service is not available. Please ensure Ollama is running."
                )
            
            if not prereq_status["models_available"]:
                raise HTTPException(
                    status_code=503,
                    detail="No LLM models available in Ollama. Please install a model (e.g., 'ollama pull llama3.1')"
                )
            
            processing_notes.append("Prerequisites validated successfully")
            
            # Step 2: Get file information
            file_info = self.xls_processor.get_file_info(file_bytes, filename)
            processing_notes.append(f"File detected as {file_info.get('format', 'unknown')} with {len(file_info.get('sheets', []))} sheets")
            
            # Step 3: Extract text from XLS
            extracted_text, extraction_method = self.xls_processor.process_xls_file(file_bytes, filename)
            processing_notes.append(f"Text extracted using: {extraction_method}")
            
            # Step 4: Validate extracted text quality
            if not self.xls_processor.validate_extracted_text(extracted_text):
                return {
                    "status": "error",
                    "extraction_method": extraction_method,
                    "extracted_text": extracted_text,
                    "transactions": [],
                    "processing_notes": processing_notes + ["Extracted text does not appear to contain financial data"],
                    "file_info": file_info,
                    "error": "No financial data detected in Excel file"
                }
            
            processing_notes.append("Financial data patterns detected in extracted text")
            
            # Step 5: Extract transactions using LLM with XLS-specific prompt
            transactions = self._extract_transactions_from_xls_text(extracted_text)
            processing_notes.append(f"LLM extracted {len(transactions)} transactions")
            
            # Step 6: Additional validation
            if not transactions:
                return {
                    "status": "warning",
                    "extraction_method": extraction_method,
                    "extracted_text": extracted_text,
                    "transactions": [],
                    "processing_notes": processing_notes + ["No transactions could be extracted from the text"],
                    "file_info": file_info,
                    "error": "LLM could not identify transaction data"
                }
            
            # Step 7: Return successful result
            return {
                "status": "success",
                "extraction_method": extraction_method,
                "extracted_text": extracted_text,
                "transactions": [transaction.model_dump() for transaction in transactions],
                "processing_notes": processing_notes,
                "file_info": file_info,
                "transaction_count": len(transactions)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            return {
                "status": "error",
                "extraction_method": "unknown",
                "extracted_text": "",
                "transactions": [],
                "processing_notes": processing_notes + [f"Unexpected error: {str(e)}"],
                "file_info": {},
                "error": str(e)
            }
    
    def _extract_transactions_from_xls_text(self, text: str) -> List[TransactionData]:
        """Extract transactions from XLS text using LLM with XLS-specific prompt"""
        if not text.strip():
            return []
        
        # Create XLS-specific prompt
        xls_prompt = self._create_xls_extraction_prompt(text)
        
        # Use the LLM service but with our custom prompt
        return self._extract_with_custom_prompt(text, xls_prompt)
    
    def _create_xls_extraction_prompt(self, text: str) -> str:
        """Create a specialized prompt for Excel/XLS transaction extraction"""
        return f"""
You are a financial data extraction expert specializing in Excel bank statement files. Extract ALL transaction information from the following Excel data and return ONLY a valid JSON array.

CRITICAL INSTRUCTIONS:
1. Return ONLY a JSON array of transactions, no other text or explanations
2. You MUST extract EVERY SINGLE transaction from the Excel data - do not miss any
3. Look through the ENTIRE text systematically, sheet by sheet if multiple sheets exist
4. Each transaction must have: date, amount, description, transaction_type
5. transaction_type must be exactly one of: "income", "expense", "transfer"
6. amount must be a positive number (no negative values, no currency symbols)
7. date must be in YYYY-MM-DD format (convert from any format found)
8. ONLY count actual transaction lines - skip headers, totals, and summary rows

EXCEL-SPECIFIC PATTERNS TO RECOGNIZE:
- Sheet headers like "=== SHEET: [Sheet Name] ==="
- Column headers: Date, Description, Amount, Debit, Credit, Balance, Transaction Type, etc.
- Data rows with pipe separators (|) between columns
- Multiple sheets may contain transactions
- Common Excel date formats: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, etc.
- Amount columns may be separate (Debit/Credit) or combined

TRANSACTION TYPE RULES FOR EXCEL DATA:
- Credits/Deposits (money coming in): "income" - includes: salary, interest, deposits, refunds, incoming transfers
- Debits/Withdrawals (money going out): "expense" - includes: purchases, ATM withdrawals, bill payments, fees, charges
- Account transfers: "transfer" - includes: internal transfers, NEFT, IMPS, wire transfers

EXCEL DATA STRUCTURE UNDERSTANDING:
1. Identify which columns contain dates, descriptions, and amounts
2. Handle both single amount columns and separate debit/credit columns
3. Process each sheet separately if multiple sheets exist
4. Ignore header rows, footer rows, and summary calculations
5. Focus on transaction data rows only

SYSTEMATIC APPROACH:
1. Identify all sheets in the Excel file
2. For each sheet, identify the column structure
3. Extract transaction rows (ignore headers and summaries)
4. Parse dates, amounts, and descriptions correctly
5. Classify each transaction as income, expense, or transfer
6. Ensure no transactions are missed or duplicated

COMMON EXCEL TRANSACTION FORMATS:
- Date | Description | Amount | Type
- Date | Description | Debit | Credit | Balance
- Date | Particulars | Withdrawal | Deposit | Balance
- Transaction Date | Narration | Amount | Dr/Cr | Balance

SPECIFIC CHECKS FOR EXCEL FILES:
- Look for transaction data in all sheets (may be named "Transactions", "Statement", "Account", etc.)
- Handle merged cells and formatting variations
- Process rows that contain actual transaction data
- Skip calculation formulas and pivot table summaries
- Be aware that Excel may have multiple transaction formats in different sheets

TEXT TO ANALYZE:
{text}

EXPECTED JSON FORMAT - EXTRACT ALL TRANSACTIONS:
[
  {{
    "date": "2017-01-15",
    "amount": 2500.00,
    "description": "Salary Credit - ICICI Bank",
    "transaction_type": "income",
    "payee": "ICICI Bank",
    "category": "Salary",
    "confidence": 0.9
  }},
  {{
    "date": "2017-01-16",
    "amount": 500.00,
    "description": "ATM Withdrawal - Main Branch",
    "transaction_type": "expense",
    "payee": "ICICI ATM",
    "category": "Cash Withdrawal",
    "confidence": 0.9
  }}
]

IMPORTANT: This is likely a year-long bank statement (Jan 2017 to Dec 2017). Expect a significant number of transactions. Look for patterns across all months and ensure comprehensive extraction.

CRITICAL VALIDATION: After extraction, verify your count:
- Look through ALL sheets for transaction data
- Count ONLY actual transaction lines (not headers, balances, or summaries)
- If this is a full year statement, expect hundreds of transactions
- Quality and completeness are critical - don't miss any legitimate transactions

Make sure you capture all transaction types:
- ALL salary credits and income
- ALL ATM withdrawals and cash transactions
- ALL bill payments and purchases
- ALL service charges and fees
- ALL transfer transactions
- ALL interest payments and charges

But EXCLUDE:
- Column headers and sheet titles
- Opening/closing balance lines
- Running balance amounts
- Summary totals and subtotals
- Pivot table data
- Cell formulas and calculations

JSON RESPONSE:"""

    def _extract_with_custom_prompt(self, text: str, prompt: str) -> List[TransactionData]:
        """Extract transactions using a custom prompt"""
        try:
            # Use the existing LLM service's extraction method but with our custom prompt
            return self.llm_service._extract_with_prompt(text, self.llm_service.model_name, prompt)
        except Exception as e:
            # Fallback to the standard extraction method
            return self.llm_service.extract_transactions(text)
    
    def preview_extraction(self, file_bytes: bytes, filename: str = "") -> Dict[str, Any]:
        """
        Preview extraction without full processing - useful for UI feedback
        """
        try:
            print(f"DEBUG: Starting preview_extraction for file: {filename}, size: {len(file_bytes)} bytes")
            
            # Get file information
            file_info = self.xls_processor.get_file_info(file_bytes, filename)
            print(f"DEBUG: File info: {file_info}")
            
            # Quick text extraction
            extracted_text, extraction_method = self.xls_processor.process_xls_file(file_bytes, filename)
            print(f"DEBUG: Text extracted, method: {extraction_method}, length: {len(extracted_text)}")
            
            # Basic validation
            has_financial_data = self.xls_processor.validate_extracted_text(extracted_text)
            print(f"DEBUG: Has financial data: {has_financial_data}")
            
            # Estimate processing time based on text length and number of sheets
            base_time = min(max(len(extracted_text) // 200, 10), 60)  # 10-60 seconds
            sheet_count = len(file_info.get('sheets', []))
            estimated_time = base_time + (sheet_count * 5)  # Add time for multiple sheets
            
            result = {
                "extraction_method": extraction_method,
                "text_length": len(extracted_text),
                "has_financial_data": has_financial_data,
                "estimated_processing_time": min(estimated_time, 120),  # Cap at 2 minutes
                "preview_text": extracted_text[:1000] + "..." if len(extracted_text) > 1000 else extracted_text,
                "file_info": file_info,
                "sheet_count": sheet_count
            }
            
            print(f"DEBUG: Preview result: {result}")
            return result
            
        except Exception as e:
            print(f"DEBUG: Preview extraction error: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                "error": str(e),
                "extraction_method": "failed",
                "text_length": 0,
                "has_financial_data": False,
                "estimated_processing_time": 0,
                "preview_text": "",
                "file_info": {},
                "sheet_count": 0
            }
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get status of all system components"""
        return {
            "xls_processor": "available",
            "ollama_service": "connected" if self.llm_service.check_ollama_connection() else "disconnected",
            "available_models": self.llm_service.get_available_models(),
            "recommended_models": ["llama3.1", "mistral", "llama3", "gemma"],
            "supported_formats": self.xls_processor.supported_extensions
        }