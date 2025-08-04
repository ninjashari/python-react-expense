# PDF LLM Import Feature - Action Plan

## Overview
Implementation of intelligent PDF parsing using open-source Large Language Models (LLMs) to automatically extract transaction data from PDF documents, with automatic detection of text-based vs OCR-required PDFs.

## Project Goals
- Parse any PDF document containing financial transaction data
- Automatically detect if PDF contains extractable text or requires OCR
- Use local LLMs to intelligently extract structured transaction data
- Integrate seamlessly with existing import workflow
- Provide user review/edit capabilities before final import

## Technical Architecture

### Core Components
1. **PDF Processing Pipeline**: Text extraction → OCR fallback → LLM analysis
2. **LLM Integration**: Local Ollama server with multiple model support
3. **Backend API**: New endpoint `/import/pdf-llm` with structured response
4. **Frontend Interface**: Enhanced import UI with progress tracking

### Technology Stack
- **PDF Processing**: PyMuPDF (fitz) for text extraction
- **OCR Engine**: Tesseract OCR for scanned documents
- **LLM Platform**: Ollama (local hosting of Llama 3.1, Mistral, etc.)
- **Backend**: FastAPI with new service classes
- **Frontend**: React with enhanced import workflow

## Implementation Plan

### Phase 1: Backend Foundation (Steps 1-7)

#### Step 1: Dependencies & Environment Setup
**Files to modify**: `backend/requirements.txt`
- Add PyMuPDF for better PDF text extraction
- Add Ollama Python client for LLM communication
- Update existing Tesseract/OCR dependencies

#### Step 2: PDF Processing Service
**Files to create**: `backend/services/pdf_processor.py`
- `PDFTextExtractor`: Extract text using PyMuPDF/fitz
- `OCRProcessor`: Tesseract integration for image-based PDFs
- `PDFAnalyzer`: Determine if PDF needs OCR processing

#### Step 3: LLM Integration Service
**Files to create**: `backend/services/llm_service.py`
- `OllamaClient`: Interface with local Ollama server
- `PromptTemplates`: Structured prompts for transaction extraction
- `LLMProcessor`: Orchestrate LLM calls with retry logic

#### Step 4: Main PDF-LLM Processor
**Files to create**: `backend/services/pdf_llm_processor.py`
- `PDFLLMProcessor`: Main orchestration class
- Combine PDF processing + LLM analysis
- Output structured transaction data matching app schemas

#### Step 5: API Endpoint Implementation
**Files to modify**: `backend/routers/import_data.py`
- Add `/import/pdf-llm` endpoint
- Multi-step processing with progress updates
- Error handling and validation

#### Step 6: Schema Extensions
**Files to modify**: `backend/schemas/import_schemas.py`
- `PDFLLMImportRequest`: Request schema
- `PDFLLMImportResponse`: Response with extracted transactions
- `LLMExtractionResult`: Structured LLM output

#### Step 7: Error Handling & Validation
**Files to modify**: Various backend files
- LLM connection validation
- PDF format validation
- Transaction data validation

### Phase 2: Frontend Integration (Steps 8-10)

#### Step 8: Import UI Enhancement
**Files to modify**: `frontend/src/pages/Import.tsx`
- Add PDF LLM option to file upload
- Update stepper to include LLM processing step
- Handle PDF file types in dropzone

#### Step 9: Progress Tracking
**Files to create**: `frontend/src/components/PDFProcessingProgress.tsx`
- Real-time progress indicator
- Step-by-step processing feedback
- Error display and retry options

#### Step 10: Transaction Review Interface
**Files to create**: `frontend/src/components/TransactionReviewStep.tsx`
- Display LLM-extracted transactions
- Allow editing before final import
- Validation and error correction

### Phase 3: System Setup (Steps 11-12)

#### Step 11: Ollama Installation
**Documentation**: Setup instructions for local Ollama
- Install Ollama locally
- Download recommended models (Llama 3.1, Mistral)
- Configure model parameters

