# AI Agent Test Framework

This directory contains the test framework for the AI Agent component of the FEP_Local application.

## Test Structure

The test framework is organized as follows:

- `conftest.py`: Contains pytest fixtures shared across all test files
- `fixtures/`: Contains test data and mock objects for testing
- `test_*.py`: Individual test files for different aspects of the AI Agent

## Test Files

- `test_document_processing.py`: Tests for document loading, processing, and vector storage
- `test_rag_functionality.py`: Tests for the RAG (Retrieval Augmented Generation) pipeline
- `test_api_endpoints.py`: Tests for the API endpoints of the AI Agent
- `test_evidence_extraction.py`: Tests for evidence document data extraction

## Running Tests

To run the tests, make sure you have installed the required test dependencies from `requirements-test.txt`:

```bash
pip install -r requirements-test.txt
```

Then run the tests using pytest:

```bash
# Run all tests
pytest

# Run tests with coverage report
pytest --cov=. --cov-report=term-missing

# Run a specific test file
pytest tests/test_document_processing.py

# Run a specific test
pytest tests/test_document_processing.py::TestDocumentProcessing::test_load_documents
```

## Fixtures

The test framework includes several fixtures to help with testing:

- `test_client`: A Flask test client for API testing
- `mock_openai`: A mock for OpenAI API responses
- `mock_chroma_client`: A mock for ChromaDB client
- `test_pdf_path`: Creates a sample PDF file for testing
- `test_policy_document`: Creates a sample policy document for testing

## Test Data

Test data is stored in `fixtures/test_data.py` and includes:

- Sample policy document text
- Sample chat queries and expected responses
- Sample document metadata
- Sample user profiles
- Sample API responses
- Sample evidence extraction results

## Mock Services

`fixtures/mock_ai_service.py` provides a mock implementation of the AI Agent service for testing, including:

- Chat response generation
- Document processing
- Evidence data extraction

## Adding New Tests

When adding new tests:

1. Create a new test file if testing a new component
2. Add fixtures to `conftest.py` if they will be shared across multiple test files
3. Add test data to `fixtures/test_data.py` if needed
4. Follow the existing test patterns and naming conventions

## CI Integration

These tests are designed to be run in CI environments to ensure the AI Agent functions correctly. The configuration is in `pytest.ini`.
