from datetime import datetime
# ...existing code...

from dotenv import load_dotenv
import os
import logging
import sys
import json
from flask import Flask, request, jsonify, render_template
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langgraph.graph import StateGraph, END
# from langgraph import State
from langchain_community.tools.tavily_search import TavilySearchResults
from typing_extensions import TypedDict
from langchain_community.vectorstores import Chroma
from werkzeug.utils import secure_filename
# OCR imports
import ocr_utils
import document_processor
import ai_document_processor

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent.log"))
    ]
)

load_dotenv()
openai_key = os.getenv("OPENAI_API_KEY")
tavily_key = os.getenv("TAVILY_API_KEY")


# Flask app setup
# Set template_folder to absolute path for reliability
from flask_cors import CORS
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), 'templates')
app = Flask(__name__, template_folder=TEMPLATE_DIR)
# Enable CORS for all origins when using Cloudflare
CORS(app, 
     origins=["*"],  # Allow all origins since Cloudflare will handle security
     supports_credentials=True,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"])

# Log CORS configuration
cloudflare_url = os.getenv("CLOUDFLARE_URL", "Not set")
frontend_url = os.getenv("FRONTEND_URL", "Not set")
logging.info(f"[CONFIG] CORS enabled with Cloudflare URL: {cloudflare_url}, Frontend URL: {frontend_url}")

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

# Use shared Docker volume for evidence
# Check if we're in a Docker container (shared-evidence exists) or local development
if os.path.exists('/shared-evidence'):
    app.config['UPLOAD_FOLDER'] = '/shared-evidence'
else:
    # Fallback to a local directory for development
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads', 'evidence')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
logging.info(f"[CONFIG] AI agent evidence folder set to {app.config['UPLOAD_FOLDER']}")

# Use a separate folder for policy documents (RAG knowledge base)
app.config['POLICY_UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'policy_docs')
os.makedirs(app.config['POLICY_UPLOAD_FOLDER'], exist_ok=True)
logging.info(f"[CONFIG] AI agent policy folder set to {app.config['POLICY_UPLOAD_FOLDER']}")

# RAG setup
persist_dir = os.path.join(os.path.dirname(__file__), 'chroma_db')
if not openai_key:
    raise ValueError("OPENAI_API_KEY is not set in the environment.")
embeddings = OpenAIEmbeddings(openai_api_key=openai_key)

# Define a function to load or reload the RAG database
def load_rag_database():
    global rag_db
    try:
        if os.path.exists(persist_dir):
            logging.info(f"[INIT] Loading RAG database from {persist_dir}")
            
            # Re-initialize embeddings to ensure they match what was used during ingestion
            local_embeddings = OpenAIEmbeddings(openai_api_key=openai_key)
            rag_db = Chroma(persist_directory=persist_dir, embedding_function=local_embeddings)
            
            # Verify DB has documents
            db_data = rag_db.get()
            if db_data and 'documents' in db_data:
                doc_count = len(db_data['documents'])
                logging.info(f"[INIT] Successfully loaded RAG database with {doc_count} chunks")
            else:
                logging.warning("[INIT] RAG database exists but contains no documents")
            
            return True
        else:
            logging.info("[INIT] No RAG database found at {persist_dir}")
            rag_db = None
            return False
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f"[INIT] Error loading RAG database: {e}", exc_info=True)
        rag_db = None
        return False

# Initialize RAG database
rag_db = None
load_rag_database()

# Function to force a reload of the RAG database
def force_reload_rag_database():
    global rag_db, embeddings
    
    try:
        logging.info("[RELOAD] Forcing reload of RAG database")
        persist_dir = os.path.join(os.path.dirname(__file__), 'chroma_db')
        
        if not os.path.exists(persist_dir):
            logging.warning(f"[RELOAD] RAG database directory not found at {persist_dir}")
            return False
            
        # First clear the existing reference
        rag_db = None
        
        # Re-initialize embeddings
        local_embeddings = OpenAIEmbeddings(openai_api_key=openai_key)
        
        # Create a new instance
        rag_db = Chroma(persist_directory=persist_dir, embedding_function=local_embeddings)
        
        # Verify it loaded correctly
        db_data = rag_db.get()
        if db_data and 'documents' in db_data:
            doc_count = len(db_data['documents'])
            logging.info(f"[RELOAD] Successfully reloaded RAG database with {doc_count} chunks")
            return True
        else:
            logging.warning("[RELOAD] Reloaded RAG database has no documents")
            return False
    except Exception as e:
        logging.error(f"[RELOAD] Error reloading RAG database: {e}", exc_info=True)
        return False

# Initialize LLM globally
llm = ChatOpenAI(model="gpt-3.5-turbo", openai_api_key=openai_key) if openai_key else None
if llm:
    logging.info("[INIT] LLM initialized successfully with OpenAI API key")
else:
    logging.error("[INIT] Failed to initialize LLM - missing OpenAI API key")

# 5. Flask route for the UI with background image

from flask import Blueprint, send_from_directory

# Add a test route for CORS debugging
@app.route('/api/test-cors', methods=['GET'])
def test_cors():
    return jsonify({'success': True, 'message': 'CORS is working properly'})

# Serve static files
from docx import Document
import PyPDF2
ai_agent_bp = Blueprint('ai_agent', __name__, url_prefix='/ai-agent')

@ai_agent_bp.route('/extract-form-data', methods=['POST'])
def extract_form_data():
    docs_dir = app.config['UPLOAD_FOLDER']
    logging.info(f"[EXTRACT] Scanning evidence directory: {docs_dir}")
    extracted = {}
    
    # Initialize document processor for OCR
    document_processor_instance = document_processor.DocumentProcessor(upload_folder=docs_dir)
    
    # Initialize AI document processor for langchain integration
    ai_document_processor_instance = None
    try:
        ai_document_processor_instance = ai_document_processor.AIDocumentProcessor()
        logging.info("[EXTRACT] AI Document Processor initialized successfully")
    except Exception as e:
        logging.error(f"[EXTRACT] Failed to initialize AI Document Processor: {e}", exc_info=True)
    
    # Get the list of files from the request, if provided
    requested_files = []
    if request.json and 'files' in request.json:
        requested_files = request.json.get('files', [])
        logging.info(f"[EXTRACT] Processing requested files: {requested_files}")
    
    # Process all files in the directory if no specific files requested
    file_list = requested_files if requested_files else os.listdir(docs_dir)
    
    for fname in file_list:
        file_path = os.path.join(docs_dir, fname)
        if not os.path.exists(file_path):
            logging.warning(f"[EXTRACT] File not found: {file_path}")
            extracted[fname] = "Error: File not found"
            continue
            
        if not os.path.isfile(file_path):
            logging.warning(f"[EXTRACT] Not a file: {file_path}")
            continue
            
        logging.info(f"[EXTRACT] Processing file: {file_path}")
        
        try:
            # Check file extension to determine processing method
            _, ext = os.path.splitext(file_path)
            ext = ext.lower()
            
            # Process image files with OCR
            if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif']:
                logging.info(f"[EXTRACT] Processing image file with OCR: {file_path}")
                
                # Process the file with OCR
                ocr_result = document_processor_instance.process_file(file_path)
                
                if not ocr_result.get("success", False):
                    logging.error(f"[EXTRACT] OCR processing failed: {ocr_result.get('error')}")
                    extracted[fname] = f"Error: OCR processing failed: {ocr_result.get('error')}"
                    continue
                    
                content = ocr_result.get("text", "")
                logging.info(f"[EXTRACT] Successfully extracted {len(content)} characters from image")
                
            # Process text, PDF, and DOCX files as before
            elif ext == '.txt':
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
            elif ext == '.docx':
                doc = Document(file_path)
                content = '\n'.join([para.text for para in doc.paragraphs])
            elif ext == '.pdf':
                content = ""
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    for page in reader.pages:
                        content += page.extract_text() or ""
            else:
                content = f"File {fname} is not a supported type."
                
            # Application schema summary (field: description)
            schema = '''
firstName: Applicant's first name
lastName: Applicant's last name
dateOfBirth: Applicant's date of birth
nationalInsuranceNumber: Applicant's National Insurance number
addressLine1: Address line 1
addressLine2: Address line 2
town: Town or city
county: County
postcode: Postcode
phoneNumber: Phone number
email: Email address
partnerFirstName: Partner's first name
partnerLastName: Partner's last name
partnerDateOfBirth: Partner's date of birth
partnerNationalInsuranceNumber: Partner's National Insurance number
partnerBenefitsReceived: Benefits the partner receives
partnerSavings: Partner's savings
deceasedFirstName: Deceased's first name
deceasedLastName: Deceased's last name
deceasedDateOfBirth: Deceased's date of birth
deceasedDateOfDeath: Deceased's date of death
deceasedPlaceOfDeath: Place of death
deceasedCauseOfDeath: Cause of death
deceasedCertifyingDoctor: Certifying doctor
deceasedCertificateIssued: Certificate issued
relationshipToDeceased: Relationship to deceased
supportingEvidence: Supporting evidence
responsibilityStatement: Responsibility statement
responsibilityDate: Responsibility date
benefitType: Type of benefit
benefitReferenceNumber: Benefit reference number
benefitLetterDate: Date on benefit letter
householdBenefits: Household benefits (array)
incomeSupportDetails: Details about Income Support
disabilityBenefits: Disability benefits (array)
carersAllowance: Carer's Allowance
carersAllowanceDetails: Carer's Allowance details
funeralDirector: Funeral director
funeralEstimateNumber: Funeral estimate number
funeralDateIssued: Date funeral estimate issued
funeralTotalEstimatedCost: Total estimated funeral cost
funeralDescription: Funeral description
funeralContact: Funeral contact
evidence: Evidence documents (array)
'''
            prompt = f'''
You are an expert assistant helping to process evidence for a funeral expenses claim. The following is the application schema:
{schema}

Read the following evidence and extract all information relevant to the claim. For each field you extract, provide:
- The field name (from the schema above)
- The value
- A short explanation of your reasoning or the evidence source (e.g. "Found in death certificate under 'Date of death'")
If a field is not directly mentioned but can be inferred, include it and explain your inference.
Return your answer as a JSON object where each key is a field name, and each value is an object with 'value' and 'reasoning'.

Evidence:
{content}
'''
            if llm is None:
                logging.error(f"[EXTRACT ERROR] {fname}: LLM not initialized properly")
                extracted[fname] = "Error: AI model not available. Check OpenAI API key configuration."
            else:
                response = llm.invoke(prompt)
                extracted[fname] = str(response.content) if hasattr(response, 'content') else str(response)
                logging.info(f"[EXTRACT] Extraction result for {fname}: {extracted[fname]}")
        except Exception as e:
            logging.error(f"[EXTRACT ERROR] {fname}: {e}", exc_info=True)
            extracted[fname] = f"Error extracting: {e}"
    return jsonify(extracted)

# --- List policy documents in RAG ---
@ai_agent_bp.route('/docs', methods=['GET'])
def list_docs():
    """List all policy documents in the system"""
    docs_dir = app.config['POLICY_UPLOAD_FOLDER']
    logging.info(f"[DOCS] Listing documents from {docs_dir}")
    
    # Check if we need to force reload the database (e.g., after a recent upload)
    force_reload = request.args.get('force_reload', 'false').lower() == 'true'
    if force_reload:
        logging.info("[DOCS] Force reload requested")
        force_reload_rag_database()
    
    try:
        # Ensure the directory exists
        os.makedirs(docs_dir, exist_ok=True)
        
        # Get all files with details
        files = []
        for filename in os.listdir(docs_dir):
            if filename.lower().endswith(('.pdf', '.docx', '.txt')):
                file_path = os.path.join(docs_dir, filename)
                if os.path.isfile(file_path):
                    file_info = {
                        'name': filename,
                        'size': os.path.getsize(file_path),
                        'last_modified': os.path.getmtime(file_path)
                    }
                    files.append(file_info)
        
        # Sort by most recently modified
        files.sort(key=lambda x: x['last_modified'], reverse=True)
        
        # Get RAG database status
        rag_status = {'initialized': False, 'document_count': 0}
        
        if rag_db is not None:
            try:
                # Force a fresh read of the database to avoid caching issues
                db_data = rag_db.get(include=['documents'])
                if db_data and 'documents' in db_data:
                    rag_status = {
                        'initialized': True,
                        'document_count': len(db_data['documents'])
                    }
                logging.info(f"[DOCS] RAG status: {rag_status}")
            except Exception as rag_err:
                logging.error(f"[DOCS] Error getting RAG status: {rag_err}", exc_info=True)
        
        logging.info(f"[DOCS] Found {len(files)} documents")
        
        # Return both document list and RAG status
        return jsonify({
            'documents': [doc['name'] for doc in files],  # For backward compatibility
            'document_details': files,  # More detailed information
            'rag_status': rag_status
        })
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f"[DOCS] Error listing documents: {e}", exc_info=True)
        return jsonify({'documents': [], 'error': str(e)})

