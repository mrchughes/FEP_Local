import os
from langchain_openai import ChatOpenAI
from langchain_community.tools.tavily_search import TavilySearchResults

tavily_key = os.getenv("TAVILY_API_KEY")
openai_key = os.getenv("OPENAI_API_KEY")

llm = ChatOpenAI(model="gpt-3.5-turbo", openai_api_key=openai_key)
search_tool = TavilySearchResults(api_key=tavily_key)

# Simulate the ConversationState
def decide_search(state):
    question = f"""
    Your task is to determine whether a question requires a web search to answer accurately and completely.
    If the question can be answered without up-to-date or external data (e.g. general knowledge), respond: No.  
    If the question requires current, location-specific, or real-time data, respond: Yes. 
    Question: {state['input']} 
    """
    decision = llm.invoke(question)
    # ChatOpenAI returns an AIMessage object; extract content
    decision_text = decision.content if hasattr(decision, 'content') else str(decision)
    state['need_search'] = "yes" in decision_text.lower()
    return state

def perform_search(state):
    if state['need_search']:
        try:
            results = search_tool.run(state['input'])
            state['search_results'] = results
        except Exception as e:
            state['search_results'] = f"[Web search error: {e}]"
    else:
        state['search_results'] = ''
    return state

def generate_response(state):
    full_prompt = f"You: {state['input']}"
    if state['search_results']:
        full_prompt += f"\n\nSearch results:\n{state['search_results']}"
    if '[Web search error:' in (state['search_results'] or ''):
        state['response'] = state['search_results']
        return state
    response = llm.invoke(full_prompt)
    state['response'] = response
    return state

if __name__ == "__main__":
    state = {'input': 'What is the current weather in London?', 'history': '', 'search_results': ''}
    state = decide_search(state)
    print(f"[TEST] After decide_search: {state}")
    state = perform_search(state)
    print(f"[TEST] After perform_search: {state}")
    state = generate_response(state)
    print(f"[TEST] After generate_response: {state}")
    print(f"[TEST] Final response: {state['response']}")
