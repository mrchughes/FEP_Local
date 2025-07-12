
# ...existing code...

from dotenv import load_dotenv
import os
import logging
from flask import Flask, request, jsonify, render_template
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langgraph.graph import StateGraph, END
# from langgraph import State
from langchain_community.tools.tavily_search import TavilySearchResults
from typing_extensions import TypedDict
from langchain.vectorstores import Chroma
from werkzeug.utils import secure_filename

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
app.config['UPLOAD_FOLDER'] = '/shared-evidence'
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
rag_db = None
if os.path.exists(persist_dir):
    try:
        rag_db = Chroma(persist_directory=persist_dir, embedding_function=embeddings)
    except Exception:
        rag_db = None
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
    for fname in os.listdir(docs_dir):
        if fname.lower().endswith(('.pdf', '.docx', '.txt')):
            file_path = os.path.join(docs_dir, fname)
            logging.info(f"[EXTRACT] Processing file: {file_path}")
            try:
                if fname.lower().endswith('.txt'):
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                elif fname.lower().endswith('.docx'):
                    doc = Document(file_path)
                    content = '\n'.join([para.text for para in doc.paragraphs])
                elif fname.lower().endswith('.pdf'):
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
                response = llm.invoke(prompt)
                extracted[fname] = str(response.content) if hasattr(response, 'content') else str(response)
                logging.info(f"[EXTRACT] Extraction result for {fname}: {extracted[fname]}")
            except Exception as e:
                logging.error(f"[EXTRACT ERROR] {fname}: {e}")
                extracted[fname] = f"Error extracting: {e}"
    return jsonify(extracted)

# --- List policy documents in RAG ---
@ai_agent_bp.route('/docs', methods=['GET'])
def list_docs():
    docs_dir = app.config['POLICY_UPLOAD_FOLDER']
    files = []
    for fname in os.listdir(docs_dir):
        if fname.lower().endswith(('.pdf', '.docx', '.txt')):
            files.append(fname)
    return jsonify({'documents': files})

# --- Remove a policy document from RAG ---
@ai_agent_bp.route('/docs/<filename>', methods=['DELETE'])
def delete_doc(filename):
    docs_dir = app.config['POLICY_UPLOAD_FOLDER']
    file_path = os.path.join(docs_dir, filename)
    if not os.path.exists(file_path):
        return jsonify({'success': False, 'error': 'File not found'}), 404
    try:
        os.remove(file_path)
        # Re-ingest all docs to update RAG DB
        import subprocess
        subprocess.run([
            'python', os.path.join(os.path.dirname(__file__), 'ingest_docs.py')
        ], check=True)
        global rag_db
        rag_db = Chroma(persist_directory=persist_dir, embedding_function=embeddings)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Health check endpoint
@ai_agent_bp.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@ai_agent_bp.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config['POLICY_UPLOAD_FOLDER'], filename)
    file.save(save_path)
    # Automatically ingest after upload
    try:
        import subprocess
        subprocess.run([
            'python', os.path.join(os.path.dirname(__file__), 'ingest_docs.py')
        ], check=True)
        global rag_db
        rag_db = Chroma(persist_directory=persist_dir, embedding_function=embeddings)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@ai_agent_bp.route('/rag', methods=['POST'])
def rag():
    user_input = request.json['input']
    if rag_db is None:
        return jsonify({'response': 'RAG database not loaded. Please ingest documents.'})
    docs = rag_db.similarity_search(user_input, k=3)
    context = "\n\n".join([d.page_content for d in docs])
    prompt = f"Use the following DWP policy context to answer:\n{context}\n\nQuestion: {user_input}"
    try:
        logging.info(f"[RAG] Calling llm.invoke() with prompt: {prompt}")
        response = llm.invoke(prompt)
        logging.info(f"[RAG] llm.invoke() response: {response}")
    except Exception as llm_exc:
        logging.error(f"[RAG] llm.invoke() error: {llm_exc}", exc_info=True)
        response = f"[RAG LLM error: {llm_exc}]"
    if not response:
        logging.error("[RAG] llm.invoke() returned empty or None response.")
        response = "[RAG LLM returned no response]"
    return jsonify({"response": response})

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
llm = ChatOpenAI(model="gpt-3.5-turbo", openai_api_key=openai_key)
if tavily_key:
    search_tool = TavilySearchResults(api_key=tavily_key)