# --- Remove a policy document from RAG ---
@ai_agent_bp.route('/docs/<filename>', methods=['DELETE'])
def delete_doc(filename):
    docs_dir = app.config['POLICY_UPLOAD_FOLDER']
    file_path = os.path.join(docs_dir, filename)
    
    # Check if this is a re-ingestion request
    re_ingest_mode = False
    if request.is_json:
        data = request.get_json()
        re_ingest_mode = data.get('reIngest', False)
    
    if not os.path.exists(file_path):
        logging.error(f"[DELETE] File not found: {file_path}")
        return jsonify({'success': False, 'error': 'File not found'}), 404
        
    try:
        if not re_ingest_mode:
            # Regular delete operation
            # Delete the file
            os.remove(file_path)
            logging.info(f"[DELETE] Removed file: {file_path}")
        else:
            # Re-ingestion mode - make a backup but don't delete
            logging.info(f"[DELETE] Re-ingestion mode for file: {file_path}")
            # We'll proceed with re-ingestion without deleting the original
        
        # Re-ingest all docs to update RAG DB
        import subprocess
        logging.info("[DELETE] Starting re-ingestion after file deletion")
        try:
            # Check if there are any documents left
            remaining_docs = [f for f in os.listdir(docs_dir) 
                             if os.path.isfile(os.path.join(docs_dir, f)) and 
                             f.lower().endswith(('.pdf', '.docx', '.txt'))]
            
            global rag_db
            if not remaining_docs and not re_ingest_mode:
                logging.info("[DELETE] No documents left, clearing the vector database")
                # If no documents left, we should clear the vector database
                persist_dir = os.path.join(os.path.dirname(__file__), 'chroma_db')
                if os.path.exists(persist_dir):
                    import shutil
                    try:
                        # Backup the database first
                        backup_dir = persist_dir + "_backup_delete"
                        if os.path.exists(backup_dir):
                            shutil.rmtree(backup_dir)
                        shutil.copytree(persist_dir, backup_dir)
                        
                        # Remove the database
                        shutil.rmtree(persist_dir)
                        logging.info("[DELETE] Successfully cleared vector database")
                        
                        # Set rag_db to None since there's no database anymore
                        rag_db = None
                    except Exception as rm_err:
                        logging.error(f"[DELETE] Error clearing vector database: {rm_err}", exc_info=True)
                        return jsonify({'success': False, 'error': f'File deleted but database clearing failed: {str(rm_err)}'}), 500
            else:
                # Run the ingestion script to rebuild the database
                result = subprocess.run([
                    'python', os.path.join(os.path.dirname(__file__), 'ingest_docs.py')
                ], check=True, capture_output=True, text=True)
                
                if result.stderr:
                    logging.warning(f"[DELETE] Re-ingestion warnings: {result.stderr}")
                
                logging.info("[DELETE] Re-ingestion completed successfully")
                
                # Force reload the RAG database using our reload function
                reload_success = force_reload_rag_database()
                if not reload_success:
                    logging.error(f"[DELETE] Failed to reload RAG database after deletion")
                    return jsonify({'success': False, 'error': 'File deleted but database reload failed'}), 500
                    
                logging.info("[DELETE] Successfully reloaded RAG database after deletion")
        except subprocess.CalledProcessError as e:
            logging.error(f"[DELETE] Re-ingestion failed: {e.stderr}")
            return jsonify({'success': False, 'error': f'File deleted but re-ingestion failed: {e.stderr}'}), 500
        except Exception as e:
            logging.error(f"[DELETE] Error during re-ingestion: {e}", exc_info=True)
            return jsonify({'success': False, 'error': f'File deleted but re-ingestion failed: {str(e)}'}), 500
            
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f"[DELETE] Error removing file: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

