from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
import uuid


class LLMTransactionData(BaseModel):
    """Schema for LLM-extracted transaction data"""
    date: str = Field(..., description="Transaction date in YYYY-MM-DD format")
    amount: float = Field(..., description="Transaction amount (positive number)")
    description: str = Field(..., description="Transaction description")
    transaction_type: str = Field(..., description="Type: income, expense, or transfer")
    payee: Optional[str] = Field(None, description="Payee/merchant name")
    category: Optional[str] = Field(None, description="Transaction category")
    confidence: float = Field(default=0.8, description="Extraction confidence (0.0-1.0)")


class BatchImportRequest(BaseModel):
    """Request schema for batch transaction import"""
    transactions_data: List[LLMTransactionData] = Field(..., description="List of transactions to import")
    account_id: uuid.UUID = Field(..., description="Target account ID for imported transactions")


class PDFLLMImportRequest(BaseModel):
    """Request schema for PDF LLM import"""
    account_id: uuid.UUID = Field(..., description="Target account ID for imported transactions")
    llm_model: Optional[str] = Field("llama3.1", description="LLM model to use for extraction")
    preview_only: bool = Field(False, description="Only preview extraction, don't import")


class PDFLLMPreviewResponse(BaseModel):
    """Response schema for PDF LLM preview"""
    extraction_method: str = Field(..., description="Text extraction method used")
    text_length: int = Field(..., description="Length of extracted text")
    has_financial_data: bool = Field(..., description="Whether financial data was detected")
    estimated_processing_time: int = Field(..., description="Estimated processing time in seconds")
    preview_text: str = Field(..., description="Preview of extracted text")
    error: Optional[str] = Field(None, description="Error message if preview failed")


class PDFLLMImportResponse(BaseModel):
    """Response schema for PDF LLM import"""
    status: str = Field(..., description="Processing status: success, warning, or error")
    extraction_method: str = Field(..., description="Text extraction method used")
    extracted_text: str = Field(..., description="Full extracted text")
    transactions: List[LLMTransactionData] = Field(default_factory=list, description="Extracted transactions")
    processing_notes: List[str] = Field(default_factory=list, description="Processing step notes")
    transaction_count: Optional[int] = Field(None, description="Number of transactions extracted")
    error: Optional[str] = Field(None, description="Error message if processing failed")


class PDFLLMSystemStatusResponse(BaseModel):
    """Response schema for system status check"""
    pdf_processor: str = Field(..., description="PDF processor status")
    ollama_service: str = Field(..., description="Ollama service connection status")
    available_models: List[str] = Field(default_factory=list, description="Available LLM models")
    recommended_models: List[str] = Field(default_factory=list, description="Recommended LLM models")


class ImportResultsResponse(BaseModel):
    """Generic response schema for import operations"""
    message: str = Field(..., description="Success/error message")
    transactions_created: int = Field(default=0, description="Number of transactions created")
    errors: List[str] = Field(default_factory=list, description="List of processing errors")


class ColumnMappingResponse(BaseModel):
    """Response schema for column mapping suggestions"""
    columns: List[str] = Field(..., description="Available columns in the file")
    sample_data: List[Dict[str, Any]] = Field(..., description="Sample data rows")
    suggested_mappings: Dict[str, str] = Field(..., description="Suggested column mappings")


class TransactionImportData(BaseModel):
    """Schema for validated transaction import data"""
    date: str = Field(..., description="Transaction date")
    amount: float = Field(..., description="Transaction amount")
    description: str = Field(..., description="Transaction description")
    transaction_type: str = Field(..., description="Transaction type")
    account_id: uuid.UUID = Field(..., description="Account ID")
    payee_id: Optional[uuid.UUID] = Field(None, description="Payee ID")
    category_id: Optional[uuid.UUID] = Field(None, description="Category ID")
    user_id: uuid.UUID = Field(..., description="User ID")