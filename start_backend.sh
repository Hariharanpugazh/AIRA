#!/bin/bash
export DATABASE_URL=postgresql://admin:Admin2026Secure@localhost:5433/livekit_admin
export REDIS_URL=redis://localhost:6379
export LIVEKIT_URL=http://localhost:7880
export LIVEKIT_API_KEY=APIwQJRKPH1GaLa
export LIVEKIT_API_SECRET=mCafIFJr80hhRBYVBKCUqgOLEiIpRFLj5RAfEaNjF8p

cd backend
./api/venv/bin/python3 -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
