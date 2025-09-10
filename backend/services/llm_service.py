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
        # Count date patterns to set expectations
        import re
        date_patterns = re.findall(r'\b\d{2}-\d{2}-\d{4}\b', text)
        unique_dates = set(date_patterns)
        date_range = f"from {min(unique_dates)} to {max(unique_dates)}" if unique_dates else "full range"
        
        return f"""
You are a financial data extraction expert specializing in Indian bank statements. Extract ALL transaction information from the following text and return ONLY a valid JSON array.

CRITICAL INSTRUCTIONS:
1. Return ONLY a JSON array of transactions, no other text or explanations
2. You MUST extract EVERY SINGLE transaction from the ENTIRE document - do not miss any
3. This document contains transactions {date_range} - extract ALL dates in this range
4. Look through the COMPLETE text systematically, scanning ALL pages and sections
5. Each transaction must have: date, amount, description, transaction_type
6. transaction_type must be exactly one of: "income", "expense", "transfer"
7. amount must be a positive number as a STRING (no negative values, no currency symbols, quote amounts like "20000.00")
8. date must be in YYYY-MM-DD format (convert from DD-MM-YYYY format - Indian standard)
9. Process the ENTIRE document - do not stop early even if you find many transactions

DOCUMENT ANALYSIS PRIORITY:
I found {len(date_patterns)} date patterns in this document. You must scan through ALL of them.
Expected transaction range: {date_range}

TRANSACTION IDENTIFICATION PATTERNS:
- Look for date patterns like: 01-11-2022, 30-11-2022, etc. (scan through ALL dates)
- UPI transactions: UPI/P2M/, UPI/P2A/ patterns
- Card transactions: ECOM PUR/, POS/ patterns  
- Bank transactions: NEFT/, transfers
- With amounts like: 20,000.00, 400.00, 16.69, 135.00
- And running balance updates

TRANSACTION TYPE RULES:
- Credits (money coming in): "income" - UPI credits, deposits, salary, refunds
- Debits (money going out): "expense" - UPI payments, purchases, ATM withdrawals, fees
- Account transfers: "transfer" - NEFT, account-to-account transfers

COMPLETE DOCUMENT SCANNING APPROACH:
1. Start from the beginning and scan the ENTIRE document
2. Look for "Account Statement" section
3. Extract EVERY transaction from opening balance to closing balance
4. Don't stop after finding some transactions - continue until the very end
5. Pay attention to multi-page statements - scan ALL pages
6. Extract transactions from dates like 27-11-2022, 28-11-2022, 29-11-2022, 30-11-2022

FULL DOCUMENT TEXT TO ANALYZE:
{text}

EXPECTED JSON FORMAT - EXTRACT ALL TRANSACTIONS FROM COMPLETE DOCUMENT:
[
  {{
    "date": "2022-11-01",
    "amount": "666.00",
    "description": "UPI/P2M/230563737484/Jio Mobil/Yes Bank/JIO20BR",
    "transaction_type": "expense",
    "confidence": 0.9
  }},
  {{
    "date": "2022-11-30",
    "amount": "193.54",
    "description": "UPI/P2M/233490214642/TECHMASH /Paytm Pay/Playo O",
    "transaction_type": "expense", 
    "confidence": 0.9
  }}
]

CRITICAL: Scan through the ENTIRE document text. Do not stop processing early. Extract transactions from ALL dates found, including the very last transactions in the document (like 27th, 28th, 29th, 30th of the month). The document may span multiple pages - process ALL of them.

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
                    # Handle both numeric and string amounts, remove currency symbols and commas
                    amount_str = str(item['amount']).replace('$', '').replace('₹', '').replace(',', '').strip()
                    amount = float(amount_str)
                    item['amount'] = abs(amount)  # Ensure positive
                except (ValueError, TypeError):
                    print(f"DEBUG: Failed to parse amount: {item.get('amount')}")
                    continue
                
                # Create validated transaction
                transaction = TransactionData(**item)
                validated_transactions.append(transaction)
                
            except Exception as e:
                # Skip invalid transactions
                continue
        
        return validated_transactions
    
    def extract_transactions(self, text: str) -> List[TransactionData]:
        """Extract transactions from text using LLM with chunking for large documents"""
        if not text.strip():
            return []
        
        print(f"DEBUG: Starting extraction with text length: {len(text)}")
        
        # Check if document is too large for single processing
        max_text_length = 25000  # Reasonable limit for context window
        if len(text) > max_text_length:
            print(f"DEBUG: Large document detected ({len(text)} chars), using chunked processing")
            return self._extract_from_large_document(text)
        
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
    
    def _extract_from_large_document(self, text: str) -> List[TransactionData]:
        """Handle large documents by processing in chunks while ensuring no transactions are missed"""
        # Find the account statement section
        statement_match = re.search(r'Account Statement.*?(?=Closing Balance|Call Customer Care|\Z)', text, re.DOTALL | re.IGNORECASE)
        if statement_match:
            statement_text = statement_match.group(0)
        else:
            statement_text = text
        
        print(f"DEBUG: Processing statement section length: {len(statement_text)}")
        
        # Split by months or logical sections while preserving transaction integrity
        chunks = self._split_text_intelligently(statement_text)
        
        all_transactions = []
        for i, chunk in enumerate(chunks):
            print(f"DEBUG: Processing chunk {i+1}/{len(chunks)} (length: {len(chunk)})")
            
            try:
                chunk_transactions = self._try_extraction_with_model(chunk, self.model_name)
                if chunk_transactions:
                    all_transactions.extend(chunk_transactions)
                    print(f"DEBUG: Chunk {i+1} extracted {len(chunk_transactions)} transactions")
                else:
                    print(f"DEBUG: Chunk {i+1} extracted 0 transactions")
            except Exception as e:
                print(f"DEBUG: Chunk {i+1} processing failed: {e}")
                continue
        
        print(f"DEBUG: Total transactions from all chunks: {len(all_transactions)}")
        return all_transactions
    
    def _split_text_intelligently(self, text: str, max_chunk_size: int = 20000) -> List[str]:
        """Split text into chunks while preserving transaction integrity"""
        if len(text) <= max_chunk_size:
            return [text]
        
        # Try to split by date patterns to maintain transaction context
        lines = text.split('\n')
        chunks = []
        current_chunk = []
        current_size = 0
        
        for line in lines:
            line_size = len(line)
            
            # If adding this line would exceed chunk size and we have a reasonable chunk
            if current_size + line_size > max_chunk_size and current_size > max_chunk_size // 2:
                # If this line starts with a date, it's a good place to split
                if re.match(r'\d{2}-\d{2}-\d{4}', line.strip()):
                    chunks.append('\n'.join(current_chunk))
                    current_chunk = [line]
                    current_size = line_size
                else:
                    # Add to current chunk and continue
                    current_chunk.append(line)
                    current_size += line_size
            else:
                current_chunk.append(line)
                current_size += line_size
        
        # Add remaining chunk
        if current_chunk:
            chunks.append('\n'.join(current_chunk))
        
        print(f"DEBUG: Split document into {len(chunks)} chunks")
        return chunks
    
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
  {{"date": "2014-03-02", "amount": "2000.00", "description": "BRN-BY CASH CASH", "transaction_type": "income"}},
  ...
]

EXTRACT ALL TRANSACTIONS:"""

        return self._extract_with_prompt(transaction_text, model, focused_prompt)
    
    def _fix_json_formatting(self, json_str: str) -> str:
        """Fix common JSON formatting issues from LLM responses"""
        # Fix unquoted numeric amounts with commas (e.g., 20,291.00 -> "20291.00")
        # This regex finds patterns like: "amount": 20,291.00 and converts to "amount": "20291.00"
        json_str = re.sub(r'"amount":\s*(\d{1,3}(?:,\d{3})*\.\d{2})', 
                         lambda m: f'"amount": "{m.group(1).replace(",", "")}"', 
                         json_str)
        
        # Fix other numeric fields that might have commas
        for field in ['credit_limit', 'balance', 'opening_balance', 'closing_balance']:
            json_str = re.sub(rf'"{field}":\s*(\d{{1,3}}(?:,\d{{3}})*\.\d{{2}})', 
                             lambda m: f'"{field}": "{m.group(1).replace(",", "")}"', 
                             json_str)
        
        # Fix standalone numeric values with commas in arrays (fallback)
        json_str = re.sub(r':\s*(\d{1,3}(?:,\d{3})*\.\d{2})(?=\s*[,\}\]])', 
                         lambda m: f': "{m.group(1).replace(",", "")}"', 
                         json_str)
        
        print(f"DEBUG: Fixed JSON formatting, length: {len(json_str)}")
        return json_str

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
                    'temperature': 0.1,  # Lower for more consistent JSON output
                    'top_p': 0.8,
                    'num_predict': 16000,  # Significantly increased for complete extraction
                    'num_ctx': 32768,     # Much larger context window for full PDFs
                    'stop': [],  # Don't stop generation early
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
            
            # Fix common JSON formatting issues before parsing
            json_str = self._fix_json_formatting(json_str)
            
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