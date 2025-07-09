import socket
import sys

host = "localhost"
port = 11434

try:
    with socket.create_connection((host, port), timeout=5) as sock:
        print(f"SUCCESS: Connected to {host}:{port}")
except Exception as e:
    print(f"FAIL: Could not connect to {host}:{port} - {e}")
    sys.exit(1)
