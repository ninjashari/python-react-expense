from typing import List, Dict, Any, Tuple
from fastapi import HTTPException
from .pdf_processor import PDFProcessor
from .llm_service import LLMService, TransactionData


class PDFLLMProcessor:
    """Main orchestrator for PDF processing and LLM-based transaction extraction"""
    
    def __init__(self, llm_model: str = "llama3.1"):
        self.pdf_processor = PDFProcessor()
        self.llm_service = LLMService(llm_model)
        
    def validate_prerequisites(self) -> Dict[str, bool]:
        """Check if all required services are available"""
        status = {
            "ollama_connected": self.llm_service.check_ollama_connection(),
            "models_available": len(self.llm_service.get_available_models()) > 0,
        }
        return status
    
    def process_pdf_file(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Complete pipeline: PDF → Text → LLM → Structured Transactions
        
        Returns:
        {
            "status": "success|error",
            "extraction_method": "direct_text|ocr",
            "extracted_text": "...",
            "transactions": [...],
            "processing_notes": [...]
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
            
            # Step 2: Extract text from PDF
            extracted_text, extraction_method = self.pdf_processor.process_pdf(pdf_bytes)
            processing_notes.append(f"Text extracted using: {extraction_method}")
            
            # Step 3: Validate extracted text quality
            if not self.pdf_processor.validate_extracted_text(extracted_text):
                return {
                    "status": "error",
                    "extraction_method": extraction_method,
                    "extracted_text": extracted_text,
                    "transactions": [],
                    "processing_notes": processing_notes + ["Extracted text does not appear to contain financial data"],
                    "error": "No financial data detected in PDF"
                }
            
            processing_notes.append("Financial data patterns detected in extracted text")
            
            # Step 4: Extract transactions using LLM
            transactions = self.llm_service.extract_transactions(extracted_text)
            processing_notes.append(f"LLM extracted {len(transactions)} transactions")
            
            # Step 5: Additional validation
            if not transactions:
                return {
                    "status": "warning",
                    "extraction_method": extraction_method,
                    "extracted_text": extracted_text,
                    "transactions": [],
                    "processing_notes": processing_notes + ["No transactions could be extracted from the text"],
                    "error": "LLM could not identify transaction data"
                }
            
            # Step 6: Return successful result
            return {
                "status": "success",
                "extraction_method": extraction_method,
                "extracted_text": extracted_text,
                "transactions": [transaction.model_dump() for transaction in transactions],
                "processing_notes": processing_notes,
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
                "error": str(e)
            }
    
    def preview_extraction(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Preview extraction without full processing - useful for UI feedback
        """
        try:
            # Quick text extraction
            extracted_text, extraction_method = self.pdf_processor.process_pdf(pdf_bytes)
            
            # Basic validation
            has_financial_data = self.pdf_processor.validate_extracted_text(extracted_text)
            
            # Estimate processing time based on text length
            estimated_time = min(max(len(extracted_text) // 100, 5), 30)  # 5-30 seconds
            
            return {
                "extraction_method": extraction_method,
                "text_length": len(extracted_text),
                "has_financial_data": has_financial_data,
                "estimated_processing_time": estimated_time,
                "preview_text": extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "extraction_method": "failed",
                "has_financial_data": False
            }
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get status of all system components"""
        return {
            "pdf_processor": "available",
            "ollama_service": "connected" if self.llm_service.check_ollama_connection() else "disconnected",
            "available_models": self.llm_service.get_available_models(),
            "recommended_models": ["llama3.1", "mistral", "llama3", "gemma"]
        }