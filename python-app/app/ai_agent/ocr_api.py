from flask import Blueprint, request, jsonify
import os
import logging
from .document_processor import DocumentProcessor

ocr_bp = Blueprint('ocr', __name__, url_prefix='/ocr')

@ocr_bp.route('/process', methods=['POST'])
def process_document():
    """
    Process a document file using OCR
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    # Get the upload folder from the app config
    from flask import current_app
    upload_folder = current_app.config.get('UPLOAD_FOLDER', os.path.join(os.path.dirname(__file__), 'uploads'))
    
    # Initialize document processor
    doc_processor = DocumentProcessor(upload_folder=upload_folder)
    
    # Save and process the file
    file_path = doc_processor.save_uploaded_file(file)
    if not file_path:
        return jsonify({"error": "Failed to save file"}), 500
        
    # Process the document
    result = doc_processor.process_file(file_path)
    
    # Clean up the file after processing if needed
    # os.remove(file_path)
    
    return jsonify(result)

@ocr_bp.route('/batch', methods=['POST'])
def batch_process_documents():
    """
    Process multiple document files using OCR
    """
    if 'files' not in request.files:
        return jsonify({"error": "No files part"}), 400
        
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({"error": "No selected files"}), 400
        
    # Get the upload folder from the app config
    from flask import current_app
    upload_folder = current_app.config.get('UPLOAD_FOLDER', os.path.join(os.path.dirname(__file__), 'uploads'))
    
    # Initialize document processor
    doc_processor = DocumentProcessor(upload_folder=upload_folder)
    
    file_paths = []
    for file in files:
        file_path = doc_processor.save_uploaded_file(file)
        if file_path:
            file_paths.append(file_path)
            
    # Process all documents
    results = doc_processor.batch_process_files(file_paths)
    
    # Clean up files after processing if needed
    # for file_path in file_paths:
    #     os.remove(file_path)
    
    return jsonify(results)
