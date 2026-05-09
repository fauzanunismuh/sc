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

if [ -z "${NODE_OPTIONS:-}" ]; then
	export NODE_OPTIONS=--max-old-space-size=8192
fi

if ! curl -sf --max-time 5 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"code1":"a","code2":"a"}' \
  "$PYTHON_SERVICE_URL/analyze/codebert-only" >/dev/null 2>&1; then
	lsof -ti tcp:8000 | xargs kill 2>/dev/null || true
	(
		cd "$PROJ/similarity-service"
		nohup "$PROJ/.venv/bin/python" -m uvicorn api:app --host 0.0.0.0 --port 8000 >/tmp/uvicorn.log 2>&1 &
	)

	i=0
	until curl -sf --max-time 5 \
	  -X POST \
	  -H "Content-Type: application/json" \
	  -d '{"code1":"a","code2":"a"}' \
	  "$PYTHON_SERVICE_URL/analyze/codebert-only" >/dev/null 2>&1; do
		i=$((i + 1))
		if [ "$i" -ge 30 ]; then
			echo "Python service failed to start" >&2
			exit 1
		fi
		sleep 2
	done
fi

echo "rebuilding similarity"
npx tsx scripts/regenerate-similarity.ts
