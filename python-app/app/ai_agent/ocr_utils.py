import os
import pytesseract
import pdf2image
import io
from PIL import Image
import tempfile
from pypdf import PdfReader
import docx2txt
import re

# OCR Configuration
OCR_CONFIG = {
    'lang': 'eng', # Language setting - can be expanded for multiple languages
    'config': '--psm 6 --oem 3', # Page segmentation mode and OCR Engine mode
    'dpi': 300 # DPI for PDF conversion
}

# Tesseract tuning parameters
custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.;:?!@#$%^&*()-_+=<>[]{}|/\\ " -c tessedit_pageseg_mode=6'

def preprocess_image(image):
    """
    Preprocess the image to improve OCR accuracy
    """
    # Convert to grayscale
    if image.mode != 'L':
        image = image.convert('L')
    # Enhance contrast using adaptive thresholding or other methods
    # This is a simple threshold, but more advanced methods can be used
    # image = image.point(lambda x: 0 if x < 128 else 255, '1')
    return image

def extract_text_from_image(image_path):
    """
    Extract text from an image file using OCR
    """
    try:
        image = Image.open(image_path)
        image = preprocess_image(image)
        # Apply OCR with custom configuration
        text = pytesseract.image_to_string(image, lang=OCR_CONFIG['lang'], config=custom_config)
        return text
    except Exception as e:
        print(f"Error extracting text from image: {e}")
        return ""

def extract_text_from_pdf(pdf_path):
    """
    Extract text from a PDF file using OCR if needed
    """
    try:
        extracted_text = ""
        # First try to extract text directly (if PDF has text layer)
        pdf_reader = PdfReader(pdf_path)
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text and len(page_text.strip()) > 50: # If substantial text is found
                extracted_text += page_text + "\n\n"
        # If sufficient text was extracted directly, return it
        if len(extracted_text.strip()) > 100: # Threshold can be adjusted
            return extracted_text
        # Otherwise, use OCR on the PDF
        images = pdf_image_conversion(pdf_path)
        for image in images:
            # Preprocess the image
            processed_image = preprocess_image(image)
            # Apply OCR with custom configuration
            page_text = pytesseract.image_to_string(processed_image, lang=OCR_CONFIG['lang'], config=custom_config)
            extracted_text += page_text + "\n\n"
        return extracted_text
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return ""

def pdf_image_conversion(pdf_path):
    """
    Convert PDF to images for OCR processing
    """
    try:
        return pdf2image.convert_from_path(
            pdf_path, 
            dpi=OCR_CONFIG['dpi'],
            output_folder=tempfile.gettempdir(),
            fmt='png'
        )
    except Exception as e:
        print(f"Error converting PDF to images: {e}")
        return []

def extract_text_from_docx(docx_path):
    """
    Extract text from a DOCX file
    """
    try:
        text = docx2txt.process(docx_path)
        return text
    except Exception as e:
        print(f"Error extracting text from DOCX: {e}")
        return ""

def process_document(file_path):
    """
    Process a document file based on its extension
    """
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()
    if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif']:
        return extract_text_from_image(file_path)
    elif ext == '.pdf':
        return extract_text_from_pdf(file_path)
    elif ext in ['.docx', '.doc']:
        return extract_text_from_docx(file_path)
    else:
        return f"Unsupported file format: {ext}"

def clean_extracted_text(text):
    """
    Clean and normalize extracted text
    """
    if not text:
        return ""
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove unusual characters and normalize
    text = re.sub(r'[^\x00-\x7F]+', ' ', text)
    # Other cleaning steps as needed
    return text.strip()

def extract_document_metadata(file_path):
    """
    Extract metadata from document if available
    """
    metadata = {
        "filename": os.path.basename(file_path),
        "file_size": os.path.getsize(file_path),
        "file_type": os.path.splitext(file_path)[1].lower(),
    }
    # Add more metadata extraction based on file type
    return metadata