# Health check endpoint
@ai_agent_bp.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@ai_agent_bp.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        logging.error("[UPLOAD] No file part in the request")
        return jsonify({'success': False, 'error': 'No file part'}), 400
        
    file = request.files['file']
    if file.filename == '':
        logging.error("[UPLOAD] No selected file")
        return jsonify({'success': False, 'error': 'No selected file'}), 400
        
    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config['POLICY_UPLOAD_FOLDER'], filename)
    
    try:
        # Ensure policy docs directory exists
        os.makedirs(app.config['POLICY_UPLOAD_FOLDER'], exist_ok=True)
        
        # Save the file
        file.save(save_path)
        logging.info(f"[UPLOAD] Saved file to {save_path}")
        
        # Verify file was saved successfully
        if not os.path.exists(save_path):
            raise FileNotFoundError(f"File was not saved at {save_path}")
            
        file_size = os.path.getsize(save_path)
        logging.info(f"[UPLOAD] Verified file exists at {save_path} with size {file_size} bytes")
    except Exception as save_error:
        logging.error(f"[UPLOAD] Error saving file: {save_error}", exc_info=True)
        return jsonify({'success': False, 'error': f'Error saving file: {str(save_error)}'}), 500
    
    # Automatically ingest after upload
    try:
        logging.info("[UPLOAD] Running document ingestion...")
        import subprocess
        script_path = os.path.join(os.path.dirname(__file__), 'ingest_docs.py')
        
        # Run ingestion script with additional logging
        logging.info(f"[UPLOAD] Running ingestion script at {script_path}")
        
        # Run with full environment
        env = os.environ.copy()
        result = subprocess.run([
            'python', script_path
        ], check=True, capture_output=True, text=True, env=env)
        
        logging.info(f"[UPLOAD] Ingestion completed with output: {result.stdout}")
        if result.stderr:
            logging.warning(f"[UPLOAD] Ingestion warnings: {result.stderr}")
        
        # Reload the vector database - make this a global variable change
        global rag_db
        persist_dir = os.path.join(os.path.dirname(__file__), 'chroma_db')
        try:
            # Check if the database exists first
            if not os.path.exists(persist_dir):
                logging.error(f"[UPLOAD] Vector database directory not found at {persist_dir}")
                return jsonify({
                    'success': False, 
                    'error': f'Document saved but RAG database directory not found'
                }), 500                # Try to reload the database
            logging.info(f"[UPLOAD] Reloading RAG database from {persist_dir}")
            
            # Re-initialize embeddings to ensure they match what was used during ingestion
            local_embeddings = OpenAIEmbeddings(openai_api_key=openai_key)
            
            # Important: Create a new Chroma instance to avoid caching issues
            global rag_db
            rag_db = None  # Clear the existing reference to force reload
            rag_db = Chroma(persist_directory=persist_dir, embedding_function=local_embeddings)
            
            # Verify the database has documents
            db_data = rag_db.get()
            if not db_data or 'documents' not in db_data or not db_data['documents']:
                logging.warning("[UPLOAD] Reloaded RAG database has no documents")
            else:
                logging.info(f"[UPLOAD] Successfully reloaded RAG database with {len(db_data['documents'])} chunks")
        except Exception as reload_err:
            logging.error(f"[UPLOAD] Failed to reload RAG database: {reload_err}", exc_info=True)
            return jsonify({
                'success': False, 
                'error': f'Document saved but RAG database reload failed: {str(reload_err)}'
            }), 500
        
        return jsonify({
            'success': True, 
            'message': f'Document {filename} uploaded and processed successfully',
            'fileSize': file_size,
            'filename': filename  # Return the secure filename for frontend verification
        })
    except subprocess.CalledProcessError as proc_err:
        logging.error(f"[UPLOAD] Ingestion process error: {proc_err}", exc_info=True)
        if proc_err.stderr:
            logging.error(f"[UPLOAD] Ingestion stderr: {proc_err.stderr}")
        return jsonify({
            'success': False, 
            'error': f'Upload succeeded but ingestion failed. Process error: {proc_err.stderr or str(proc_err)}'
        })
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f"[UPLOAD] Error during ingestion: {e}", exc_info=True)
        return jsonify({
            'success': False, 
            'error': f'Upload succeeded but ingestion failed: {str(e)}'
        })

