import os
import pytest
import json
from unittest.mock import patch, MagicMock

# Import the module to test
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Import the main app - adjust as needed based on actual implementation
from main import app

class TestAIAgentAPI:
    """Tests for AI Agent API endpoints"""
    
    def test_health_check(self, test_client):
        """Test the health check endpoint"""
        response = test_client.get('/health')
        
        assert response.status_code == 200
        assert json.loads(response.data)['status'] == 'ok'
    
    @patch('main.get_rag_response')
    def test_chat_endpoint(self, mock_get_rag_response, test_client):
        """Test the chat endpoint"""
        # Mock the RAG response
        mock_get_rag_response.return_value = "This is a response from the AI agent."
        
        # Test data
        request_data = {
            'query': 'What documents do I need for a funeral payment claim?',
            'collection': 'policy_documents'
        }
        
        # Call the endpoint
        response = test_client.post(
            '/chat',
            data=json.dumps(request_data),
            content_type='application/json'
        )
        
        # Assert the response
        assert response.status_code == 200
        response_data = json.loads(response.data)
        assert 'response' in response_data
        assert response_data['response'] == "This is a response from the AI agent."
        
        # Assert the RAG function was called correctly
        mock_get_rag_response.assert_called_once_with(
            request_data['query'],
            request_data['collection']
        )
    
    @patch('main.process_document')
    def test_upload_document_endpoint(self, mock_process_document, test_client, test_pdf_path):
        """Test the document upload endpoint"""
        # Mock the document processing
        mock_process_document.return_value = True
        
        # Create a test file to upload
        with open(test_pdf_path, 'rb') as test_file:
            # Call the endpoint
            response = test_client.post(
                '/upload',
                data={
                    'file': (test_file, 'test_document.pdf'),
                    'collection': 'policy_documents'
                },
                content_type='multipart/form-data'
            )
        
        # Assert the response
        assert response.status_code == 200
        response_data = json.loads(response.data)
        assert response_data['success'] is True
        assert 'document processed successfully' in response_data['message'].lower()
        
        # Assert the processing function was called correctly
        mock_process_document.assert_called_once()
        # The first argument should be a path to the uploaded file
        assert 'test_document.pdf' in str(mock_process_document.call_args[0][0])
        # The second argument should be the collection name
        assert mock_process_document.call_args[0][1] == 'policy_documents'
    
    def test_chat_endpoint_error_handling(self, test_client):
        """Test error handling in the chat endpoint"""
        # Test with missing query
        request_data = {
            'collection': 'policy_documents'
            # Missing 'query' field
        }
        
        # Call the endpoint
        response = test_client.post(
            '/chat',
            data=json.dumps(request_data),
            content_type='application/json'
        )
        
        # Assert the response
        assert response.status_code == 400
        response_data = json.loads(response.data)
        assert 'error' in response_data
        assert 'query' in response_data['error'].lower()
    
    @patch('main.get_rag_response')
    def test_chat_endpoint_exception_handling(self, mock_get_rag_response, test_client):
        """Test exception handling in the chat endpoint"""
        # Mock the RAG response to raise an exception
        mock_get_rag_response.side_effect = Exception("Test exception")
        
        # Test data
        request_data = {
            'query': 'What documents do I need?',
            'collection': 'policy_documents'
        }
        
        # Call the endpoint
        response = test_client.post(
            '/chat',
            data=json.dumps(request_data),
            content_type='application/json'
        )
        
        # Assert the response
        assert response.status_code == 500
        response_data = json.loads(response.data)
        assert 'error' in response_data
        assert 'test exception' in response_data['error'].lower()
