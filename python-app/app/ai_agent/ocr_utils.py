import os
import pytesseract
import pdf2image
import io
from PIL import Image
import tempfile
from pypdf import PdfReader
import docx2txt
import re
import logging

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
    
    # Enhance contrast - this helps with scanned documents
    from PIL import ImageEnhance
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)  # Increase contrast
    
    # Sharpen the image to make text more defined
    from PIL import ImageFilter
    image = image.filter(ImageFilter.SHARPEN)
    
    # Resize image if too small
    if image.width < 1000 or image.height < 1000:
        ratio = max(1000/image.width, 1000/image.height)
        new_size = (int(image.width * ratio), int(image.height * ratio))
        image = image.resize(new_size, Image.LANCZOS)
        
    return image

def extract_text_from_image(image_path):
    """
    Extract text from an image file using OCR
    """
    try:
        logging.info(f"[OCR] Processing image file: {image_path}")
        image = Image.open(image_path)
        
        # Get image details for logging
        logging.info(f"[OCR] Image size: {image.size}, mode: {image.mode}, format: {image.format}")
        
        # Preprocess the image for better OCR results
        processed_image = preprocess_image(image)
        
        # Try multiple OCR configurations for better results
        configs = [
            custom_config,
            '--psm 4 --oem 3',  # Assume a single column of text
            '--psm 3 --oem 3',  # Fully automatic page segmentation
            '--psm 12 --oem 3'  # Sparse text with OSD
        ]
        
        best_text = ""
        
        # Try the default config first
        try:
            default_text = pytesseract.image_to_string(processed_image, lang=OCR_CONFIG['lang'])
            if default_text:
                best_text = default_text
                logging.info(f"[OCR] Default configuration extracted {len(default_text)} chars")
        except Exception as e:
            logging.warning(f"[OCR] Default extraction failed: {e}")
        
        # Try alternative configurations if default didn't produce good results
        if len(best_text.strip()) < 50:
            for config in configs:
                try:
                    text = pytesseract.image_to_string(processed_image, lang=OCR_CONFIG['lang'], config=config)
                    logging.info(f"[OCR] Config {config[:10]}... extracted {len(text)} chars")
                    
                    # Choose the configuration that extracts the most text
                    if len(text) > len(best_text):
                        best_text = text
                except Exception as inner_e:
                    logging.error(f"[OCR] Error with config {config}: {inner_e}")
                    continue
        
        if not best_text:
            logging.warning(f"[OCR] No text extracted from image {image_path}")
            
        # Clean the extracted text
        best_text = clean_extracted_text(best_text)
        
        # Log the result
        if len(best_text) > 0:
            logging.info(f"[OCR] Successfully processed file: {image_path}, text length: {len(best_text)}")
            logging.info(f"[OCR] Sample of extracted text: {best_text[:100]}...")
        else:
            logging.warning(f"[OCR] No usable text extracted from image: {image_path}")
            
        return best_text
    except Exception as e:
        logging.error(f"[OCR] Error extracting text from image: {e}", exc_info=True)
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
    try:
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        logging.info(f"[OCR] Processing file {file_path} with extension {ext}")
        
        # Extract text based on file type
        if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif']:
            text = extract_text_from_image(file_path)
            logging.info(f"[OCR] Extracted {len(text)} characters from image")
        elif ext == '.pdf':
            text = extract_text_from_pdf(file_path)
            logging.info(f"[OCR] Extracted {len(text)} characters from PDF")
        elif ext in ['.docx', '.doc']:
            text = extract_text_from_docx(file_path)
            logging.info(f"[OCR] Extracted {len(text)} characters from DOCX")
        elif ext in ['.txt', '.text']:
            # Handle plain text files directly
            with open(file_path, 'r', errors='ignore') as f:
                text = f.read()
            logging.info(f"[OCR] Read {len(text)} characters from text file")
        else:
            logging.warning(f"[OCR] Unsupported file type: {ext}")
            return f"Unsupported file format: {ext}"
            
        # If very little text was extracted, try alternative methods
        if len(text.strip()) < 50:
            logging.warning(f"[OCR] Very little text extracted from {file_path}, trying alternative methods")
            
            # For all file types, try converting to image and processing
            if ext == '.pdf':
                try:
                    # Convert first page to image and retry
                    images = pdf_image_conversion(file_path)
                    if images:
                        backup_text = extract_text_from_image(images[0])
                        if len(backup_text) > len(text):
                            text = backup_text
                            logging.info(f"[OCR] Used image conversion for PDF, got {len(text)} chars")
                except Exception as backup_err:
                    logging.error(f"[OCR] Backup extraction failed: {backup_err}")
            elif ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif']:
                # For images, try with different preprocessing
                try:
                    # Load the image directly without preprocessing
                    image = Image.open(file_path)
                    direct_text = pytesseract.image_to_string(image, lang=OCR_CONFIG['lang'])
                    if len(direct_text) > len(text):
                        text = direct_text
                        logging.info(f"[OCR] Used direct image OCR, got {len(text)} chars")
                except Exception as img_err:
                    logging.error(f"[OCR] Alternative image OCR failed: {img_err}")
        
        # Log a sample of the extracted text for debugging
        if text:
            logging.info(f"[OCR] Sample of extracted text: {text[:100]}...")
        else:
            logging.warning(f"[OCR] No text was extracted from {file_path}")
            
        return text
    except Exception as e:
        logging.error(f"[OCR] Error processing document: {e}", exc_info=True)
        return f"Error processing document: {str(e)}"

def clean_extracted_text(text):
    """
    Clean and normalize extracted text
    """
    if not text:
        return ""
        
    # Convert to string if not already
    if not isinstance(text, str):
        text = str(text)
        
    # Remove excessive whitespace but preserve line breaks for structure
    text = re.sub(r' {2,}', ' ', text)  # Multiple spaces to single space
    text = re.sub(r'\n{3,}', '\n\n', text)  # Multiple newlines to double newline
    
    # Remove unusual characters but keep more symbols that might be important
    text = re.sub(r'[^\x00-\x7F]+', ' ', text)
    
    # Log cleaning results
    logging.info(f"[OCR] Text cleaning: before {len(text) if text else 0} chars, after {len(text.strip()) if text else 0} chars")
    
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
