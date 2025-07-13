#!/bin/bash

# This script rebuilds all services, stops the Cloudflare tunnel, and runs all tests
set -e

echo "===== Stopping all services and Cloudflare tunnel ====="
docker compose down
pkill -f 'cloudflared tunnel run' || true

echo "===== Rebuilding all containers ====="
docker compose build

echo "===== Starting all services ====="
docker compose up -d

echo "===== Waiting for services to initialize (10 seconds) ====="
sleep 10

echo "===== Running AI Agent tests ====="
cd python-app/app/ai_agent
pip install -r requirements.txt
pip install -r requirements-test.txt
pytest tests/

echo "===== Running Backend tests ====="
cd ../../../mern-app/backend
npm test

echo "===== Tests completed ====="

echo "===== Restarting Cloudflare tunnel ====="
cd ../../
nohup cloudflared tunnel run > cloudflared.log 2>&1 &
sleep 3

echo "===== All tests completed ====="
