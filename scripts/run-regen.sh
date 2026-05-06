#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJ=$(dirname "$SCRIPT_DIR")

cd "$PROJ"

if [ -f .env ]; then
	set -a
	. ./.env
	set +a
fi

PYTHON_SERVICE_URL="${PYTHON_SERVICE_URL:-http://127.0.0.1:8000}"

if ! curl -sf --max-time 5 "$PYTHON_SERVICE_URL/health" >/dev/null 2>&1; then
	nohup "$PROJ/.venv/bin/python" -m uvicorn api:app --host 0.0.0.0 --port 8000 >/tmp/uvicorn.log 2>&1 &
	uvicorn_pid=$!

	i=0
	until curl -sf --max-time 5 "$PYTHON_SERVICE_URL/health" >/dev/null 2>&1; do
		i=$((i + 1))
		if [ "$i" -ge 30 ]; then
			echo "Python service failed to start" >&2
			kill "$uvicorn_pid" 2>/dev/null || true
			exit 1
		fi
		sleep 2
	done
fi

npx tsx scripts/regenerate-similarity.ts
