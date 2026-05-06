#!/bin/sh
PROJ="/Volumes/Farhan/seminar hasil/sistem-penelitian"
cd "$PROJ/similarity-service"
"$PROJ/.venv/bin/python" -m uvicorn api:app --host 0.0.0.0 --port 8000
