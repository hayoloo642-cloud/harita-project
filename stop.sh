#!/usr/bin/env bash
# Hentikan server MyAct yang berjalan di localhost.
PORT="${MYACT_PORT:-8777}"
PIDS="$(pgrep -f "python3 .*myact/server.py" || true)"
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs -r kill
  echo "MyAct dihentikan (port $PORT)."
else
  echo "MyAct tidak sedang berjalan."
fi
