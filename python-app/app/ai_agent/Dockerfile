# AI Agent Dockerfile for python-app/app/ai_agent
FROM python:3.11-slim
WORKDIR /app
ARG CACHEBUST=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5050
CMD ["python", "ai_agent/main.py"]
