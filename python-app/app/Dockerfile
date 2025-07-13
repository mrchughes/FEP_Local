FROM python:3.11-slim
WORKDIR /app

# Install build dependencies and other required packages for OCR
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    python3-dev \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# First install psutil separately (pre-built wheel)
RUN pip install --no-cache-dir psutil==5.9.8 --prefer-binary

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 80
CMD ["gunicorn", "-b", "0.0.0.0:80", "app:app"]
