# PDF LLM Import Feature - Testing Checklist

## Pre-Testing Setup

### ✅ System Requirements
- [ ] Python 3.8+ installed
- [ ] Node.js 16+ and npm installed
- [ ] PostgreSQL database running
- [ ] Ollama installed and running (`ollama serve`)
- [ ] At least one LLM model downloaded (`ollama pull llama3.1`)
- [ ] Tesseract OCR installed system-wide

### ✅ Dependencies Installation
```bash
# Backend dependencies
cd backend
pip install -r requirements.txt

# Frontend dependencies  
cd frontend
npm install
```

### ✅ Environment Configuration
- [ ] Backend `.env` file configured with database and optional Ollama settings
- [ ] Frontend `.env` file with `REACT_APP_API_BASE_URL`
- [ ] Database migrations applied (`alembic upgrade head`)

## Core Functionality Testing

### 1. ✅ System Status Validation
**Endpoint**: `GET /api/import/pdf-llm/status`

**Test Cases**:
- [ ] Returns system status when Ollama is running
- [ ] Shows available LLM models
- [ ] Handles Ollama service down gracefully
- [ ] Authentication required

**Expected Response**:
```json
{
  "pdf_processor": "available",
  "ollama_service": "connected",
  "available_models": ["llama3.1", "mistral"],
  "recommended_models": ["llama3.1", "mistral", "llama3", "gemma"]
}
```

### 2. ✅ PDF Preview Functionality
**Endpoint**: `POST /api/import/pdf-llm/preview`

**Test Cases**:
- [ ] **Text-based PDF**: Clear bank statement with readable text
- [ ] **Scanned PDF**: Image-based document requiring OCR
- [ ] **Mixed content PDF**: Combination of text and images
- [ ] **Invalid file**: Non-PDF file rejection
- [ ] **Empty PDF**: Document with no content
- [ ] **Large PDF**: 5MB+ file handling

**Expected Response**:
```json
{
  "extraction_method": "direct_text",
  "text_length": 1250,
  "has_financial_data": true,
  "estimated_processing_time": 15,
  "preview_text": "BANK STATEMENT...",
  "error": null
}
```

### 3. ✅ LLM Processing & Import
**Endpoint**: `POST /api/import/pdf-llm`

**Test Cases**:
- [ ] **Preview Mode**: `preview_only=true`
- [ ] **Full Import**: Complete transaction import
- [ ] **Model Selection**: Different LLM models (llama3.1, mistral, gemma)
- [ ] **Account Assignment**: Valid account_id provided
- [ ] **Invalid Account**: Non-existent account_id
- [ ] **Processing Timeout**: Large/complex documents

**Expected Response**:
```json
{
  "status": "success",
  "extraction_method": "direct_text",
  "transactions": [...],
  "transaction_count": 15,
  "processing_notes": ["..."],
  "message": "Successfully imported 15 transactions"
}
```

## Frontend UI Testing

### 4. ✅ Upload & File Handling
- [ ] **Drag & Drop**: PDF files accepted in dropzone
- [ ] **File Browser**: Click to select PDF files
- [ ] **File Type Validation**: Only PDF files accepted
- [ ] **Large File Handling**: Progress indicators for large uploads
- [ ] **Error Display**: Clear error messages for invalid files

### 5. ✅ PDF LLM Configuration Step
- [ ] **Account Selection**: Dropdown populated with user's accounts
- [ ] **Model Selection**: LLM model dropdown with available options
- [ ] **Preview Display**: PDF analysis results shown correctly
- [ ] **Extraction Method**: Text vs OCR indication
- [ ] **Financial Data Detection**: Warning for non-financial PDFs
- [ ] **Navigation**: Next button enabled/disabled appropriately

### 6. ✅ Processing Progress
- [ ] **Step Indicators**: Multi-step progress visualization
- [ ] **Time Estimation**: Realistic processing time estimates
- [ ] **Real-time Updates**: Progress updates during processing
- [ ] **Processing Notes**: Detailed step-by-step feedback
- [ ] **Error Handling**: Failed steps shown clearly
- [ ] **Cancel Functionality**: Ability to cancel processing

### 7. ✅ Transaction Review Interface
- [ ] **Transaction Table**: All extracted transactions displayed
- [ ] **Edit Functionality**: Individual transaction editing
- [ ] **Add/Delete**: Manual transaction management
- [ ] **Confidence Indicators**: LLM confidence levels shown
- [ ] **Summary Statistics**: Total amounts and counts
- [ ] **Data Validation**: Required fields highlighted
- [ ] **Final Import**: Confirm and import button

## Data Quality Testing

### 8. ✅ Transaction Extraction Accuracy
**Test with sample statements**:

- [ ] **Dates**: Correctly parsed to YYYY-MM-DD format
- [ ] **Amounts**: Positive numbers, proper decimal handling
- [ ] **Descriptions**: Clean, readable transaction descriptions
- [ ] **Transaction Types**: Accurate income/expense/transfer classification
- [ ] **Payees**: Merchant names extracted correctly
- [ ] **Categories**: Reasonable category inference

### 9. ✅ Edge Cases & Error Handling
- [ ] **Empty Transactions**: PDFs with no recognizable transactions
- [ ] **Malformed Data**: Incomplete or corrupted transaction data
- [ ] **Special Characters**: Unicode, accented characters
- [ ] **Large Numbers**: High-value transactions
- [ ] **Negative Amounts**: Proper handling of credits/debits
- [ ] **Date Formats**: Various date format recognition

