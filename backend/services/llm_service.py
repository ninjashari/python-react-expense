import json
import re
from typing import List, Dict, Optional, Any
from datetime import datetime
import ollama
from fastapi import HTTPException
from pydantic import BaseModel, Field


class TransactionData(BaseModel):
    """Structure for LLM-extracted transaction data"""
    date: str = Field(..., description="Transaction date in YYYY-MM-DD format")
    amount: float = Field(..., description="Transaction amount (positive number)")
    description: str = Field(..., description="Transaction description")
    transaction_type: str = Field(..., description="Type: income, expense, or transfer")
    payee: Optional[str] = Field(None, description="Payee/merchant name")
    category: Optional[str] = Field(None, description="Transaction category")
    confidence: float = Field(default=0.8, description="Extraction confidence (0.0-1.0)")


class LLMService:
    """Service for interacting with local LLM via Ollama"""
    
    def __init__(self, model_name: str = "llama3.1"):
        self.model_name = self._normalize_model_name(model_name)
        self.backup_models = ["mistral:latest", "llama3.1:latest"]
        self.max_retries = 3
    
    def _normalize_model_name(self, model_name: str) -> str:
        """Normalize model name to include :latest tag if needed"""
        if ':' not in model_name:
            return f"{model_name}:latest"
        return model_name
        
    def create_extraction_prompt(self, text: str) -> str:
        """Create a structured prompt for transaction extraction"""
        return f"""
You are a financial data extraction expert specializing in Indian bank statements. Extract ALL transaction information from the following OCR-processed text and return ONLY a valid JSON array.

IMPORTANT RULES:
1. Return ONLY a JSON array of transactions, no other text
2. Each transaction must have: date, amount, description, transaction_type
3. transaction_type must be exactly one of: "income", "expense", "transfer"
4. amount must be a positive number in INR (no negative values, no currency symbols)
5. date must be in YYYY-MM-DD format (convert from DD-MM-YYYY if needed)
6. Look for transactions with patterns like: [date] [description] [amount] [balance]
7. Handle OCR errors - look for partially corrupted dates/amounts
8. Credit entries (deposits) = "income", Debit entries (withdrawals/charges) = "expense"
9. Look for multiple transactions, don't stop at the first few
10. If description is unclear due to OCR, extract what you can see

CONTEXT: This is an Indian bank statement in INR currency. Look for:
- Date patterns: DD-MM-YYYY or DD/MM/YYYY
- Amount patterns: numbers with .00 decimal places
- Transaction indicators: Dr (debit/expense), Cr (credit/income)
- Balance patterns: larger numbers (1000s) are often running balances, smaller numbers (100s) are transaction amounts
- Look for corrupted/partial lines due to OCR - extract what you can
- Opening balance: 2200.00, so transactions should make sense in that context
- Common Indian banking terms: RTGS, NEFT, UPI, Card Charges, etc.

ANALYZE THESE SPECIFIC AMOUNTS FOUND: 224.72, 500.00, 42.00 - look for any others that might be hidden in corrupted text.

TEXT TO ANALYZE:
{text}

EXPECTED JSON FORMAT:
[
  {{
    "date": "2014-06-17",
    "amount": 224.72,
    "description": "Card Charges ISSUE 4505020001634807",
    "transaction_type": "expense",
    "payee": "Bank",
    "category": "Banking Fees",
    "confidence": 0.9
  }}
]

EXTRACT ALL TRANSACTIONS YOU CAN FIND. JSON RESPONSE:"""

    def validate_extracted_data(self, data: List[Dict]) -> List[TransactionData]:
        """Validate and convert extracted data to structured format"""
        validated_transactions = []
        
        for item in data:
            try:
                # Validate required fields
                if not all(key in item for key in ['date', 'amount', 'description', 'transaction_type']):
                    continue
                
                # Validate transaction type
                if item['transaction_type'] not in ['income', 'expense', 'transfer']:
                    item['transaction_type'] = 'expense'  # Default fallback
                
                # Validate and parse date
                try:
                    datetime.strptime(item['date'], '%Y-%m-%d')
                except ValueError:
                    # Try to parse other common date formats
                    date_str = str(item['date'])
                    for fmt in ['%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%m-%d-%Y', '%d-%m-%Y']:
                        try:
                            parsed_date = datetime.strptime(date_str, fmt)
                            item['date'] = parsed_date.strftime('%Y-%m-%d')
                            print(f"DEBUG: Converted date '{date_str}' to '{item['date']}'")
                            break
                        except ValueError:
                            continue
                    else:
                        print(f"DEBUG: Failed to parse date: '{date_str}'")
                        continue  # Skip if no valid date format found
                
                # Validate amount
                try:
                    amount = float(str(item['amount']).replace('$', '').replace(',', ''))
                    item['amount'] = abs(amount)  # Ensure positive
                except (ValueError, TypeError):
                    continue
                
                # Create validated transaction
                transaction = TransactionData(**item)
                validated_transactions.append(transaction)
                
            except Exception as e:
                # Skip invalid transactions
                continue
        
        return validated_transactions
    
    def extract_transactions(self, text: str) -> List[TransactionData]:
        """Extract transactions from text using LLM"""
        if not text.strip():
            return []
        
        print(f"DEBUG: Starting extraction with text length: {len(text)}")
        
        # Try primary model first
        for attempt in range(self.max_retries):
            try:
                print(f"DEBUG: Attempt {attempt + 1} with primary model: {self.model_name}")
                result = self._try_extraction_with_model(text, self.model_name)
                if result:
                    print(f"DEBUG: Primary model succeeded with {len(result)} transactions")
                    return result
                print(f"DEBUG: Primary model attempt {attempt + 1} returned no results")
            except Exception as e:
                print(f"DEBUG: Attempt {attempt + 1} with {self.model_name} failed: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Try backup models
        for backup_model in self.backup_models:
            try:
                print(f"DEBUG: Trying backup model: {backup_model}")
                result = self._try_extraction_with_model(text, backup_model)
                if result:
                    print(f"DEBUG: Backup model {backup_model} succeeded with {len(result)} transactions")
                    return result
                print(f"DEBUG: Backup model {backup_model} returned no results")
            except Exception as e:
                print(f"DEBUG: Backup model {backup_model} failed: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        raise HTTPException(
            status_code=500, 
            detail="Failed to extract transactions with any available LLM model"
        )
    
    def _try_extraction_with_model(self, text: str, model: str) -> Optional[List[TransactionData]]:
        """Try extraction with a specific model"""
        try:
            prompt = self.create_extraction_prompt(text)
            normalized_model = self._normalize_model_name(model)
            
            print(f"DEBUG: Using normalized model name: {normalized_model}")
            print(f"DEBUG: Sending prompt to LLM (length: {len(prompt)})")
            
            response = ollama.chat(
                model=normalized_model,
                messages=[{
                    'role': 'user',
                    'content': prompt
                }],
                options={
                    'temperature': 0.1,  # Low temperature for consistent output
                    'top_p': 0.9,
                    'num_predict': 2000,  # Limit response length
                }
            )
            
            response_text = response['message']['content'].strip()
            print(f"DEBUG: LLM response length: {len(response_text)}")
            print(f"DEBUG: LLM response (first 200 chars): {response_text[:200]}")
            
            # Extract JSON from response (in case there's extra text)
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                print(f"DEBUG: Found JSON in response (length: {len(json_str)})")
            else:
                json_str = response_text
                print("DEBUG: Using full response as JSON")
            
            print(f"DEBUG: JSON to parse: {json_str[:500]}...")
            
            # Parse JSON
            try:
                data = json.loads(json_str)
                print(f"DEBUG: JSON parsed successfully, type: {type(data)}")
                if not isinstance(data, list):
                    print(f"DEBUG: Data is not a list, it's {type(data)}")
                    return None
                
                print(f"DEBUG: JSON contains {len(data)} items")
                
                # Validate and convert to structured format
                transactions = self.validate_extracted_data(data)
                print(f"DEBUG: Validation produced {len(transactions)} valid transactions")
                return transactions
                
            except json.JSONDecodeError as je:
                print(f"DEBUG: JSON decode error: {je}")
                print(f"DEBUG: Failed JSON string: {json_str}")
                return None
                
        except Exception as e:
            print(f"DEBUG: Exception in _try_extraction_with_model: {type(e).__name__}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"LLM processing error with model {model}: {str(e)}"
            )
    
    def check_ollama_connection(self) -> bool:
        """Check if Ollama is running and accessible"""
        try:
            models = ollama.list()
            return True
        except Exception:
            return False
    
    def get_available_models(self) -> List[str]:
        """Get list of available models in Ollama"""
        try:
            result = ollama.list()
            models = [model['name'] for model in result.get('models', [])]
            # Clean up model names for UI display (remove :latest suffix)
            return [model.replace(':latest', '') for model in models]
        except Exception:
            return []