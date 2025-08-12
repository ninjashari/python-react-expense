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
You are a financial data extraction expert specializing in Indian bank statements. Extract ALL transaction information from the following text and return ONLY a valid JSON array.

CRITICAL INSTRUCTIONS:
1. Return ONLY a JSON array of transactions, no other text or explanations
2. You MUST extract EVERY SINGLE transaction from the statement - do not miss any
3. Look through the ENTIRE text systematically, line by line
4. Each transaction must have: date, amount, description, transaction_type
5. transaction_type must be exactly one of: "income", "expense", "transfer"
6. amount must be a positive number (no negative values, no currency symbols)
7. date must be in YYYY-MM-DD format (convert from DD-MM-YYYY format - Indian standard)
8. ONLY count actual transaction lines - skip balance lines, headers, and non-transaction entries

TRANSACTION IDENTIFICATION PATTERNS:
- Look for date patterns like: 07-10-2014, 09-10-2014, etc. (any month/year)
- Followed by transaction descriptions like: ATM-CASH, BY CASH DEPOSIT, PUR/, Service Tax, Consolidated Charges
- With amounts like: 20,000.00, 400.00, 16.69, 135.00
- And running balance updates
- Structured format: DATE | DESCRIPTION | AMOUNT | BALANCE (if available)

TRANSACTION TYPE RULES:
- Deposits/Credits (money coming in): "income" - includes: "BY CASH DEPOSIT", "By Clg/" (cheque deposits), salary credits, interest payments
- Withdrawals/Debits (money going out): "expense" - includes: "ATM-CASH", "PUR/" (purchases/payments), "Service Tax", "Consolidated Charges", mobile recharges, fees
- Transfers between accounts: "transfer" - includes: account-to-account transfers, NEFT, IMPS (but analyze context carefully)

SYSTEMATIC APPROACH:
1. Start from the beginning of the account statement section
2. Look for the "Opening Balance" line
3. Then extract EVERY transaction line that follows
4. Continue until you reach "Closing Balance"
5. Do NOT skip any transaction lines
6. Pay special attention to consecutive dates like 23-09-2014 which might have multiple transactions

COMMON BANK STATEMENT STRUCTURE:
Txn Date | Transaction Description | Withdrawals | Deposits | Balance

SPECIFIC CHECKS FOR ANY STATEMENT:
- Scan through ALL dates in the statement (could be any month/year)
- Multiple transactions can occur on the same date - don't miss any
- Look for transaction patterns: ATM-CASH, PUR/, BY CASH DEPOSIT, BRN-BY CASH, etc.
- Check for mobile recharge transactions (Bharti Airtel, TATA DOCOMO, etc.)
- Find all cash deposits and withdrawals
- Include service charges, fees, and tax deductions as transactions
- Look for transfer transactions (TRFR, NEFT, IMPS, etc.)

TEXT TO ANALYZE:
{text}

EXPECTED JSON FORMAT - EXTRACT ALL TRANSACTIONS:
[
  {{
    "date": "2014-10-07",
    "amount": 20000.00,
    "description": "By Clg/061193/PNB /CHANDIGARH",
    "transaction_type": "income",
    "payee": "PNB Bank",
    "category": "Bank Transfer",
    "confidence": 0.9
  }},
  {{
    "date": "2014-10-09",
    "amount": 400.00,
    "description": "ATM-CASH/JP UNIVERSITY,WAKH/SOLAN/091014",
    "transaction_type": "expense",
    "payee": "JP University ATM",
    "category": "Cash Withdrawal",
    "confidence": 0.9
  }}
]

IMPORTANT: Count the transactions as you extract them. Look for ALL lines with dates and amounts. Each line with a date pattern (DD-MM-YYYY) followed by transaction description and amount should be a separate transaction.

CRITICAL VALIDATION: After extraction, verify your count:
- Count ONLY actual transaction lines (date + description + amount)
- Do NOT count balance lines, header lines, or summary lines
- Do NOT count the same transaction twice
- If extracting from a March 2014 statement with 17 actual transactions, return exactly 17 transactions
- Quality over quantity - accurate extraction is more important than hitting a target number

