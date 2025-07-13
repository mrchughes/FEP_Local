import os
import sys
import pytest

# Add the parent directory to the Python path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Test fixtures
@pytest.fixture
def test_client():
    from main import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def mock_openai():
    """Mock the OpenAI API responses"""
    class MockOpenAI:
        def __init__(self):
            pass
        
        def chat_completions_create(self, *args, **kwargs):
            class MockResponse:
                def __init__(self):
                    self.choices = [
                        type('obj', (object,), {
                            'message': type('obj', (object,), {
                                'content': 'This is a mock response from the AI.'
                            })
                        })
                    ]
            return MockResponse()
    
    return MockOpenAI()

@pytest.fixture
def mock_chroma_client():
    """Mock ChromaDB client for testing"""
    class MockCollection:
        def __init__(self):
            self.added_documents = []
            self.added_metadatas = []
            self.added_ids = []
        
        def add(self, documents, metadatas, ids):
            self.added_documents.extend(documents)
            self.added_metadatas.extend(metadatas)
            self.added_ids.extend(ids)
            return True
        
        def query(self, query_texts, n_results=2):
            return {
                'documents': [['This is a mock document content.']],
                'metadatas': [[{'source': 'test.pdf'}]],
                'distances': [[0.1]]
            }
    
    class MockChromaClient:
        def __init__(self):
            self.collections = {}
        
        def get_or_create_collection(self, name):
            if name not in self.collections:
                self.collections[name] = MockCollection()
            return self.collections[name]
    
    return MockChromaClient()

@pytest.fixture
def test_pdf_path(tmp_path):
    """Create a sample PDF file for testing"""
    pdf_path = tmp_path / "test_document.pdf"
    with open(pdf_path, 'w') as f:
        f.write("Sample PDF content for testing")
    return str(pdf_path)

@pytest.fixture
def test_policy_document(tmp_path):
    """Create a sample policy document for testing"""
    doc_path = tmp_path / "test_policy.txt"
    with open(doc_path, 'w') as f:
        f.write("""
        # Test Policy Document
        
        ## Eligibility Criteria
        
        To be eligible for the funeral payment benefit, the applicant must:
        1. Be a resident of the UK
        2. Be receiving at least one qualifying benefit
        3. Be responsible for the funeral arrangements
        
        ## Required Documentation
        
        The following documents must be provided:
        - Death certificate
        - Funeral invoice
        - Proof of qualifying benefit
        - Proof of relationship to the deceased
        """)
    return str(doc_path)

# Set environment variables for testing
os.environ['OPENAI_API_KEY'] = 'test-api-key'
