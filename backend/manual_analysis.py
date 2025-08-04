#!/usr/bin/env python3
"""
Manual analysis of the PDF to identify all transactions
"""

import sys
sys.path.append('.')

from services.pdf_processor import PDFProcessor
import re

def analyze_pdf_manually():
    """Manually analyze the PDF for all potential transactions"""
    
    # Load PDF
    with open('01 June.pdf', 'rb') as f:
        pdf_bytes = f.read()
    
    processor = PDFProcessor()
    text, method = processor.process_pdf(pdf_bytes)
    
    print("=== MANUAL TRANSACTION ANALYSIS ===")
    print("Looking for all potential transaction patterns...\n")
    
    # Split into lines and analyze each
    lines = text.split('\n')
    
    potential_transactions = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
            
        # Look for lines with both dates and amounts
        has_date = bool(re.search(r'\d{2}[-/]\d{2}[-/]\d{4}', line))
        has_amount = bool(re.search(r'\d+\.\d{2}', line))
        
        if has_date and has_amount:
            # Extract date and amounts from this line
            dates = re.findall(r'\d{2}[-/]\d{2}[-/]\d{4}', line)
            amounts = re.findall(r'\d+\.\d{2}', line)
            
            print(f"POTENTIAL TRANSACTION LINE {i}:")
            print(f"  Text: {line}")
            print(f"  Dates found: {dates}")
            print(f"  Amounts found: {amounts}")
            
            # Try to determine transaction vs balance
            for amount in amounts:
                amount_val = float(amount)
                if amount_val < 10000:  # Likely transaction amount, not balance
                    potential_transactions.append({
                        'line': i,
                        'text': line,
                        'dates': dates,
                        'amount': amount_val,
                        'is_likely_transaction': True
                    })
            print()
    
    print("=== SUMMARY OF LIKELY TRANSACTIONS ===")
    for i, txn in enumerate(potential_transactions):
        print(f"Transaction {i+1}:")
        print(f"  Amount: ₹{txn['amount']}")
        print(f"  Dates: {txn['dates']}")
        print(f"  Context: {txn['text'][:100]}...")
        print()
    
    print(f"Total potential transactions found: {len(potential_transactions)}")
    
    # Also look for corrupted transaction patterns
    print("\n=== LOOKING FOR CORRUPTED PATTERNS ===")
    corrupted_patterns = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        # Look for lines with amounts but unclear text (OCR corruption)
        if re.search(r'\d+\.\d{2}', line) and len(line) > 10:
            amounts = re.findall(r'\d+\.\d{2}', line)
            for amount in amounts:
                if float(amount) < 1000 and float(amount) > 10:  # Reasonable transaction range
                    print(f"Line {i}: {line} (Amount: ₹{amount})")
                    corrupted_patterns.append(line)
    
    return potential_transactions

if __name__ == "__main__":
    analyze_pdf_manually()