#!/bin/bash
export NEXT_PUBLIC_API_URL=http://localhost:8000
export NEXT_PUBLIC_WS_URL=ws://localhost:8000/rtc

cd frontend
npm run dev
