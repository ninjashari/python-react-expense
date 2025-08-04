import io
import re
from typing import Optional, Tuple
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from fastapi import HTTPException


class PDFProcessor:
    """Handle PDF text extraction with automatic OCR fallback detection"""
    
    def __init__(self):
        self.min_text_threshold = 50  # Minimum characters to consider PDF as text-based
        self.ocr_confidence_threshold = 30  # Minimum OCR confidence percentage
    
    def extract_text_with_pymupdf(self, pdf_bytes: bytes) -> str:
        """Extract text from PDF using PyMuPDF (fitz)"""
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text = ""
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text += page.get_text() + "\n"
            
            doc.close()
            return text.strip()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error extracting text from PDF: {str(e)}")
    
    def needs_ocr(self, extracted_text: str) -> bool:
        """Determine if PDF needs OCR based on extracted text quality"""
        if len(extracted_text.strip()) < self.min_text_threshold:
            return True
        
        # Check for common OCR artifacts or poor extraction
        text_quality_indicators = [
            len(re.findall(r'\w+', extracted_text)),  # Word count
            len(re.findall(r'\d+', extracted_text)),  # Number count
            len(re.findall(r'[A-Za-z]{3,}', extracted_text)),  # Proper words
        ]
        
        # If we have very few recognizable patterns, likely needs OCR
        if sum(text_quality_indicators) < 10:
            return True
        
        return False
    
    def extract_via_ocr(self, pdf_bytes: bytes) -> str:
        """Extract text using OCR by converting PDF pages to images"""
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            full_text = ""
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                
                # Convert page to image with higher resolution
                pix = page.get_pixmap(matrix=fitz.Matrix(3.0, 3.0))  # 3x zoom for better OCR
                img_data = pix.tobytes("png")
                
                # OCR the image with better settings for tabular data
                image = Image.open(io.BytesIO(img_data))
                
                # Try multiple OCR configurations for better results
                ocr_configs = [
                    '--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz./-: ',
                    '--psm 4',  # Single column of text of variable sizes
                    '--psm 6',  # Single uniform block of text
                ]
                
                best_text = ""
                for config in ocr_configs:
                    try:
                        text = pytesseract.image_to_string(image, config=config)
                        if len(text.strip()) > len(best_text.strip()):
                            best_text = text
                    except:
                        continue
                
                page_text = best_text if best_text else pytesseract.image_to_string(image)
                full_text += page_text + "\n"
            
            doc.close()
            return full_text.strip()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error during OCR processing: {str(e)}")
    
    def process_pdf(self, pdf_bytes: bytes) -> Tuple[str, str]:
        """
        Main processing method that returns extracted text and processing method used
        Returns: (extracted_text, method_used)
        """
        # First, try direct text extraction
        direct_text = self.extract_text_with_pymupdf(pdf_bytes)
        
        if not self.needs_ocr(direct_text):
            return direct_text, "direct_text"
        
        # If direct extraction is insufficient, use OCR
        ocr_text = self.extract_via_ocr(pdf_bytes)
        
        # Choose the better result
        if len(ocr_text.strip()) > len(direct_text.strip()):
            return ocr_text, "ocr"
        else:
            return direct_text, "direct_text"
    
    def validate_extracted_text(self, text: str) -> bool:
        """Validate that extracted text contains potentially useful financial data"""
        if len(text.strip()) < 20:
            return False
        
        # Look for financial indicators
        financial_patterns = [
            r'\$\d+\.?\d*',  # Dollar amounts
            r'\d+\.\d{2}',   # Decimal amounts
            r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',  # Dates
            r'\bdebit\b|\bcredit\b|\bpayment\b|\bdeposit\b',  # Financial terms
            r'\baccount\b|\bbalance\b|\btransaction\b',  # Account terms
        ]
        
        found_patterns = sum(1 for pattern in financial_patterns 
                           if re.search(pattern, text, re.IGNORECASE))
        
        return found_patterns >= 2  # At least 2 financial indicators