#### Step 12: OCR Dependencies
**Documentation**: Tesseract setup instructions
- Ensure Tesseract is installed system-wide
- Configure language packs if needed
- Test OCR functionality

## Detailed Implementation Steps

### Backend Implementation Details

#### PDFProcessor Service Structure
```python
class PDFProcessor:
    def extract_text(self, pdf_bytes: bytes) -> str
    def needs_ocr(self, extracted_text: str) -> bool
    def extract_via_ocr(self, pdf_bytes: bytes) -> str
    def process_pdf(self, pdf_bytes: bytes) -> str
```

#### LLM Service Structure
```python
class LLMService:
    def extract_transactions(self, text: str) -> List[TransactionData]
    def validate_extraction(self, transactions: List) -> bool
    def retry_with_different_model(self, text: str) -> List[TransactionData]
```

#### API Endpoint Flow
1. Receive PDF file upload
2. Extract text (with OCR fallback)
3. Send to LLM for transaction extraction
4. Validate and structure results
5. Return extracted transactions for user review

### Frontend Implementation Details

#### Enhanced Import Flow
1. **File Upload**: Accept PDF files
2. **Processing**: Show progress (Text extraction → LLM analysis)
3. **Review**: Display extracted transactions for editing
4. **Mapping**: Map to accounts/categories as needed
5. **Import**: Final import with user-confirmed data

#### Progress Tracking Components
- Animated progress indicators
- Step-by-step status updates
- Error handling with retry options

## Success Criteria

### Functional Requirements
- [x] Accept PDF files in import workflow
- [x] Automatically detect text vs OCR requirement
- [x] Extract structured transaction data using LLM
- [x] Allow user review and editing
- [x] Import transactions into existing system

### Technical Requirements
- [x] Handle various PDF formats (text-based, scanned, mixed)
- [x] Support multiple LLM models via Ollama
- [x] Graceful error handling and fallbacks
- [x] Maintain consistency with existing import flow

### Performance Requirements
- [x] Process typical bank statement PDF in < 30 seconds
- [x] Handle PDFs up to 10MB in size
- [x] Provide real-time progress feedback

## Risk Mitigation

### Technical Risks
- **LLM Accuracy**: Implement validation and user review
- **OCR Quality**: Use high-quality Tesseract with preprocessing
- **Performance**: Set timeouts and provide progress feedback
- **Model Availability**: Support multiple LLM models as fallbacks

### User Experience Risks
- **Complex UI**: Keep interface similar to existing import flow
- **Processing Time**: Provide clear progress indicators
- **Error Recovery**: Allow manual correction and retry

## Testing Strategy

### Unit Tests
- PDF text extraction accuracy
- OCR fallback functionality
- LLM prompt effectiveness
- API endpoint validation

### Integration Tests
- End-to-end PDF processing
- Frontend-backend communication
- Error handling scenarios

### User Acceptance Tests
- Various PDF document types
- Different transaction formats
- Error recovery workflows

## Deployment Considerations

### Local Development
- Ollama server running locally
- Tesseract installed and configured
- Test PDF documents for validation

### Production Deployment
- Containerized Ollama deployment
- Resource allocation for LLM processing
- Monitoring and logging

## Future Enhancements

### Phase 2 Features
- Support for multiple languages
- Custom LLM fine-tuning for specific bank formats
- Batch processing of multiple PDFs
- Integration with bank APIs for automated imports

### Advanced Features
- Machine learning model training on user corrections
- Template recognition for common statement formats
- Automated categorization based on historical data

## Documentation Updates Required

### User Documentation
- How to use PDF LLM import feature
- Troubleshooting common issues
- Best practices for PDF preparation

### Developer Documentation
- API endpoint documentation
- LLM integration patterns
- Extending to new document types

---

**Status**: Ready for Implementation
**Next Action**: Begin Step 1 - Dependencies & Environment Setup
**Estimated Timeline**: 2-3 days for full implementation
**Dependencies**: Ollama installation, Tesseract setup