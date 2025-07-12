import os
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader, Docx2txtLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from dotenv import load_dotenv
import logging
import shutil
import time
import sys

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
# Get directory path relative to the script location
script_dir = os.path.dirname(os.path.abspath(__file__))
policy_docs_path = os.path.join(script_dir, "policy_docs")
persist_dir = os.path.join(script_dir, "chroma_db")

logging.info(f"Ingesting documents from: {policy_docs_path}")
logging.info(f"Persisting to: {persist_dir}")

# Ensure the docs directory exists
os.makedirs(policy_docs_path, exist_ok=True)

# Check if there are any documents to process
doc_files = []
for root, _, files in os.walk(policy_docs_path):
    for file in files:
        if file.endswith(('.pdf', '.docx', '.txt')):
            doc_files.append(os.path.join(root, file))

if not doc_files:
    logging.warning(f"No documents found in {policy_docs_path}. Ingestion aborted.")
    
    # If there are no documents but the vector DB exists, we should clear it
    if os.path.exists(persist_dir):
        try:
            # Create a backup just in case
            backup_dir = persist_dir + "_backup_empty"
            if os.path.exists(backup_dir):
                shutil.rmtree(backup_dir)
            shutil.copytree(persist_dir, backup_dir)
            
            # Remove the database
            shutil.rmtree(persist_dir)
            logging.info(f"No documents found, cleared existing vector database at {persist_dir}")
        except Exception as e:
            logging.error(f"Error clearing vector database: {e}")
    
    exit(0)

# Load all docs
def get_loader(p):
    logging.info(f"Loading file: {p}")
    try:
        if p.endswith(".pdf"):
            return PyPDFLoader(p)
        elif p.endswith(".docx"):
            return Docx2txtLoader(p)
        else:
            return TextLoader(p)
    except Exception as e:
        logging.error(f"Error creating loader for {p}: {e}")
        return None    # If old chroma_db exists, create a backup before recreating
if os.path.exists(persist_dir):
    try:
        backup_dir = persist_dir + "_backup_" + str(int(time.time()))
        if os.path.exists(backup_dir):
            shutil.rmtree(backup_dir)
        shutil.copytree(persist_dir, backup_dir)
        logging.info(f"Created backup of existing vector database at {backup_dir}")
        
        # Remove the existing DB to ensure clean state
        shutil.rmtree(persist_dir)
        logging.info(f"Removed existing database for clean rebuild")
    except Exception as e:
        logging.error(f"Error managing vector database: {e}", exc_info=True)

# Process documents
try:
    logging.info(f"Found {len(doc_files)} document(s) to process")
    
    # Process files individually to handle errors better
    all_docs = []
    for file_path in doc_files:
        try:
            if file_path.endswith(".pdf"):
                loader = PyPDFLoader(file_path)
            elif file_path.endswith(".docx"):
                loader = Docx2txtLoader(file_path)
            elif file_path.endswith(".txt"):
                loader = TextLoader(file_path)
            else:
                logging.warning(f"Unsupported file type: {file_path}, skipping")
                continue
                
            file_docs = loader.load()
            logging.info(f"Successfully loaded {len(file_docs)} page(s) from {os.path.basename(file_path)}")
            all_docs.extend(file_docs)
        except Exception as file_error:
            logging.error(f"Error loading {file_path}: {file_error}", exc_info=True)
            # Continue with other files

    if len(all_docs) == 0:
        logging.warning("No documents were successfully loaded. Check file formats and permissions.")
        print("ERROR: No documents were successfully loaded. Check file formats and permissions.")
        exit(1)
    
    logging.info(f"Successfully loaded {len(all_docs)} total document page(s)")
        
except Exception as e:
    logging.error(f"Error loading documents: {e}", exc_info=True)
    print(f"ERROR: Failed to load documents: {e}")
    exit(1)

# Split
try:
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = splitter.split_documents(all_docs)
    logging.info(f"Split into {len(splits)} chunks")
except Exception as e:
    logging.error(f"Error splitting documents: {e}", exc_info=True)
    exit(1)    # Embed and store
openai_key = os.getenv("OPENAI_API_KEY")
if not openai_key:
    logging.error("OPENAI_API_KEY is not set in the environment.")
    raise ValueError("OPENAI_API_KEY is not set in the environment.")

try:
    # Create a new vector database
    embeddings = OpenAIEmbeddings(openai_api_key=openai_key)
    
    # If directory exists, remove it to prevent partial updates
    if os.path.exists(persist_dir):
        try:
            shutil.rmtree(persist_dir)
            logging.info(f"Removed existing vector database at {persist_dir}")
        except Exception as rm_err:
            logging.error(f"Error removing existing vector database: {rm_err}", exc_info=True)
    
    # Create new database from documents
    logging.info("Creating new Chroma database from documents...")
    db = Chroma.from_documents(splits, embeddings, persist_directory=persist_dir)
    db.persist()
    logging.info(f"Successfully created and persisted Chroma database with {len(splits)} chunks")
    
    # Verify the database was created successfully
    try:
        # Check that we can read from the database
        db_data = db.get()
        if db_data and 'documents' in db_data:
            doc_count = len(db_data['documents'])
            logging.info(f"Successfully verified database contains {doc_count} chunks")
        else:
            logging.warning("Database created but may be empty")
    except Exception as verify_err:
        logging.error(f"Error verifying database content: {verify_err}", exc_info=True)
    
    # Print message to standard output for subprocess capture
    print(f"SUCCESS: Ingestion complete. Indexed {len(splits)} chunks into vector database.")
except Exception as e:
    logging.error(f"Error during embedding or storage: {e}", exc_info=True)
    # Restore from backup if available
    most_recent_backup = None
    max_time = 0
    
    # Find the most recent backup
    for dir_name in os.listdir(script_dir):
        if dir_name.startswith("chroma_db_backup_"):
            try:
                timestamp = int(dir_name.split("_")[-1])
                if timestamp > max_time:
                    max_time = timestamp
                    most_recent_backup = os.path.join(script_dir, dir_name)
            except (ValueError, IndexError):
                continue
    
    if most_recent_backup:
        try:
            logging.info(f"Attempting to restore from most recent backup: {most_recent_backup}")
            if os.path.exists(persist_dir):
                shutil.rmtree(persist_dir)
            shutil.copytree(most_recent_backup, persist_dir)
            logging.info(f"Restored vector database from backup")
        except Exception as restore_err:
            logging.error(f"Error restoring from backup: {restore_err}")
    exit(1)
