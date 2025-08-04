#!/bin/bash

# Ollama Setup Script - For Existing Installation
# This script sets up models for an already-running Ollama instance

set -e

echo "🔍 Checking Ollama Installation Status"
echo "======================================"

# Check if Ollama is installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is installed"
    ollama --version
else
    echo "❌ Ollama is not installed"
    echo "Please run the main setup script: ./setup_ollama.sh"
    exit 1
fi

# Check if Ollama service is running
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "✅ Ollama service is running on port 11434"
else
    echo "❌ Ollama service is not responding"
    echo "Please start Ollama: ollama serve"
    exit 1
fi

# Check current models
echo ""
echo "📋 Current Models:"
ollama list

# Install required models
echo ""
echo "📦 Installing Required Models..."

models=("llama3.1" "mistral")
recommended_models=("llama3" "gemma")

# Install primary models
for model in "${models[@]}"; do
    echo "📥 Downloading $model..."
    if ollama pull $model; then
        echo "✅ $model installed successfully"
    else
        echo "⚠️  Failed to install $model"
    fi
done

# Ask about optional models
echo ""
echo "🤔 Would you like to install optional models for better performance?"
echo "   - llama3: Alternative model (faster)"
echo "   - gemma: Lightweight model (quickest)"
echo ""
read -p "Install optional models? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    for model in "${recommended_models[@]}"; do
        echo "📥 Downloading $model..."
        if ollama pull $model; then
            echo "✅ $model installed successfully"
        else
            echo "⚠️  Failed to install $model (continuing...)"
        fi
    done
fi

# Test functionality
echo ""
echo "🧪 Testing LLM Functionality..."
if echo "Test: Extract date from 'Jan 15, 2024 Purchase $25.50'" | ollama run llama3.1 >/dev/null 2>&1; then
    echo "✅ LLM functionality test passed"
else
    echo "⚠️  LLM functionality test failed (may need manual verification)"
fi

# Show final status
echo ""
echo "📋 Final Model List:"
ollama list

echo ""
echo "🎉 Model setup complete!"
echo ""
echo "✅ Ready for PDF LLM Import Feature"
echo ""
echo "Next steps:"
echo "1. Install Python dependencies: cd backend && pip install -r requirements.txt"
echo "2. Start the backend: cd backend && python -m uvicorn main:app --reload"
echo "3. Start the frontend: cd frontend && npm start"
echo ""
echo "💡 Tip: Keep this terminal open - Ollama is running here"
echo "To stop Ollama later: pkill ollama"