#!/usr/bin/env bash
# Hentikan server Harita yang berjalan dari folder instalasi ini.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${HARITA_PORT:-${MYACT_PORT:-8777}}"
PIDS="$(pgrep -f "$DIR/server.py" || true)"
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs -r kill
  echo "Harita dihentikan (port $PORT)."
else
  echo "Harita tidak sedang berjalan."
fi
