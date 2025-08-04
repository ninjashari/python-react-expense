#!/usr/bin/env python3
"""
Debug script to analyze PDF processing with the 01 June.pdf file
"""

import sys
import os
import json
sys.path.append('/home/abhinav/websites/python-react-expense/backend')

def debug_pdf_extraction():
    """Debug PDF text extraction"""
    print("🔍 DEBUG: PDF Text Extraction")
    print("=" * 50)
    
    try:
        from services.pdf_processor import PDFProcessor
        
        # Read the PDF file
        pdf_path = "/home/abhinav/websites/python-react-expense/01 June.pdf"
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()
        
        print(f"✅ PDF file loaded: {len(pdf_bytes)} bytes")
        
        processor = PDFProcessor()
        
        # Extract text
        extracted_text, method = processor.process_pdf(pdf_bytes)
        print(f"✅ Text extraction method: {method}")
        print(f"✅ Extracted text length: {len(extracted_text)} characters")
        
        print("\n📄 Extracted Text (first 1000 chars):")
        print("-" * 50)
        print(extracted_text[:1000])
        print("-" * 50)
        
        # Validate text
        has_financial_data = processor.validate_extracted_text(extracted_text)
        print(f"\n🔍 Has financial data: {has_financial_data}")
        
        return extracted_text, method
        
    except Exception as e:
        print(f"❌ PDF extraction failed: {e}")
        return None, None

def debug_llm_processing(extracted_text):
    """Debug LLM processing"""
    print("\n🤖 DEBUG: LLM Processing")
    print("=" * 50)
    
    try:
        from services.llm_service import LLMService
        
        service = LLMService("llama3.1")
        
        # Check connection
        if not service.check_ollama_connection():
            print("❌ Ollama connection failed")
            return None
        
        print("✅ Ollama connection successful")
        
        # Get available models
        models = service.get_available_models()
        print(f"✅ Available models: {models}")
        
        # Create prompt
        prompt = service.create_extraction_prompt(extracted_text)
        print(f"\n📝 Generated prompt length: {len(prompt)} characters")
        print("\n📝 Prompt (first 500 chars):")
        print("-" * 30)
        print(prompt[:500])
        print("-" * 30)
        
        # Try extraction
        print("\n🔄 Attempting transaction extraction...")
        transactions = service.extract_transactions(extracted_text)
        
        print(f"✅ Extraction successful: {len(transactions)} transactions found")
        
        for i, txn in enumerate(transactions):
            print(f"  Transaction {i+1}: {txn.date} - {txn.description} - ${txn.amount} ({txn.transaction_type})")
        
        return transactions
        
    except Exception as e:
        print(f"❌ LLM processing failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def debug_full_pipeline():
    """Debug the full PDF LLM pipeline"""
    print("\n🔄 DEBUG: Full Pipeline")
    print("=" * 50)
    
    try:
        from services.pdf_llm_processor import PDFLLMProcessor
        
        # Read the PDF file
        pdf_path = "/home/abhinav/websites/python-react-expense/01 June.pdf"
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()
        
        processor = PDFLLMProcessor("llama3.1")
        
        # Check prerequisites
        status = processor.validate_prerequisites()
        print(f"✅ Prerequisites: {status}")
        
        # Process PDF
        print("\n🔄 Processing PDF through full pipeline...")
        result = processor.process_pdf_file(pdf_bytes)
        
        print(f"✅ Pipeline result status: {result['status']}")
        print(f"✅ Extraction method: {result.get('extraction_method', 'unknown')}")
        print(f"✅ Transaction count: {result.get('transaction_count', 0)}")
        
        if result.get('processing_notes'):
            print("\n📋 Processing notes:")
            for note in result['processing_notes']:
                print(f"  - {note}")
        
        if result.get('error'):
            print(f"\n❌ Error: {result['error']}")
        
        return result
        
    except Exception as e:
        print(f"❌ Full pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("🐛 PDF LLM Debug Analysis")
    print("Using file: 01 June.pdf")
    print("=" * 60)
    
    # Step 1: Debug PDF extraction
    extracted_text, method = debug_pdf_extraction()
    
    if not extracted_text:
        print("❌ Cannot proceed - PDF extraction failed")
        return 1
    
    # Step 2: Debug LLM processing
    transactions = debug_llm_processing(extracted_text)
    
    # Step 3: Debug full pipeline
    result = debug_full_pipeline()
    
    print("\n" + "=" * 60)
    print("🎯 DEBUG SUMMARY:")
    print(f"  PDF extraction: {'✅ Success' if extracted_text else '❌ Failed'}")
    print(f"  LLM processing: {'✅ Success' if transactions else '❌ Failed'}")
    print(f"  Full pipeline: {'✅ Success' if result else '❌ Failed'}")
    
    if result and result.get('status') == 'success':
        print(f"  Final transaction count: {result.get('transaction_count', 0)}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())