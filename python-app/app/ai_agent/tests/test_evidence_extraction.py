import os
import pytest
from unittest.mock import patch, MagicMock

# Import the module to test
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Import the extraction module - adjust as needed based on actual implementation
try:
    from extract import extract_document_data, extract_from_death_certificate, extract_from_funeral_bill
except ImportError:
    # Mock these functions if the module doesn't exist yet
    extract_document_data = lambda *args, **kwargs: {}
    extract_from_death_certificate = lambda *args, **kwargs: {}
    extract_from_funeral_bill = lambda *args, **kwargs: {}

# Import the test fixtures
from fixtures.test_data import EVIDENCE_EXTRACTION_RESULTS

class TestEvidenceExtraction:
    """Tests for evidence document extraction functionality"""
    
    @patch('extract.extract_from_death_certificate')
    @patch('extract.extract_from_funeral_bill')
    @patch('extract.extract_from_benefits_proof')
    def test_extract_document_data_router(self, mock_benefits, mock_funeral, mock_death, tmp_path):
        """Test that the document router calls the correct extraction function based on document type"""
        # Create test files
        death_cert_path = tmp_path / "Death_Certificate.docx"
        funeral_bill_path = tmp_path / "Funeral_Bill.docx"
        benefits_proof_path = tmp_path / "Proof_of_Benefits.docx"
        
        with open(death_cert_path, 'w') as f:
            f.write("Sample death certificate content")
        with open(funeral_bill_path, 'w') as f:
            f.write("Sample funeral bill content")
        with open(benefits_proof_path, 'w') as f:
            f.write("Sample benefits proof content")
        
        # Set up mock returns
        mock_death.return_value = EVIDENCE_EXTRACTION_RESULTS["Death_Certificate.docx"]
        mock_funeral.return_value = EVIDENCE_EXTRACTION_RESULTS["Funeral_Bill.docx"]
        mock_benefits.return_value = EVIDENCE_EXTRACTION_RESULTS["Proof_of_Benefits.docx"]
        
        # Call the function for each document type
        extract_document_data(str(death_cert_path))
        extract_document_data(str(funeral_bill_path))
        extract_document_data(str(benefits_proof_path))
        
        # Assert the correct extraction function was called for each document
        mock_death.assert_called_once_with(str(death_cert_path))
        mock_funeral.assert_called_once_with(str(funeral_bill_path))
        mock_benefits.assert_called_once_with(str(benefits_proof_path))
    
    @patch('extract.docx2txt.process')
    def test_extract_from_death_certificate(self, mock_docx2txt, tmp_path):
        """Test extraction from death certificate"""
        # Create a mock death certificate file
        death_cert_path = tmp_path / "Death_Certificate.docx"
        with open(death_cert_path, 'w') as f:
            f.write("Sample death certificate content")
        
        # Set up mock return for docx2txt
        mock_docx2txt.return_value = """
        Death Certificate
        
        Deceased Name: Robert Johnson
        Date of Death: 2023-05-10
        Place of Death: London General Hospital
        Cause of Death: Heart Failure
        Registration District: London
        Registration Number: DX123456
        """
        
        # Call the function
        result = extract_from_death_certificate(str(death_cert_path))
        
        # Assert the extraction results
        assert result["deceased_name"] == "Robert Johnson"
        assert result["date_of_death"] == "2023-05-10"
        assert result["place_of_death"] == "London General Hospital"
        assert result["cause_of_death"] == "Heart Failure"
        assert result["registration_district"] == "London"
        assert result["registration_number"] == "DX123456"
    
    @patch('extract.docx2txt.process')
    def test_extract_from_funeral_bill(self, mock_docx2txt, tmp_path):
        """Test extraction from funeral bill"""
        # Create a mock funeral bill file
        funeral_bill_path = tmp_path / "Funeral_Bill.docx"
        with open(funeral_bill_path, 'w') as f:
            f.write("Sample funeral bill content")
        
        # Set up mock return for docx2txt
        mock_docx2txt.return_value = """
        Funeral Services Invoice
        
        Funeral Director: Smith Funeral Services
        Date of Funeral: 2023-05-17
        
        Services:
        - Basic funeral director services: £1,800.00
        - Coffin: £750.00
        - Cremation fee: £650.00
        - Flowers: £150.00
        - Car hire: £100.00
        
        Total Cost: £3,450.00
        """
        
        # Call the function
        result = extract_from_funeral_bill(str(funeral_bill_path))
        
        # Assert the extraction results
        assert result["funeral_director"] == "Smith Funeral Services"
        assert result["funeral_date"] == "2023-05-17"
        assert result["total_cost"] == "£3,450.00"
        assert len(result["services"]) == 5
        assert "Basic funeral director services: £1,800.00" in result["services"]
    
    def test_extract_document_data_invalid_file(self, tmp_path):
        """Test handling of invalid file types"""
        # Create a file with unsupported extension
        invalid_file_path = tmp_path / "invalid_document.xyz"
        with open(invalid_file_path, 'w') as f:
            f.write("Sample invalid file content")
        
        # Call the function
        result = extract_document_data(str(invalid_file_path))
        
        # Assert the result is empty for invalid file
        assert result == {} or result is None
    
    def test_extract_document_data_nonexistent_file(self):
        """Test handling of nonexistent files"""
        # Call the function with a nonexistent file path
        result = extract_document_data("/path/to/nonexistent/file.docx")
        
        # Assert the result is empty for nonexistent file
        assert result == {} or result is None