Make sure you capture all legitimate transactions:
- ALL ATM withdrawals 
- ALL cash deposits
- ALL purchases and payments (PUR/ entries)
- ALL service charges and fees
- ALL mobile recharges and bill payments
- ALL transfer transactions

But EXCLUDE:
- Opening balance lines
- Closing balance lines
- Running balance amounts
- Header/footer information
- Page numbers or branch details

JSON RESPONSE:"""

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
                    # Try to parse other common date formats, prioritizing DD/MM/YYYY for Indian bank statements
                    date_str = str(item['date'])
                    # Prioritize DD/MM/YYYY and DD-MM-YYYY formats first for Indian statements
                    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%Y/%m/%d', '%m-%d-%Y', '%Y-%m-%d']:
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
        
        # Estimate expected transaction count from text patterns
        date_patterns = len(re.findall(r'\b\d{2}-\d{2}-\d{4}\b', text))
        expected_min_transactions = max(10, date_patterns // 2)  # Conservative estimate
        print(f"DEBUG: Found {date_patterns} date patterns, expecting at least {expected_min_transactions} transactions")
        
        best_result = []
        
        # Try primary model first
        for attempt in range(self.max_retries):
            try:
                print(f"DEBUG: Attempt {attempt + 1} with primary model: {self.model_name}")
                result = self._try_extraction_with_model(text, self.model_name)
                if result:
                    print(f"DEBUG: Primary model succeeded with {len(result)} transactions")
                    
                    # If we got a good number of transactions, return immediately
                    if len(result) >= expected_min_transactions:
                        return result
                    
                    # Otherwise, keep trying but save this as backup
                    if len(result) > len(best_result):
                        best_result = result
                        print(f"DEBUG: Saving {len(result)} transactions as best result so far")
                        
                print(f"DEBUG: Primary model attempt {attempt + 1} returned {len(result) if result else 0} results")
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
                    
                    # If we got a good number of transactions, return immediately
                    if len(result) >= expected_min_transactions:
                        return result
                    
                    # Otherwise, keep the best result
                    if len(result) > len(best_result):
                        best_result = result
                        print(f"DEBUG: Updating best result to {len(result)} transactions")
                        
                print(f"DEBUG: Backup model {backup_model} returned {len(result) if result else 0} results")
            except Exception as e:
                print(f"DEBUG: Backup model {backup_model} failed: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # If we have any results, return the best one
        if best_result:
            print(f"DEBUG: Returning best result with {len(best_result)} transactions")
            return best_result
        
        raise HTTPException(
            status_code=500, 
            detail="Failed to extract transactions with any available LLM model"
        )
    
    def _try_extraction_with_model(self, text: str, model: str) -> Optional[List[TransactionData]]:
        """Try extraction with a specific model"""
        try:
            # Estimate expected transaction count
            date_patterns = len(re.findall(r'\b\d{2}-\d{2}-\d{4}\b', text))
            expected_min_transactions = max(10, date_patterns // 2)  # Conservative estimate
            good_result_threshold = min(expected_min_transactions, 15)  # Don't be too greedy initially
            
            print(f"DEBUG: Expected min {expected_min_transactions} transactions, good result threshold: {good_result_threshold}")
            
            # First try with the enhanced prompt
            result = self._extract_with_prompt(text, model, self.create_extraction_prompt(text))
            
            if result and len(result) >= good_result_threshold:  # If we got a good result, return it
                return result
            
            # If we didn't get enough results, try a simpler, more focused approach
            print(f"DEBUG: First attempt yielded {len(result) if result else 0} transactions, trying focused extraction")
            focused_result = self._extract_with_focused_prompt(text, model)
            
            # Return the better result
            if focused_result and len(focused_result) > len(result if result else []):
                return focused_result
            
            return result
                
        except Exception as e:
            print(f"DEBUG: Exception in _try_extraction_with_model: {type(e).__name__}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"LLM processing error with model {model}: {str(e)}"
            )
    
    def _extract_with_focused_prompt(self, text: str, model: str) -> Optional[List[TransactionData]]:
        """Try extraction with a hybrid regex+LLM approach for difficult cases"""
        # First, use regex to pre-extract transaction candidates
        transaction_candidates = self._extract_transactions_with_regex(text)
        
        if len(transaction_candidates) < 5:
            # If regex didn't find much, fall back to pure LLM
            return self._pure_llm_extraction(text, model)
        
        # Convert regex results to TransactionData objects directly
        # The regex extraction is already quite good, so we can use it directly
        validated_transactions = []
        
        for candidate in transaction_candidates:
            try:
                # Validate and convert to TransactionData
                transaction = TransactionData(**candidate)
                validated_transactions.append(transaction)
            except Exception as e:
                print(f"DEBUG: Failed to validate transaction: {e}")
                continue
        
        print(f"DEBUG: Converted {len(validated_transactions)} regex results to TransactionData objects")
        return validated_transactions
    
    def _extract_transactions_with_regex(self, text: str) -> List[Dict]:
        """Extract transaction candidates using regex patterns with tabular structure understanding"""
        # Find the account statement section
        account_statement_match = re.search(r'Account Statement.*?(?=Closing Balance|Call Customer Care|\Z)', text, re.DOTALL | re.IGNORECASE)
        if not account_statement_match:
            return []
        
        statement_text = account_statement_match.group(0)
        lines = [line.strip() for line in statement_text.split('\n') if line.strip()]
        
        print(f"DEBUG: Regex extraction processing {len(lines)} lines from account statement")
        date_pattern_count = 0
        
        transactions = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Skip header lines, opening balance, and other non-transaction lines
            if any(header in line.upper() for header in [
                'TXN DATE', 'TRANSACTION', 'WITHDRAWALS', 'DEPOSITS', 'BALANCE',
                'OPENING BALANCE', 'CLOSING BALANCE', 'ACCOUNT STATEMENT', 'OTHER INFORMATION',
                'PAGE', 'BRANCH', 'CUSTOMER', 'ACCOUNT NO', 'STATEMENT FROM', 'STATEMENT TO',
                'IFSC', 'MICR', 'BRANCH CODE', 'EMAIL', 'MOBILE'
            ]):
                i += 1
                continue
            
            # Skip lines that are just numbers (likely balances without context)
            if re.match(r'^\d{1,3}(?:,\d{3})*\.\d{2}$', line.strip()):
                i += 1
                continue
            
            # Look for date pattern at start of line
            date_match = re.match(r'^(\d{2}-\d{2}-\d{4})', line)
            if not date_match:
                i += 1
                continue
            
            date_pattern_count += 1
                
            # Found a transaction line
            date_str = date_match.group(1)
            
            # Parse the date
            try:
                from datetime import datetime
                parsed_date = datetime.strptime(date_str, '%d-%m-%Y')
                formatted_date = parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                i += 1
                continue
            
            # Extract description (everything after the date)
            description = line[len(date_str):].strip()
            
            # Skip if description looks like it's just continuation or empty
            if not description or len(description) < 3:
                i += 1
                continue
            
            # Look ahead for continuation lines and amounts
            full_description = description
            withdrawal_amount = None
            deposit_amount = None
            found_amount = False
            
            # Check the next few lines for continuation and amounts
            j = i + 1
            while j < len(lines) and j < i + 5:  # Look at next 4 lines max
                next_line = lines[j].strip()
                
                # If we hit another date, stop
                if re.match(r'^\d{2}-\d{2}-\d{4}', next_line):
                    break
                
                # Check if this line is an amount (withdrawal or deposit)
                amount_match = re.match(r'^(\d{1,3}(?:,\d{3})*\.\d{2})$', next_line)
                if amount_match and not found_amount:  # Only take the first amount we find
                    amount_val = float(amount_match.group(1).replace(',', ''))
                    
                    # Determine if this is withdrawal or deposit based on transaction type
                    if any(keyword in full_description.upper() for keyword in [
                        'BY CASH', 'DEPOSIT', 'TRFR-FROM', 'CASH-RVSL', 'INT.PD', 'CREDIT'
                    ]):
                        deposit_amount = amount_val
                    else:
                        withdrawal_amount = amount_val
                    found_amount = True
                    j += 1
                    continue
                
                # Skip balance lines (usually larger numbers or come after amounts)
                if re.match(r'^(\d{1,3}(?:,\d{3})*\.\d{2})$', next_line) and found_amount:
                    j += 1
                    continue
                
                # Otherwise, it might be a continuation of description (but be selective)
                if (not re.match(r'^\d+', next_line) and 
                    len(next_line) > 3 and 
                    not found_amount and  # Only add description continuations before we find the amount
                    not any(skip_word in next_line.upper() for skip_word in ['PAGE', 'BRANCH', 'CUSTOMER'])):
                    full_description += " " + next_line
                
                j += 1
            
            # Determine transaction type and amount
            if deposit_amount:
                transaction_type = "income"
                amount = deposit_amount
            elif withdrawal_amount:
                transaction_type = "expense"
                amount = withdrawal_amount
            else:
                # No explicit amount found, skip this transaction
                i += 1
                continue
            
            # Additional validation: skip if description is too generic or likely not a real transaction
            if (len(full_description.strip()) < 5 or 
                any(generic in full_description.upper() for generic in [
                    'OPENING BALANCE', 'CLOSING BALANCE', 'TOTAL', 'CARRIED FORWARD'
                ]) or
                amount == 0):
                i += 1
                continue
            
            # Create the transaction
            transaction = {
                "date": formatted_date,
                "amount": amount,
                "description": full_description.strip(),
                "transaction_type": transaction_type,
                "confidence": 0.9
            }
            
            transactions.append(transaction)
            print(f"DEBUG: Added transaction {len(transactions)}: {formatted_date} | {transaction_type} | {amount} | {full_description.strip()[:50]}...")
            i = j  # Move to the next unprocessed line
        
        print(f"DEBUG: Found {date_pattern_count} date patterns, extracted {len(transactions)} transaction candidates")
        for i, txn in enumerate(transactions[:5]):
            print(f"DEBUG:   {i+1}: {txn['date']} | {txn['transaction_type']} | {txn['amount']} | {txn['description'][:50]}...")
        
        return transactions
    
    def _pure_llm_extraction(self, text: str, model: str) -> Optional[List[TransactionData]]:
        """Fallback to pure LLM extraction"""
        # Extract just the transaction section
        account_statement_match = re.search(r'Account Statement.*?(?=Call Customer Care|\Z)', text, re.DOTALL | re.IGNORECASE)
        if account_statement_match:
            transaction_text = account_statement_match.group(0)
        else:
            transaction_text = text
        
        focused_prompt = f"""
