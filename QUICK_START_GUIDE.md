# PDF LLM Import - Quick Start Guide

## 🚀 **Current Status**
✅ Ollama is installed and running on port 11434  
✅ PDF LLM feature is fully implemented  
⏳ Downloading LLM models (in progress)

## ⚡ **Quick Start Options**

### **Option 1: Wait for llama3.1 (Recommended)**
The setup script is currently downloading llama3.1 (~5GB). This provides the best accuracy for transaction extraction.

**Estimated time**: 3-5 minutes depending on internet speed

### **Option 2: Use a Smaller Model (Faster)**
For immediate testing, you can start with a smaller model:

```bash
# In a new terminal
ollama pull gemma:2b  # ~1.5GB, much faster download
```

Then update the default model in the frontend to use `gemma:2b`.

### **Option 3: Test Without LLM (Development)**
You can test the PDF LLM UI components without actual LLM processing by:

1. Starting the backend and frontend
2. The system will show appropriate error messages for missing models
3. Test the PDF upload and preview functionality

## 🔧 **Current Setup Progress**

### ✅ **Completed**
- Ollama installed and running
- Backend services implemented
- Frontend components created
- TypeScript errors fixed
- All documentation ready

### ⏳ **In Progress**
- Model download (llama3.1)

### 📋 **Next Steps** (once model download completes)
1. Install Python dependencies: `cd backend && pip install -r requirements.txt`
2. Start the backend: `python -m uvicorn main:app --reload`
3. Start the frontend: `cd frontend && npm start`
4. Test the PDF LLM import feature

## 🧪 **Testing the Feature**

### **1. Check System Status**
```bash
curl http://localhost:8000/api/import/pdf-llm/status
```

### **2. Upload a Test PDF**
- Use the sample data from `test_data/sample_bank_statement.txt`
- Create a simple PDF from the text
- Upload via the import page

### **3. Verify Processing**
- Check PDF preview functionality
- Test LLM extraction
- Review transaction data
- Complete import process

## 📁 **Available Models & Performance**

| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| gemma:2b | 1.5GB | Fast | Good | Quick testing |
| mistral | 4.1GB | Medium | Very Good | Balanced performance |
| llama3.1 | 4.9GB | Slower | Excellent | Production use |
| llama3 | 4.7GB | Slower | Excellent | Alternative to 3.1 |

## 🔍 **Monitoring Progress**

### **Check Model Download Status**
```bash
ollama list
```

### **Check Ollama Service**
```bash
ollama ps
```

### **Test Basic LLM Functionality**
```bash
echo "Extract date and amount: Jan 15, 2024 Purchase $25.50" | ollama run gemma:2b
```

## ❓ **Troubleshooting**

### **If Model Download is Stuck**
1. Cancel with Ctrl+C
2. Try a smaller model: `ollama pull gemma:2b`
3. Update frontend to use the smaller model

### **If Ollama Service Issues**
```bash
# Restart Ollama
pkill ollama
ollama serve
```

### **If Backend Import Errors**
1. Check that models are installed: `ollama list`
2. Verify Ollama is responding: `curl http://localhost:11434/api/tags`
3. Check backend logs for specific errors

## 🎯 **Production Recommendations**

For production deployment:
1. **Use llama3.1 or mistral** for best accuracy
2. **Allocate 8GB+ RAM** for smooth LLM processing
3. **Monitor processing times** and adjust timeout settings
4. **Consider GPU acceleration** for faster processing

---

**Current Status**: Model download in progress  
**Estimated completion**: 3-5 minutes  
**Ready for testing**: Once download completes  

Feel free to proceed with other setup steps while the model downloads!