@ai_agent_bp.route('/rag', methods=['POST'])
def rag():
    # Add test response to confirm the endpoint is reachable
    try:
        logging.info("[RAG_DEBUG] Starting RAG request at " + str(datetime.now()))
        if request.json:
            logging.info(f"[RAG_DEBUG] Request JSON: {request.json}")
        else:
            logging.info("[RAG_DEBUG] No request.json found")
        # Test early return to see if the function is being called properly
        if request.json and request.json.get("test_mode") == "true":
            return jsonify({"status": "rag_endpoint_reachable", "message": "RAG endpoint is functioning correctly"})
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f"[RAG_DEBUG] Error in debug section: {e}", exc_info=True)
        return jsonify({"error": f"Debug error: {str(e)}"}), 500

    logging.info("[RAG] Starting RAG request")
    logging.info(f"[RAG] Request JSON: {request.json}")
    user_input = request.json.get('input')
    
    # Check if 'input' parameter is provided, if not, check for 'query' parameter
    if not user_input and request.json:
        user_input = request.json.get('query')
        logging.info(f"[RAG] No 'input' parameter found, using 'query' parameter: {user_input}")
    
    if not user_input:
        return jsonify({'response': 'No question provided. Please include "input" or "query" parameter.'}), 400
        
    # Check if RAG database is loaded
    if rag_db is None:
        return jsonify({
            'response': 'The policy knowledge base is not loaded. Please upload policy documents first.',
            'error': 'rag_not_loaded'
        })
        
    try:
        # Check if the database has documents
        db_data = rag_db.get()
        if not db_data or 'documents' not in db_data or not db_data['documents']:
            return jsonify({
                'response': 'The policy knowledge base contains no documents. Please upload policy documents first.',
                'error': 'no_documents'
            })
            
        # Get similar documents
        docs = rag_db.similarity_search(user_input, k=3)
        if not docs:
            return jsonify({
                'response': 'I couldn\'t find any relevant policy information to answer your question. Try asking about a different topic or upload more relevant policy documents.',
                'error': 'no_relevant_docs'
            })
            
        # Create context from documents
        context = "\n\n".join([d.page_content for d in docs])
        
        # Create prompt
        prompt = f"""Use the following DWP policy context to answer the question. 
If the context doesn't contain relevant information to answer the question, 
say so clearly and suggest what other information might be needed.

POLICY CONTEXT:
{context}

QUESTION: {user_input}

If possible, cite the specific policy or document section that contains your answer."""
        
        # Log the prompt
        logging.info(f"[RAG] Using prompt with {len(docs)} documents, prompt length: {len(prompt)}")
        
        # Call LLM
        response = llm.invoke(prompt)
        
        # Extract response content
        if hasattr(response, 'content'):
            response_content = response.content
        else:
            response_content = str(response)
            
        logging.info(f"[RAG] Generated response length: {len(response_content)}")
        
        # Return response
        return jsonify({"response": response_content})
        
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f"[RAG] Error: {e}", exc_info=True)
        return jsonify({
            'response': f"I encountered an error while searching the policy knowledge base. Please try again later.",
            'error': str(e)
        }), 500

