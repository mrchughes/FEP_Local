import os
import pytest
from unittest.mock import patch, MagicMock

# Import the module to test
# We'll need to adjust these imports based on the actual implementation
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Import the main module - adjust as needed based on actual implementation
from main import get_rag_response, create_prompt, process_query

class TestRAGFunctionality:
    """Tests for RAG (Retrieval Augmented Generation) functionality"""
    
    def test_create_prompt(self):
        """Test prompt creation from retrieved context"""
        # Sample context and query
        context = [
            "The applicant must provide proof of relationship to the deceased.",
            "The funeral payment can cover burial fees, cremation fees, and up to £1000 for other expenses."
        ]
        query = "What documents do I need to prove my relationship to the deceased?"
        
        # Call the function
        prompt = create_prompt(context, query)
        
        # Assert the prompt contains both context and query
        assert all(ctx in prompt for ctx in context)
        assert query in prompt
        assert "Answer the question based on the context provided" in prompt
    
    def test_process_query(self, mock_chroma_client):
        """Test query processing and retrieval from vector store"""
        # Sample query
        query = "What proof of relationship is required?"
        
        # Call the function with mocked ChromaDB
        with patch('main.ChromaClient', return_value=mock_chroma_client):
            # Get a mock collection
            collection = mock_chroma_client.get_or_create_collection("test_collection")
            
            # Process the query
            results = process_query(query, collection)
            
            # Assert the results
            assert len(results) > 0
            assert isinstance(results, list)
            assert "mock document content" in str(results).lower()
    
    @patch('main.process_query')
    @patch('main.create_prompt')
    def test_get_rag_response(self, mock_create_prompt, mock_process_query, mock_openai):
        """Test the complete RAG pipeline"""
        # Sample query
        query = "What documents do I need for a funeral payment claim?"
        
        # Mock the process_query function
        mock_process_query.return_value = [
            "The applicant must provide a death certificate.",
            "The applicant must provide proof of their qualifying benefit."
        ]
        
        # Mock the create_prompt function
        mock_prompt = "Sample prompt with context and query"
        mock_create_prompt.return_value = mock_prompt
        
        # Call the function with mocked OpenAI
        with patch('main.OpenAI', return_value=mock_openai):
            response = get_rag_response(query, "test_collection")
            
            # Assert the process_query was called correctly
            mock_process_query.assert_called_once()
            assert query in str(mock_process_query.call_args)
            
            # Assert create_prompt was called with the correct arguments
            mock_create_prompt.assert_called_once()
            
            # Assert the response
            assert response == "This is a mock response from the AI."
    
    def test_end_to_end_rag_with_mocks(self, mock_chroma_client, mock_openai):
        """Test the end-to-end RAG flow with all components mocked"""
        # Sample query
        query = "What documents do I need for a funeral payment claim?"
        
        # Mock all the functions and services
        with patch('main.ChromaClient', return_value=mock_chroma_client), \
             patch('main.OpenAI', return_value=mock_openai):
            
            # Get the RAG response
            response = get_rag_response(query, "test_collection")
            
            # Assert the response
            assert response is not None
            assert "mock response" in response.lower()
