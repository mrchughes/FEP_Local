# Use official Python base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy files
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the port
EXPOSE 5000

# Start the Flask app
CMD ["python", "main.py"]
