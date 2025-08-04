#!/bin/bash

# Ollama Setup Script for PDF LLM Import Feature
# This script installs Ollama and required models for the Expense Manager

set -e

echo "🚀 Setting up Ollama for PDF LLM Import Feature"
echo "=============================================="

# Check if running on Linux/macOS
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    echo "✅ Detected compatible OS: $OSTYPE"
else
    echo "❌ This script is for Linux/macOS only"
    echo "For Windows, please download Ollama from: https://ollama.ai/download"
    exit 1
fi

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is already installed"
    ollama --version
else
    echo "📥 Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    
    if command -v ollama &> /dev/null; then
        echo "✅ Ollama installed successfully"
        ollama --version
    else
        echo "❌ Failed to install Ollama"
        exit 1
    fi
fi

# Start Ollama service in background
echo "🔄 Starting Ollama service..."
ollama serve &
OLLAMA_PID=$!

# Wait for service to start
echo "⏳ Waiting for Ollama service to start..."
sleep 5

# Check if service is running
if ps -p $OLLAMA_PID > /dev/null; then
    echo "✅ Ollama service is running (PID: $OLLAMA_PID)"
else
    echo "❌ Failed to start Ollama service"
    exit 1
fi

# Install required models
echo "📦 Installing LLM models..."

models=("llama3.1" "mistral" "llama3" "gemma")

for model in "${models[@]}"; do
    echo "📥 Downloading $model..."
    if ollama pull $model; then
        echo "✅ $model installed successfully"
    else
        echo "⚠️  Failed to install $model (continuing...)"
    fi
done

# Verify installed models
echo "📋 Installed models:"
ollama list

# Test basic functionality
echo "🧪 Testing LLM functionality..."
if echo "Test prompt" | ollama run llama3.1 > /dev/null 2>&1; then
    echo "✅ LLM functionality test passed"
else
    echo "⚠️  LLM functionality test failed (may need manual verification)"
fi

echo ""
echo "🎉 Ollama setup complete!"
echo ""
echo "Next steps:"
echo "1. Install Python dependencies: cd backend && pip install -r requirements.txt"
echo "2. Start the backend: cd backend && python -m uvicorn main:app --reload"
echo "3. Start the frontend: cd frontend && npm start"
echo ""
echo "Note: Ollama service is running in background (PID: $OLLAMA_PID)"
echo "To stop: kill $OLLAMA_PID"
echo "To restart: ollama serve"
echo ""
echo "For more information, see PDF_LLM_SETUP.md"