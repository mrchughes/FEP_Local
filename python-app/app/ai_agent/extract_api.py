#!/usr/bin/env python3

"""
This file implements the extract-form-data endpoint for the AI agent, providing
OCR and data extraction functionality for uploaded evidence documents.
"""

import os
import logging
import sys
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import document_processor
import ai_document_processor

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), "extract_api.log"))
    ]
)

# Initialize Flask app
app = Flask(__name__)
CORS(app, 
     origins=["*"],
     supports_credentials=True,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"])

# Initialize document processors
doc_processor = document_processor.DocumentProcessor()
ai_doc_processor = ai_document_processor.AIDocumentProcessor()

# Define the shared evidence directory path
SHARED_EVIDENCE_DIR = os.path.join(os.path.dirname(__file__), '../../../shared-evidence')

@app.route('/ai-agent/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@app.route('/ai-agent/extract-form-data', methods=['POST'])
def extract_form_data():
    """
    Extract form data from evidence documents.
    
    Request body:
    {
        "files": ["filename1.jpg", "filename2.pdf"]
    }
    
    Response:
    {
        "firstName": "John",
        "lastName": "Smith",
        "dateOfBirth": "1980-01-15",
        ...
    }
    """
    try:
        request_data = request.json
        logging.info(f"[EXTRACT] Received extract-form-data request: {request_data}")
        
        if not request_data or not request_data.get('files'):
            logging.error("[EXTRACT] No files provided in request")
            return jsonify({"error": "No files provided"}), 400
            
        files = request_data.get('files')
        if not isinstance(files, list):
            files = [files]
            
        logging.info(f"[EXTRACT] Processing {len(files)} files")
        
        # Initialize results dict
        extracted_data = {}
        
        # Process each file
        for filename in files:
            try:
                file_path = os.path.join(SHARED_EVIDENCE_DIR, filename)
                if not os.path.exists(file_path):
                    logging.warning(f"[EXTRACT] File not found: {file_path}")
                    continue
                    
                logging.info(f"[EXTRACT] Processing file: {file_path}")
                
                # Process the document to extract text
                doc_result = doc_processor.process_file(file_path)
                if not doc_result.get("success", False):
                    logging.error(f"[EXTRACT] Document processing failed: {doc_result.get('error', 'Unknown error')}")
                    continue
                
                # Extract structured information from the document text
                extracted_info = process_document_text(doc_result["text"], filename)
                
                # Merge the extracted information into the overall results
                extracted_data.update(extracted_info)
                
                logging.info(f"[EXTRACT] Successfully processed file: {filename}")
            except Exception as e:
                logging.error(f"[EXTRACT] Error processing file {filename}: {str(e)}", exc_info=True)
        
        logging.info(f"[EXTRACT] Extraction completed. Fields found: {list(extracted_data.keys())}")
        return jsonify(extracted_data)
    
    except Exception as e:
        logging.error(f"[EXTRACT] Error processing request: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

def process_document_text(text, filename):
    """
    Process document text to extract structured information.
    Uses the AI document processor to extract specific fields.
    """
    logging.info(f"[EXTRACT] Analyzing text from {filename}, length: {len(text)}")
    
    # Determine document type based on filename or content
    doc_type = determine_document_type(text, filename)
    logging.info(f"[EXTRACT] Determined document type: {doc_type}")
    
    # Define fields to extract based on document type
    fields_to_extract = get_fields_for_document_type(doc_type)
    
    # Use AI to extract structured information
    result = ai_doc_processor.analyze_text_directly(text, doc_type, fields_to_extract)
    
    if not result.get("success", False):
        logging.error(f"[EXTRACT] AI extraction failed: {result.get('error', 'Unknown error')}")
        return {}
    
    # Parse the extracted_info field (which might be a JSON string)
    extracted_info = result.get("extracted_info", "{}")
    if isinstance(extracted_info, str):
        try:
            extracted_info = json.loads(extracted_info)
        except json.JSONDecodeError:
            logging.error(f"[EXTRACT] Failed to parse extracted info as JSON: {extracted_info}")
            return {}
    
    # Map the extracted fields to standard form field names
    mapped_data = map_fields_to_form(extracted_info, doc_type)
    
    return mapped_data

def determine_document_type(text, filename):
    """
    Determine the document type based on the filename and content.
    """
    # Check filename for hints
    filename_lower = filename.lower()
    if "death" in filename_lower and "certificate" in filename_lower:
        return "death_certificate"
    elif "funeral" in filename_lower and ("bill" in filename_lower or "invoice" in filename_lower):
        return "funeral_invoice"
    elif "benefit" in filename_lower or "dwp" in filename_lower:
        return "benefit_letter"
    elif "relationship" in filename_lower:
        return "relationship_proof"
    
    # Check content for hints
    text_lower = text.lower()
    if "death" in text_lower and "certificate" in text_lower:
        return "death_certificate"
    elif "funeral" in text_lower and ("director" in text_lower or "service" in text_lower):
        return "funeral_invoice"
    elif "benefit" in text_lower or "payment" in text_lower or "dwp" in text_lower:
        return "benefit_letter"
    
    # Default
    return "generic"

def get_fields_for_document_type(doc_type):
    """
    Get the list of fields to extract based on document type.
    """
    field_map = {
        "death_certificate": [
            "deceasedFirstName", "deceasedLastName", "dateOfDeath", 
            "placeOfDeath", "causeOfDeath", "dateOfBirth", 
            "registrationNumber", "informantName", "informantRelationship"
        ],
        "funeral_invoice": [
            "invoiceNumber", "invoiceDate", "totalAmount",
            "serviceProvider", "recipientName", "services",
            "paymentDetails", "funeralDate"
        ],
        "benefit_letter": [
            "recipientName", "benefitType", "paymentAmount",
            "paymentFrequency", "letterDate", "referenceNumber"
        ],
        "relationship_proof": [
            "personName", "relatedPersonName", "relationshipType",
            "documentType", "issueDate", "issuingAuthority"
        ],
        "generic": [
            "names", "dates", "addresses", "amounts",
            "documentType", "referenceNumbers"
        ]
    }
    
    return field_map.get(doc_type, field_map["generic"])

def map_fields_to_form(extracted_info, doc_type):
    """
    Map the extracted fields to standard form field names.
    """
    form_data = {}
    
    # Map fields based on document type
    if doc_type == "death_certificate":
        if "deceasedFirstName" in extracted_info:
            form_data["deceasedFirstName"] = extracted_info["deceasedFirstName"]
        if "deceasedLastName" in extracted_info:
            form_data["deceasedLastName"] = extracted_info["deceasedLastName"]
        if "dateOfDeath" in extracted_info:
            form_data["dateOfDeath"] = extracted_info["dateOfDeath"]
        if "dateOfBirth" in extracted_info:
            form_data["deceasedDateOfBirth"] = extracted_info["dateOfBirth"]
        if "placeOfDeath" in extracted_info:
            form_data["placeOfDeath"] = extracted_info["placeOfDeath"]
        if "registrationNumber" in extracted_info:
            form_data["deathRegistrationNumber"] = extracted_info["registrationNumber"]
            
    elif doc_type == "funeral_invoice":
        if "totalAmount" in extracted_info:
            form_data["funeralCost"] = extracted_info["totalAmount"]
        if "serviceProvider" in extracted_info:
            form_data["funeralDirector"] = extracted_info["serviceProvider"]
        if "invoiceDate" in extracted_info:
            form_data["funeralInvoiceDate"] = extracted_info["invoiceDate"]
        if "funeralDate" in extracted_info:
            form_data["funeralDate"] = extracted_info["funeralDate"]
            
    elif doc_type == "benefit_letter":
        if "benefitType" in extracted_info:
            form_data["benefitType"] = extracted_info["benefitType"]
        if "paymentAmount" in extracted_info:
            form_data["benefitAmount"] = extracted_info["paymentAmount"]
        if "letterDate" in extracted_info:
            form_data["benefitLetterDate"] = extracted_info["letterDate"]
            
    elif doc_type == "relationship_proof":
        if "relationshipType" in extracted_info:
            form_data["relationshipToDeceased"] = extracted_info["relationshipType"]
    
    return form_data

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port)