## Integration Testing

### 10. ✅ Database Integration
- [ ] **Transaction Creation**: Records saved to transactions table
- [ ] **Account Balance Updates**: Account balances updated correctly
- [ ] **Payee Creation**: New payees created automatically
- [ ] **Category Creation**: New categories with colors and slugs
- [ ] **User Association**: All records linked to correct user
- [ ] **Transaction Constraints**: Database constraints respected

### 11. ✅ Authentication & Security
- [ ] **JWT Required**: All endpoints require valid authentication
- [ ] **User Isolation**: Users can only access their own data
- [ ] **File Validation**: Malicious file detection
- [ ] **Data Privacy**: No external API calls, local processing only
- [ ] **Input Sanitization**: SQL injection prevention

## Performance Testing

### 12. ✅ Performance Benchmarks
- [ ] **Small PDFs** (< 1MB): Processing < 15 seconds
- [ ] **Medium PDFs** (1-5MB): Processing < 30 seconds
- [ ] **Large PDFs** (5-10MB): Processing < 60 seconds
- [ ] **Memory Usage**: Reasonable RAM consumption during processing
- [ ] **CPU Usage**: Efficient LLM utilization
- [ ] **Concurrent Users**: Multiple simultaneous imports

### 13. ✅ Error Recovery & Resilience
- [ ] **Ollama Downtime**: Graceful failure when LLM unavailable
- [ ] **Model Missing**: Clear error when model not installed
- [ ] **Database Errors**: Transaction rollback on failures
- [ ] **Network Issues**: Timeout handling
- [ ] **Memory Limits**: Large file processing limits

## Browser Compatibility

### 14. ✅ Cross-Browser Testing
- [ ] **Chrome**: Latest version compatibility
- [ ] **Firefox**: Core functionality works
- [ ] **Safari**: macOS/iOS compatibility
- [ ] **Edge**: Windows compatibility
- [ ] **Mobile**: Responsive design on tablets/phones

## Documentation Validation

### 15. ✅ Setup Documentation
- [ ] **Installation Guide**: `PDF_LLM_SETUP.md` accuracy
- [ ] **Setup Script**: `setup_ollama.sh` functionality
- [ ] **CLAUDE.md**: Updated with PDF LLM information
- [ ] **API Documentation**: Endpoint documentation complete
- [ ] **Troubleshooting**: Common issues and solutions

## Production Readiness

### 16. ✅ Deployment Checklist
- [ ] **Environment Variables**: All required variables documented
- [ ] **Dependency Versions**: Pinned versions in requirements.txt
- [ ] **Error Logging**: Comprehensive error tracking
- [ ] **Monitoring**: Health check endpoints available
- [ ] **Backup Strategy**: Data backup considerations
- [ ] **Security Review**: Security best practices followed

## Test Data & Scenarios

### 17. ✅ Test Document Library
Create test PDFs for each scenario:

- [ ] **Credit Card Statement**: Chase/AmEx style statements
- [ ] **Bank Checking**: BOA/Wells Fargo style statements
- [ ] **Investment Account**: Vanguard/Fidelity statements
- [ ] **Business Expenses**: Corporate expense reports
- [ ] **Scanned Documents**: OCR-required versions
- [ ] **Mixed Quality**: Combination documents

### 18. ✅ Regression Testing
- [ ] **Existing Import**: CSV/Excel import still functional
- [ ] **Account Management**: No impact on account operations
- [ ] **Transaction Features**: All transaction features work
- [ ] **Reports**: PDF imports appear in reports correctly
- [ ] **Dashboard**: Balance calculations include PDF transactions

## Success Criteria

### ✅ Minimum Viable Product (MVP)
- [ ] PDF files upload successfully
- [ ] Text extraction works for clean PDFs
- [ ] LLM extracts basic transaction data (date, amount, description)
- [ ] Transactions import to database correctly
- [ ] User can review extracted data before import

### ✅ Production Ready
- [ ] OCR works for scanned documents
- [ ] High accuracy transaction extraction (>80%)
- [ ] Robust error handling and recovery
- [ ] Comprehensive user feedback and progress indication
- [ ] Performance meets benchmarks
- [ ] Security requirements satisfied

### ✅ Enhanced Experience
- [ ] Real-time processing updates
- [ ] Transaction editing and validation
- [ ] Multiple LLM model support
- [ ] Batch processing capabilities
- [ ] Advanced analytics and insights

## Testing Tools & Resources

### Automated Testing
```bash
# Backend API tests
cd backend
pytest tests/test_pdf_llm.py

# Frontend component tests
cd frontend
npm test src/components/PDFLLMStep.test.tsx
```

### Manual Testing Tools
- **Postman**: API endpoint testing
- **Browser DevTools**: Network and performance monitoring
- **Ollama CLI**: Model management and testing
- **PDF Validators**: Document format verification

### Performance Monitoring
- **Process Monitor**: CPU/RAM usage tracking
- **Network Monitor**: API response times
- **Database Query Analysis**: SQL performance
- **LLM Response Times**: Model performance metrics

---

**Testing Completion Status**: Ready for systematic validation
**Last Updated**: 2025-08-02
**Version**: 1.0

### Next Steps After Testing
1. Address any failing test cases
2. Optimize performance bottlenecks
3. Enhance error messages and user guidance
4. Consider additional features based on user feedback
5. Plan production deployment strategy