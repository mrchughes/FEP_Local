import os
import json
from unittest.mock import MagicMock

class MockAIAgentService:
    """
    Mock service for AI Agent functionality to use in tests
    """
    
    def __init__(self):
        """Initialize the mock service with predefined responses"""
        # Load fixtures for testing
        fixtures_path = os.path.join(os.path.dirname(__file__), 'fixtures', 'test_data.py')
        
        # Create namespace and execute the fixtures file
        namespace = {}
        with open(fixtures_path, 'r') as f:
            exec(f.read(), namespace)
        
        self.policy_document = namespace.get('POLICY_DOCUMENT', '')
        self.chat_queries = namespace.get('CHAT_QUERIES', [])
        self.api_responses = namespace.get('API_RESPONSES', {})
        
        # Create a mapping of queries to responses for quick lookup
        self.query_responses = {}
        for query_data in self.chat_queries:
            query = query_data['query']
            # Create a fake response that includes all expected keywords
            response = f"Based on the policy: {' '.join(query_data['expected_keywords'])}"
            self.query_responses[query.lower()] = response
    
    def get_chat_response(self, query, collection=None):
        """
        Get a mock response for a chat query
        
        Args:
            query (str): The query from the user
            collection (str, optional): The collection to search in
            
        Returns:
            str: A mock response that would be similar to what the real AI would return
        """
        # Try to find an exact match for the query
        if query.lower() in self.query_responses:
            return self.query_responses[query.lower()]
        
        # If no exact match, look for a similar query
        for test_query, response in self.query_responses.items():
            if any(word in query.lower() for word in test_query.split()):
                return response
        
        # Default response if no match found
        return "I don't have specific information about that in my knowledge base. Please refer to the Funeral Expenses Payment policy document for more details."
    
    def process_document(self, file_path, collection=None):
        """
        Mock document processing
        
        Args:
            file_path (str): Path to the document file
            collection (str, optional): Collection to add the document to
            
        Returns:
            bool: Success indicator
        """
        # Check if the file exists
        if not os.path.exists(file_path):
            return False
            
        # Check file extension
        _, file_extension = os.path.splitext(file_path)
        valid_extensions = ['.pdf', '.docx', '.doc', '.txt']
        
        if file_extension.lower() not in valid_extensions:
            return False
            
        # Simulate successful processing
        return True
    
    def extract_evidence_data(self, file_path):
        """
        Mock evidence data extraction
        
        Args:
            file_path (str): Path to the evidence document
            
        Returns:
            dict: Extracted data or None if file not recognized
        """
        # Get just the filename without path
        filename = os.path.basename(file_path)
        
        # Load fixtures
        fixtures_path = os.path.join(os.path.dirname(__file__), 'fixtures', 'test_data.py')
        
        # Create namespace and execute the fixtures file
        namespace = {}
        with open(fixtures_path, 'r') as f:
            exec(f.read(), namespace)
        
        evidence_data = namespace.get('EVIDENCE_EXTRACTION_RESULTS', {})
        
        # Return data if we have it for this file
        if filename in evidence_data:
            return evidence_data[filename]
        
        # For any Death Certificate
        if "death" in filename.lower() and "certificate" in filename.lower():
            return evidence_data.get("Death_Certificate.docx", {})
            
        # For any Funeral Bill
        if "funeral" in filename.lower() and ("bill" in filename.lower() or "invoice" in filename.lower()):
            return evidence_data.get("Funeral_Bill.docx", {})
            
        # For any Benefits Proof
        if "benefit" in filename.lower() or "universal" in filename.lower():
            return evidence_data.get("Proof_of_Benefits.docx", {})
            
        # Default: return empty dict if we don't recognize the file
        return {}