#Funny prompt
funny_prompt =  os.environ.get('funny_prompt')

# In-memory user session storage (simple dictionary)
user_sessions = {}

# 1. Define the conversation state
class ConversationState(TypedDict):
    input: str
    history: str = ""
    response: str = None
    need_search: bool = False
    search_results: str = ""
    RAG: bool 


# 2. Initialize the LLM and search tool
try:
    llm = ChatOpenAI(model="gpt-3.5-turbo", openai_api_key=openai_key)
    logging.info("[INIT] Successfully initialized ChatOpenAI")
except Exception as e:
    logging.error(f"[INIT] Error initializing ChatOpenAI: {e}", exc_info=True)
    llm = None  # We'll handle this case in the endpoints

if tavily_key:
    try:
        search_tool = TavilySearchResults(api_key=tavily_key)
        logging.info("[INIT] Successfully initialized TavilySearchResults")
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f"[INIT] Error initializing TavilySearchResults: {e}", exc_info=True)
        search_tool = None
else:
    logging.warning("[INIT] TAVILY_API_KEY not set in environment. Web search will not work.")
    search_tool = None
    
need_to_search = False

# 3. LangGraph nodes
def decide_search(state: ConversationState) -> ConversationState:
    global need_to_search
    question = f"""
    Your task is to determine whether a question requires a web search to answer accurately and completely.

    If the question can be answered without up-to-date or external data (e.g. general knowledge), respond: No.  
    If the question requires current, location-specific, or real-time data, respond: Yes. 
    
    Question: {state['input']} 
    """
    decision = llm.predict(question)
    state['need_search'] = "yes" in decision.lower()
    if state['need_search']:
        need_to_search = True
    else:
        need_to_search = False    
    return state

def perform_search(state: ConversationState) -> ConversationState:
    logging.info(f"[perform_search] need_search: {state['need_search']}")
    if state['need_search']:
        try:
            logging.info(f"[perform_search] Attempting web search for: {state['input']}")
            results = search_tool.run(state['input'])
            logging.info(f"[perform_search] Web search results: {results}")
            if not results or (isinstance(results, str) and not results.strip()):
                logging.error("[perform_search] No results returned from Tavily API.")
                state['search_results'] = '[Web search error: No results returned from Tavily API]'
            else:
                state['search_results'] = results
        except Exception as e:
            logging.error(f"[perform_search] Web search failed: {e}", exc_info=True)
            state['search_results'] = f"[Web search error: {e}]"
    else:
        logging.info("[perform_search] Web search not needed.")
    return state

