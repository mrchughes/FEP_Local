# app_with_background.py

from dotenv import load_dotenv
import os
from flask import Flask, request, jsonify, render_template
from langchain.chat_models import ChatOpenAI
from langgraph.graph import StateGraph, END
# from langgraph import State
from langchain_community.tools.tavily_search import TavilySearchResults
from typing_extensions import TypedDict

load_dotenv()
openai_key = os.getenv("OPENAI_API_KEY")

# Flask app setup
app = Flask(__name__)

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
llm_name = "gpt-3.5-turbo"
# system_prompt = "you are a cockney geezer"
llm = ChatOpenAI(api_key=openai_key, model=llm_name, temperature=0)
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
    print(state['need_search'])
    if state['need_search']:
        results = search_tool.run(state['input'])
        state['search_results'] = results
        print(state['need_search'])
    return state

def generate_response(state: ConversationState) -> ConversationState:
    full_prompt = f"{state['history']}\nYou: {state['input']}"
    if state['search_results']:
        full_prompt += f"\n\nSearch results:\n{state['search_results']}"
    #experiment
    full_prompt = funny_prompt + full_prompt
    response = llm.predict(full_prompt)
    clean_response = response.replace("Assistant:", "").strip()
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


@app.route('/')
def home():
    print("here")
    return render_template("index.html")

@app.route('/chat', methods=['POST'])
def chat():
    user_input = request.json['input']
    session_id = request.remote_addr
    history = user_sessions.get(session_id, "")

    state = ConversationState(input=user_input, history=history, search_results="")
    result = graph.invoke(state)
    user_sessions[session_id] = result['history']
    print(state)
    print(need_to_search)
    if need_to_search:
        full_response = "Invoking Web Search Agent... Invoking RAG Agent...\n"
        full_response += result['response']
    else:
        full_response = result['response']        
    return jsonify({"response": full_response})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
