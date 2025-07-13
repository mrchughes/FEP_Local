import os
import json
import tempfile
from werkzeug.utils import secure_filename
import logging
from .ocr_utils import process_document, clean_extracted_text, extract_document_metadata

class DocumentProcessor:
    def __init__(self, upload_folder=None):
        self.upload_folder = upload_folder or os.path.join(tempfile.gettempdir(), 'uploads')
        os.makedirs(self.upload_folder, exist_ok=True)
        
    def save_uploaded_file(self, file):
        """
        Save an uploaded file to disk and return the file path
        """
        if not file:
            return None
        filename = secure_filename(file.filename)
        file_path = os.path.join(self.upload_folder, filename)
        file.save(file_path)
        return file_path
        
    def process_file(self, file_path):
        """
        Process a document file and extract its content
        """
        if not os.path.exists(file_path):
            logging.error(f"[DOCPROC] File not found: {file_path}")
            return {"error": "File not found"}
            
        try:
            # Extract text from document
            logging.info(f"[DOCPROC] Processing file: {file_path}")
            raw_text = process_document(file_path)
            
            # Clean and normalize text
            cleaned_text = clean_extracted_text(raw_text)
            
            # Extract metadata
            metadata = extract_document_metadata(file_path)
            
            logging.info(f"[DOCPROC] Successfully processed file: {file_path}")
            return {
                "success": True,
                "metadata": metadata,
                "text": cleaned_text,
                "text_length": len(cleaned_text)
            }
        except Exception as e:
            logging.error(f"[DOCPROC] Error processing file {file_path}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
            
    def batch_process_files(self, file_paths):
        """
        Process multiple document files
        """
        results = {}
        for file_path in file_paths:
            if os.path.exists(file_path):
                results[os.path.basename(file_path)] = self.process_file(file_path)
            else:
                logging.error(f"[DOCPROC] File not found: {file_path}")
                results[os.path.basename(file_path)] = {"error": "File not found"}
        return results