else:
    print("[ERROR] TAVILY_API_KEY not set in environment. Web search will not work.")
    search_tool = TavilySearchResults()
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
    #experiment
    full_prompt = funny_prompt + full_prompt
    # If web search failed, return a clear error to the user
    if '[Web search error:' in (state['search_results'] or ''):
        state['response'] = state['search_results']
        state['history'] += f"\nYou: {state['input']}\nAssistant: {state['search_results']}"
        return state
    try:
        logging.info(f"[GEN_RESP] Calling llm.predict() with prompt: {full_prompt}")
        response = llm.predict(full_prompt)
        logging.info(f"[GEN_RESP] llm.predict() response: {response}")
    except Exception as llm_exc:
        logging.error(f"[GEN_RESP] llm.predict() error: {llm_exc}", exc_info=True)
        response = f"[GEN_RESP LLM error: {llm_exc}]"
    if not response:
        logging.error("[GEN_RESP] llm.predict() returned empty or None response.")
        response = "[GEN_RESP LLM returned no response]"
    clean_response = response.replace("Assistant:", "").strip() if isinstance(response, str) else str(response)
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

        # Decide: RAG or Web
        use_rag = False
        if rag_db is not None:
            # Simple heuristic: if "policy" or "DWP" in question, use RAG
            if any(word in user_input.lower() for word in ["policy", "dwp", "regulation", "benefit"]):
                use_rag = True

        if use_rag:
            try:
                logging.info("[CHAT] Using RAG agent.")
                docs = rag_db.similarity_search(user_input, k=3)
                context = "\n\n".join([d.page_content for d in docs])
                prompt = f"Use the following DWP policy context to answer:\n{context}\n\nQuestion: {user_input}"
                logging.info(f"[CHAT] RAG prompt: {prompt}")
                import concurrent.futures
                try:
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                        future = executor.submit(llm.invoke, prompt)
                        response = future.result(timeout=30)
                    logging.info(f"[CHAT] RAG llm.invoke() response: {response}")
                except concurrent.futures.TimeoutError:
                    logging.error("[CHAT] RAG llm.invoke() timed out.", exc_info=True)
                    response = "[RAG LLM timed out]"
                except Exception as llm_exc:
                    logging.error(f"[CHAT] RAG llm.invoke() error: {llm_exc}", exc_info=True)
                    response = f"[RAG LLM error: {llm_exc}]"
                if not response:
                    logging.error("[CHAT] RAG llm.invoke() returned empty or None response.")
                    response = "[RAG LLM returned no response]"
                user_sessions[session_id] = history + f"\nYou: {user_input}\nAssistant: {response}"
                logging.info(f"[CHAT] RAG response: {response}")
                return jsonify({"response": response})
            except Exception as e:
                logging.error(f"[CHAT] RAG error: {e}", exc_info=True)
                return jsonify({"response": f"[RAG error: {e}]"})

        # Otherwise, use web search agent
        try:
            logging.info("[CHAT] Using web search agent.")
            state = ConversationState(input=user_input, history=history, search_results="")
            logging.info(f"[CHAT] Web agent state: {state}")
            result = graph.invoke(state)
            user_sessions[session_id] = result['history']
            need_to_search = result.get('need_search', False)
            if not result or not result.get('response'):
                logging.error("[CHAT] Web agent graph.invoke() returned empty or None response.")
                full_response = "[Web agent returned no response]"
            elif need_to_search:
                full_response = "Invoking Web Search Agent... Invoking RAG Agent...\n"
                full_response += result['response']
            else:
                full_response = result['response']
            logging.info(f"[CHAT] Web agent response: {full_response}")
            return jsonify({"response": full_response})
        except Exception as e:
            logging.error(f"[CHAT] Web agent error: {e}", exc_info=True)
            logging.error(f"[CHAT] TAVILY_API_KEY set: {bool(tavily_key)}")
            return jsonify({"response": f"[Web agent error: {e}]"})
    except Exception as e:
        logging.error(f"[CHAT] General chat endpoint error: {e}", exc_info=True)
        return jsonify({"response": f"[General error: {e}]"})

@ai_agent_bp.route('/check-form', methods=['POST'])
def check_form():
    content = request.json.get('content', '')
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
    return jsonify({"response": response_str})




@app.route('/')
def home_root():
    return render_template("index.html")

app.register_blueprint(ai_agent_bp)
print("[INFO] Registered ai_agent blueprint at /ai-agent")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050)
