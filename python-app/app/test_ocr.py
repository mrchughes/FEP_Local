#!/usr/bin/env python3
"""
OCR Testing Script

This script tests the OCR functionality by processing sample image files.
"""

import os
import sys
import argparse
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Add parent directory to path to import modules
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

from ai_agent.ocr_utils import process_document, clean_extracted_text

def test_ocr(file_path):
    """Test OCR on a single file"""
    if not os.path.exists(file_path):
        logging.error(f"File not found: {file_path}")
        return False
        
    try:
        logging.info(f"Processing file: {file_path}")
        # Extract text from file
        extracted_text = process_document(file_path)
        # Clean text
        cleaned_text = clean_extracted_text(extracted_text)
        
        # Print results
        logging.info(f"Successfully processed file: {file_path}")
        logging.info(f"Extracted {len(cleaned_text)} characters")
        
        # Print sample of text (first 500 chars)
        sample = cleaned_text[:500] + "..." if len(cleaned_text) > 500 else cleaned_text
        logging.info(f"Sample text: {sample}")
        
        return True
    except Exception as e:
        logging.error(f"Error processing file: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Test OCR functionality")
    parser.add_argument("file", help="Path to file to process")
    args = parser.parse_args()
    
    success = test_ocr(args.file)
    if success:
        logging.info("OCR test completed successfully")
    else:
        logging.error("OCR test failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