Extract ALL transactions from this bank statement. Return ONLY JSON array.

Key patterns to find:
- Date: DD-MM-YYYY format (convert to YYYY-MM-DD)
- Description: ATM-CASH, BRN-BY CASH, PUR/, BY CASH DEPOSIT, etc.
- Amount: Numbers with .00 
- Type: income (deposits/credits), expense (withdrawals/debits)

IMPORTANT: 
- Only extract actual transaction lines (date + description + amount)
- Skip balance lines, headers, summaries
- Convert DD-MM-YYYY dates to YYYY-MM-DD format
- If this is a March 2014 statement, ensure accurate count (should be around 17 transactions)

TEXT:
{transaction_text}

JSON format:
[
  {{"date": "2014-03-02", "amount": 2000.00, "description": "BRN-BY CASH CASH", "transaction_type": "income"}},
  ...
]

EXTRACT ALL TRANSACTIONS:"""

        return self._extract_with_prompt(transaction_text, model, focused_prompt)
    
    def _extract_with_prompt(self, text: str, model: str, prompt: str) -> Optional[List[TransactionData]]:
        """Extract transactions with a given prompt"""
        try:
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
                    'temperature': 0.2,  # Slightly higher for better extraction
                    'top_p': 0.9,
                    'num_predict': 8000,  # Increased for more complete extraction
                    'num_ctx': 8192,     # Increased context window for longer PDFs
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
            print(f"DEBUG: Exception in _extract_with_prompt: {type(e).__name__}: {e}")
            return None
    
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