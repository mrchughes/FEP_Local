import requests

def test_current_weather():
    url = "http://localhost:5100/ai-agent/chat"
    payload = {"input": "What is the current weather in London?"}
    response = requests.post(url, json=payload)
    print("Status Code:", response.status_code)
    print("Response:", response.json())

if __name__ == "__main__":
    test_current_weather()