def generate_response(state: ConversationState) -> ConversationState:
    full_prompt = f"{state['history']}\nYou: {state['input']}"
    if state['search_results']:
        full_prompt += f"\n\nSearch results:\n{state['search_results']}"
    
    # Add funny prompt if configured
    if funny_prompt:
        full_prompt = funny_prompt + full_prompt
    
    # If web search failed, return a clear error to the user
    if '[Web search error:' in (state['search_results'] or ''):
        state['response'] = state['search_results']
        state['history'] += f"\nYou: {state['input']}\nAssistant: {state['search_results']}"
        return state
    
    try:
        logging.info(f"[GEN_RESP] Calling llm.invoke() with prompt: {full_prompt}")
        response = llm.invoke(full_prompt)
        logging.info(f"[GEN_RESP] llm.invoke() returned response object type: {type(response)}")
        
        # Extract content from response object
        if hasattr(response, 'content'):
            response_content = response.content
        else:
            response_content = str(response)
            
        logging.info(f"[GEN_RESP] Extracted response content: {response_content}")
    except Exception as llm_exc:
        logging.error(f"[GEN_RESP] llm.invoke() error: {llm_exc}", exc_info=True)
        response_content = f"I encountered an error while generating a response. Please try again or rephrase your question."
    
    if not response_content:
        logging.error("[GEN_RESP] llm.invoke() returned empty or None response.")
        response_content = "I couldn't generate a response for your question. Please try again or ask something different."
        
    clean_response = response_content.replace("Assistant:", "").strip() if isinstance(response_content, str) else str(response_content)
    state['response'] = clean_response
    state['history'] += f"\nYou: {state['input']}\nAssistant: {clean_response}"
    return state

# 4. Build the LangGraph
builder = StateGraph(ConversationState)
builder.add_node("decide_search", decide_search)
builder.add_node("perform_search", perform_search)
builder.add_node("generate_response", generate_response)
builder.set_entry_point("decide_search")
builder.add_edge("decide_search", "perform_search")
builder.add_edge("perform_search", "generate_response")
builder.add_edge("generate_response", END)
graph = builder.compile()

# 5. Flask route for the UI with background image





@ai_agent_bp.route('/')
def home():
    return render_template("index.html")

@ai_agent_bp.route('/chat', methods=['POST'])
def chat():
    try:
        user_input = request.json.get('input', None)
        session_id = request.remote_addr
        history = user_sessions.get(session_id, "")
        logging.info(f"[CHAT] Received chat request: {user_input}")
        if not user_input:
            logging.error("[CHAT] No input provided in request body.")
            return jsonify({"response": "[Error: No input provided]"}), 400

        # Log RAG DB and LLM status
        logging.info(f"[CHAT] rag_db is {'set' if rag_db is not None else 'NOT set'}.")
        logging.info(f"[CHAT] tavily_key is {'set' if tavily_key else 'NOT set'}.")
        logging.info(f"[CHAT] openai_key is {'set' if openai_key else 'NOT set'}.")

        if not openai_key:
            logging.error("[CHAT] OpenAI API key is not set.")
            return jsonify({"response": "Configuration error: OpenAI API key is not set. Please check server configuration."}), 500

        # First, check if RAG is available
        rag_available = False
        rag_document_count = 0
        
        if rag_db is not None:
            try:
                db_data = rag_db.get()
                if db_data and 'documents' in db_data and len(db_data['documents']) > 0:
                    rag_available = True
                    rag_document_count = len(db_data['documents'])
                    logging.info(f"[CHAT] RAG is available with {rag_document_count} chunks")
                else:
                    logging.info("[CHAT] RAG database is empty")
            except Exception as e:
                logging.error(f"[CHAT] Error checking RAG database: {e}", exc_info=True)
        else:
            logging.info("[CHAT] RAG database is not initialized")
        
        # Determine if we should use RAG based on the query and availability
        use_rag = False
        if rag_available:
            # Simple heuristic: if "policy" or related terms in question, use RAG
            policy_keywords = ["policy", "dwp", "regulation", "benefit", "funeral", "payment", 
                              "document", "documentation", "guidelines", "rules", "assistance"]
            
            if any(word.lower() in user_input.lower() for word in policy_keywords):
                use_rag = True
                logging.info("[CHAT] Using RAG based on query keywords")
            else:
                logging.info("[CHAT] Query doesn't match RAG keywords, using web search")
        
        # Try RAG first if available and applicable
        if use_rag:
            try:
                logging.info("[CHAT] Using RAG agent")
                # Get relevant chunks from RAG
                docs = rag_db.similarity_search(user_input, k=3)
                
                if not docs:
                    logging.info("[CHAT] No relevant documents found in RAG database, falling back to web search")
                    use_rag = False
                else:
                    context = "\n\n".join([d.page_content for d in docs])
                    
                    # Create an informative prompt
                    prompt = f"""Use the following DWP policy context to answer the question. 
If the context doesn't contain relevant information to answer the question, 
say so clearly and suggest what other information might be needed.

POLICY CONTEXT:
{context}

QUESTION: {user_input}

If possible, cite the specific policy or document section that contains your answer."""
                    
                    logging.info(f"[CHAT] RAG prompt created with {len(docs)} chunks")
                    
                    # Get response from LLM
                    try:
                        response = llm.invoke(prompt)
                        if hasattr(response, 'content'):
                            response_content = response.content
                        else:
                            response_content = str(response)
                        
                        logging.info(f"[CHAT] RAG LLM returned response of length {len(response_content)}")
                        
                        # Update session history
                        user_sessions[session_id] = history + f"\nYou: {user_input}\nAssistant: {response_content}"
                        
                        return jsonify({"response": response_content, "source": "rag"})
                    except Exception as llm_err:
                        logging.error(f"[CHAT] RAG LLM error: {llm_err}", exc_info=True)
                        # Fall back to web search if RAG fails
                        logging.info("[CHAT] Falling back to web search due to RAG failure")
                        use_rag = False
            except Exception as rag_err:
                logging.error(f"[CHAT] RAG processing error: {rag_err}", exc_info=True)
                # Fall back to web search if RAG fails
                logging.info("[CHAT] Falling back to web search due to RAG error")
                use_rag = False
        
        # Use web search if RAG is not available or applicable
        if not use_rag:
            try:
                logging.info("[CHAT] Using web search agent")
                
                # Initialize state for LangGraph
                state = ConversationState(input=user_input, history=history, search_results="", need_search=False, RAG=False)
                logging.info(f"[CHAT] Web agent initial state created")
                
                try:
                    # Invoke the graph
                    result = graph.invoke(state)
                    
                    # Update session history
                    user_sessions[session_id] = result['history']
                    
                    # Get whether search was used
                    need_search = result.get('need_search', False)
                    
                    # Check for valid response
                    if not result or not result.get('response'):
                        logging.error("[CHAT] Web agent graph.invoke() returned empty response")
                        
                        # Fallback to direct LLM call if graph fails
                        try:
                            direct_response = llm.invoke(f"Answer this question concisely: {user_input}")
                            
                            if hasattr(direct_response, 'content'):
                                direct_content = direct_response.content
                            else:
                                direct_content = str(direct_response)
                            
                            logging.info(f"[CHAT] Fallback direct LLM response: {direct_content}")
                            return jsonify({"response": direct_content, "source": "direct_llm"})
                        except Exception as fallback_err:
                            logging.error(f"[CHAT] Fallback LLM error: {fallback_err}", exc_info=True)
                            return jsonify({
                                "response": "I'm having trouble generating a response right now. Please try again later.",
                                "source": "error"
                            }), 500
                    
                    # Format the response with a prefix if search was used
                    response_prefix = "Searching for information... " if need_search else ""
                    response_text = response_prefix + result['response']
                    
                    logging.info(f"[CHAT] Web agent response: {response_text[:100]}...")
                    return jsonify({"response": response_text, "source": "web"})
                    
                except Exception as graph_err:
                    logging.error(f"[CHAT] Error in graph.invoke(): {graph_err}", exc_info=True)
                    
                    # Fallback to direct LLM call if graph fails
                    try:
                        direct_response = llm.invoke(f"Answer this question concisely: {user_input}")
                        
                        if hasattr(direct_response, 'content'):
                            direct_content = direct_response.content
                        else:
                            direct_content = str(direct_response)
                        
                        logging.info(f"[CHAT] Fallback direct LLM response: {direct_content}")
                        return jsonify({"response": direct_content, "source": "direct_llm"})
                    except Exception as fallback_err:
                        logging.error(f"[CHAT] Fallback LLM error: {fallback_err}", exc_info=True)
                        return jsonify({
                            "response": "I'm having trouble generating a response right now. Please try again later.",
                            "source": "error"
                        }), 500
            
            except Exception as web_err:
                logging.error(f"[CHAT] Web agent error: {web_err}", exc_info=True)
                return jsonify({
                    "response": "I'm having trouble accessing my knowledge sources. Please try again later.",
                    "source": "error"
                }), 500
                
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f"[CHAT] General chat endpoint error: {e}", exc_info=True)
        return jsonify({
            "response": "Something went wrong while processing your request. Please try again later.",
            "source": "error"
        }), 500

