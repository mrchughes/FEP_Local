import os
from langchain_community.tools.tavily_search import TavilySearchResults

tavily_key = os.getenv("TAVILY_API_KEY")
search_tool = TavilySearchResults(api_key=tavily_key)

query = "What is the current weather in London?"
print(f"[TEST] Running TavilySearchResults.run for: {query}")
try:
    results = search_tool.run(query)
    print(f"[TEST] TavilySearchResults.run results: {results}")
except Exception as e:
    print(f"[TEST] TavilySearchResults.run error: {e}")
