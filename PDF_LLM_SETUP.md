# PDF LLM Import Setup Guide

This guide will help you set up the PDF LLM import feature for the Expense Manager application.

## Prerequisites

### 1. Install Dependencies

First, install the new Python dependencies:

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

The key new dependencies added are:
- `pymupdf==1.23.8` - Better PDF text extraction
- `ollama==0.2.1` - LLM integration

### 2. Install Ollama

#### On Linux/macOS:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### On Windows:
Download and install from: https://ollama.ai/download

#### Verify Installation:
```bash
ollama --version
```

### 3. Install LLM Models

Download recommended models for transaction extraction:

```bash
# Primary model (recommended)
ollama pull llama3.1

# Backup models
ollama pull mistral
ollama pull llama3
ollama pull gemma
```

### 4. Install Tesseract OCR (if not already installed)

#### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

#### CentOS/RHEL:
```bash
sudo yum install tesseract
```

#### macOS:
```bash
brew install tesseract
```

#### Windows:
Download and install from: https://github.com/UB-Mannheim/tesseract/wiki

## Starting Services

### 1. Start Ollama Service

```bash
# Start Ollama in background
ollama serve
```

Or run in a separate terminal:
```bash
# This will keep running - use a separate terminal window
ollama serve
```

### 2. Start Backend Application

```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

### 3. Start Frontend Application

```bash
cd frontend
npm start
```

## Using the PDF LLM Import Feature

### 1. Access the Import Page
- Navigate to the Import page in the application
- You should now see support for PDF files in the file upload zone

### 2. Upload a PDF
- Drag and drop a PDF file or click to browse
- Supported PDF types:
  - Text-based PDFs (bank statements, receipts)
  - Scanned/image-based PDFs (will use OCR)
  - Mixed content PDFs

### 3. Configure Import Settings
- Select the target account for transactions
- Choose the LLM model (llama3.1 recommended)
- Review the PDF analysis results

### 4. Review Extracted Transactions
- The LLM will extract transactions from the PDF
- Review the extracted data for accuracy
- Edit any incorrect information if needed

### 5. Import Transactions
- Confirm the import to add transactions to your account
- The system will automatically create payees and categories as needed

## API Endpoints

### Check System Status
```bash
GET /api/import/pdf-llm/status
```

### Preview PDF Extraction
```bash
POST /api/import/pdf-llm/preview
Content-Type: multipart/form-data
```

### Import PDF with LLM
```bash
POST /api/import/pdf-llm
Content-Type: multipart/form-data
```

## Troubleshooting

### Common Issues

#### 1. "Ollama service is not available"
- Ensure Ollama is running: `ollama serve`
- Check if the service is listening on the default port
- Verify models are installed: `ollama list`

#### 2. "No LLM models available"
- Install at least one model: `ollama pull llama3.1`
- Restart the backend application after installing models

#### 3. OCR not working
- Verify Tesseract installation: `tesseract --version`
- Install language packs if needed: `sudo apt-get install tesseract-ocr-eng`

#### 4. Poor extraction quality
- Try a different LLM model (mistral, llama3)
- Ensure PDF contains readable text/financial data
- For scanned documents, try improving image quality

### Performance Tips

#### 1. Model Selection
- **llama3.1**: Best accuracy, slower processing
- **mistral**: Good balance of speed and accuracy
- **gemma**: Faster processing, adequate accuracy

#### 2. PDF Quality
- Use high-resolution PDFs for better OCR results
- Text-based PDFs process much faster than scanned PDFs
- Clean, well-formatted documents give better results

#### 3. System Resources
- LLM processing is CPU/GPU intensive
- Ensure adequate RAM (8GB+ recommended)
- Processing time varies: 5-30 seconds per PDF

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Optional: Custom Ollama settings
OLLAMA_HOST=http://localhost:11434
OLLAMA_TIMEOUT=60

# Optional: Tesseract settings
TESSERACT_CMD=/usr/bin/tesseract
```

### Model Configuration

You can customize the default LLM model in the backend:

```python
# In services/pdf_llm_processor.py
def __init__(self, llm_model: str = "your-preferred-model"):
```

## Security Considerations

### 1. Local Processing
- All LLM processing happens locally via Ollama
- No data is sent to external services
- PDFs are processed entirely on your system

### 2. Data Privacy
- Extracted text is temporarily stored in memory only
- No persistent storage of PDF content
- Transaction data follows existing security patterns

### 3. File Validation
- Only PDF files are accepted
- File size limits apply (configurable)
- Malicious file detection (basic)

## Advanced Usage

### Custom Models

You can use custom or fine-tuned models:

```bash
# Import a custom model
ollama create custom-finance-model -f ./Modelfile

# Use in the application
# Select "custom-finance-model" from the model dropdown
```

### Batch Processing

For multiple PDFs, process them one at a time through the UI, or use the API directly:

```python
import requests

for pdf_file in pdf_files:
    with open(pdf_file, 'rb') as f:
        files = {'file': f}
        data = {'account_id': account_id}
        response = requests.post('/api/import/pdf-llm', files=files, data=data)
```

## Support

### Getting Help

1. Check the application logs for detailed error messages
2. Verify all prerequisites are properly installed
3. Test with a simple, text-based PDF first
4. Refer to the main project documentation

### Reporting Issues

When reporting issues, include:
- PDF type and source (bank, credit card, etc.)
- Error messages from backend logs
- System information (OS, Python version, etc.)
- Ollama and model versions

## Updates and Maintenance

### Updating Models
```bash
# Update to latest model versions
ollama pull llama3.1
ollama pull mistral
```

### Monitoring Performance
- Monitor CPU/RAM usage during PDF processing
- Track processing times for optimization
- Review extraction accuracy and adjust models as needed

---

**Status**: Ready for use
**Last Updated**: 2025-08-02
**Version**: 1.0