@ai_agent_bp.route('/check-form', methods=['POST'])
def check_form():
    try:
        content = request.json.get('content', '')
        logging.info(f"[CHECK-FORM] Received form data length: {len(content)}")
        
        # Verify llm is properly initialized
        if llm is None:
            logging.error("[CHECK-FORM] LLM not initialized properly")
            return jsonify({"response": "Error: AI model not available. Check OpenAI API key configuration."}), 500
        
        # Prompt for policy verification
        policy_prompt = (
            "You are a DWP policy expert. Review the following form questions and answers. "
            "Identify any answers that do not comply with DWP policy or may need amending. "
            "Suggest improvements or flag any issues.\n\n" + content
        )
        # Use RAG if available
        if rag_db is not None:
            docs = rag_db.similarity_search(content, k=3)
            context = "\n\n".join([d.page_content for d in docs])
            policy_prompt = (
                f"Use the following DWP policy context to check the form:\n{context}\n\n" + policy_prompt
            )
        response = llm.invoke(policy_prompt)
        # Ensure the response is JSON serializable (convert to string if needed)
        # If response is an object (e.g., AIMessage), convert to string
        try:
            response_str = str(response.content)
        except AttributeError:
            response_str = str(response)
        logging.info(f"[CHECK-FORM] Response generated successfully. Length: {len(response_str)}")
        return jsonify({"response": response_str})
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f"[CHECK-FORM] Error: {e}", exc_info=True)
        return jsonify({"response": f"Error processing form: {str(e)}"}), 500

