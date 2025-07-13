import os
import pytest
from unittest.mock import patch, MagicMock

# Import the module to test
# We'll assume the module structure - you may need to adjust these imports
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ingest_docs import process_document, split_text, load_documents

class TestDocumentProcessing:
    """Tests for document processing functionality"""
    
    def test_load_documents(self, test_pdf_path, mock_chroma_client):
        """Test loading documents from a directory"""
        with patch('ingest_docs.DirectoryLoader') as mock_loader:
            # Mock the loader to return our test document
            mock_docs = [MagicMock(page_content="Test content", metadata={"source": test_pdf_path})]
            mock_loader.return_value.load.return_value = mock_docs
            
            # Call the function
            docs = load_documents(os.path.dirname(test_pdf_path))
            
            # Assert the loader was called with the correct directory
            mock_loader.assert_called_once_with(os.path.dirname(test_pdf_path))
            
            # Assert the correct documents were returned
            assert len(docs) == 1
            assert docs[0].page_content == "Test content"
            assert docs[0].metadata["source"] == test_pdf_path
    
    def test_split_text(self):
        """Test splitting text into chunks"""
        with patch('ingest_docs.RecursiveCharacterTextSplitter') as mock_splitter:
            # Create a mock document
            mock_doc = MagicMock(page_content="This is a test document with enough text to split.")
            mock_docs = [mock_doc]
            
            # Mock the text splitter
            mock_chunks = [
                MagicMock(page_content="This is a test document"),
                MagicMock(page_content="with enough text to split.")
            ]
            mock_splitter.return_value.split_documents.return_value = mock_chunks
            
            # Call the function
            chunks = split_text(mock_docs)
            
            # Assert the splitter was called with the correct documents
            mock_splitter.return_value.split_documents.assert_called_once_with(mock_docs)
            
            # Assert the correct chunks were returned
            assert len(chunks) == 2
            assert chunks[0].page_content == "This is a test document"
            assert chunks[1].page_content == "with enough text to split."
    
    @patch('ingest_docs.load_documents')
    @patch('ingest_docs.split_text')
    def test_process_document(self, mock_split_text, mock_load_documents, mock_chroma_client, test_pdf_path):
        """Test the complete document processing flow"""
        # Mock the load_documents function
        mock_docs = [MagicMock(page_content="Test content", metadata={"source": test_pdf_path})]
        mock_load_documents.return_value = mock_docs
        
        # Mock the split_text function
        mock_chunks = [
            MagicMock(page_content="Chunk 1", metadata={"source": test_pdf_path}),
            MagicMock(page_content="Chunk 2", metadata={"source": test_pdf_path})
        ]
        mock_split_text.return_value = mock_chunks
        
        # Get a mock collection
        collection = mock_chroma_client.get_or_create_collection("test_collection")
        
        # Call the function
        with patch('ingest_docs.ChromaClient', return_value=mock_chroma_client):
            result = process_document(test_pdf_path, "test_collection")
            
            # Assert the functions were called correctly
            mock_load_documents.assert_called_once_with(os.path.dirname(test_pdf_path))
            mock_split_text.assert_called_once_with(mock_docs)
            
            # Check if the documents were added to the collection
            assert len(collection.added_documents) == 2
            assert collection.added_documents[0] == "Chunk 1"
            assert collection.added_documents[1] == "Chunk 2"
            
            # Verify the result
            assert result is True
