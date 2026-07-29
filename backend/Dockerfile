FROM python:3.11-slim

# tesseract-ocr: required by pytesseract for OCR
# libgl1: required by some Pillow/pymupdf image codepaths
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Install CPU-only torch first (default PyPI wheel pulls CUDA libs and is much larger,
# unnecessary on a server with no GPU). Then install the rest; pip will see torch is
# already satisfied and skip reinstalling it.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