# --- OCR API Endpoint ---
@ai_agent_bp.route('/ocr/process', methods=['POST'])
def process_ocr_document():
    """Process a document with OCR and return extracted text"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    # Initialize document processor
    document_processor_instance = document_processor.DocumentProcessor(upload_folder=app.config['UPLOAD_FOLDER'])
    
    # Save and process the file
    file_path = document_processor_instance.save_uploaded_file(file)
    if not file_path:
        return jsonify({"error": "Failed to save file"}), 500
        
    # Process the document
    result = document_processor_instance.process_file(file_path)
    
    # Return the result
    return jsonify(result)

# --- Batch OCR Processing ---
@ai_agent_bp.route('/ocr/batch', methods=['POST'])
def batch_process_ocr_documents():
    """Process multiple documents with OCR"""
    if 'files' not in request.files:
        return jsonify({"error": "No files part"}), 400
        
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({"error": "No selected files"}), 400
        
    # Initialize document processor
    document_processor_instance = document_processor.DocumentProcessor(upload_folder=app.config['UPLOAD_FOLDER'])
    
    file_paths = []
    for file in files:
        file_path = document_processor_instance.save_uploaded_file(file)
        if file_path:
            file_paths.append(file_path)
            
    # Process all documents
    results = document_processor_instance.batch_process_files(file_paths)
    
    # Return the results
    return jsonify(results)
    
# --- AI Document Analysis ---
@ai_agent_bp.route('/ocr/analyze', methods=['POST'])
def analyze_ocr_document():
    """Process a document with OCR and analyze its content with AI"""
    
    # Support direct JSON input for text analysis
    if request.is_json:
        json_data = request.get_json()
        if not json_data or 'text' not in json_data:
            return jsonify({"error": "Missing 'text' field in JSON data"}), 400
            
        try:
            # Initialize AI document processor
            ai_processor = ai_document_processor.AIDocumentProcessor()
            
            # Extract info from text directly
            result = ai_processor.analyze_text_directly(
                json_data['text'],
                json_data.get('document_type', 'generic'),
                json_data.get('fields_to_extract', [])
            )
            
            return jsonify(result)
        except Exception as e:
            logging.error(f"[OCR] Error analyzing JSON text: {e}", exc_info=True)
            return jsonify({"error": f"Error analyzing text: {str(e)}"}), 500
    
    # File upload path
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    # Get custom queries if provided
    queries = None
    if request.form and 'queries' in request.form:
        try:
            queries = json.loads(request.form['queries'])
        except Exception as e:
            logging.error(f"[OCR] Error parsing queries: {e}", exc_info=True)
            
    # Initialize document processor
    document_processor_instance = document_processor.DocumentProcessor(upload_folder=app.config['UPLOAD_FOLDER'])
    
    # Save the file
    file_path = document_processor_instance.save_uploaded_file(file)
    if not file_path:
        return jsonify({"error": "Failed to save file"}), 500
        
    try:
        # Initialize AI document processor
        ai_processor = ai_document_processor.AIDocumentProcessor()
        
        # Process and analyze the document
        result = ai_processor.process_and_analyze_document(file_path, queries)
        
        # Return the analysis result
        return jsonify(result)
    except Exception as e:
        logging.error(f"[OCR] Error analyzing document: {e}", exc_info=True)
        return jsonify({"error": f"Error analyzing document: {str(e)}"}), 500

@ai_agent_bp.route('/debug-rag', methods=['GET'])
def debug_rag():
    try:
        # Get database status
        if rag_db is None:
            return jsonify({'status': 'not_loaded', 'error': 'RAG database is not loaded'})
        # Check if the database has documents
        db_data = rag_db.get()
        if not db_data or 'documents' not in db_data or not db_data['documents']:
            return jsonify({
                'status': 'empty', 
                'error': 'The policy knowledge base contains no documents'
            })
        # Return success with document count
        return jsonify({
            'status': 'loaded',
            'document_count': len(db_data['documents']),
            'embedding_type': str(type(rag_db._embedding_function)),
            'persist_dir': rag_db._persist_directory
        })
    except Exception as e:
        logging.error(f"[RAG_DEBUG] Exception in RAG endpoint: {e}", exc_info=True)
        logging.error(f"[RAG_DEBUG] RAG DB type: {type(rag_db)}")
        logging.error(f'[DEBUG] Error: {e}', exc_info=True)
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/')
def home_root():
    return render_template("index.html")

@ai_agent_bp.route('/verify-file/<filename>', methods=['GET'])
def verify_file(filename):
    """Verify that a file exists on the server after upload."""
    docs_dir = app.config['POLICY_UPLOAD_FOLDER']
    file_path = os.path.join(docs_dir, filename)
    logging.info(f"[VERIFY] Checking if file exists: {file_path}")
    if os.path.exists(file_path) and os.path.isfile(file_path):
        file_size = os.path.getsize(file_path)
        last_modified = os.path.getmtime(file_path)
        # Check if it's in the Chroma DB by listing all documents
        in_rag = False
        if rag_db is not None:
            try:
                # This is a simple heuristic - if the vector DB exists and has docs, 
                # we assume the file was processed (a more accurate check would require 
                # storing document metadata in Chroma)
                docs_count = len(rag_db.get()['documents']) if rag_db.get() and 'documents' in rag_db.get() else 0
                in_rag = docs_count > 0
                logging.info(f"[VERIFY] Vector DB has {docs_count} documents")
            except Exception as e:
                logging.error(f"[VERIFY] Error checking RAG DB: {e}", exc_info=True)
        logging.info(f"[VERIFY] File exists: {file_path}, size: {file_size} bytes, in RAG: {in_rag}")
        return jsonify({
            'exists': True, 
            'size': file_size,
            'last_modified': last_modified,
            'path': file_path,
            'in_rag': in_rag
        })
    else:
        logging.warning(f"[VERIFY] File does not exist: {file_path}")
        return jsonify({'exists': False}), 404

# Register blueprint and log routes for debugging
app.register_blueprint(ai_agent_bp)
logging.info("[INIT] Registered ai_agent blueprint at /ai-agent")

# Print all registered routes for debugging
logging.info("Registered routes:")
for rule in app.url_map.iter_rules():
    logging.info(f"Route: {rule.endpoint} - {rule.rule} - {rule.methods}")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
