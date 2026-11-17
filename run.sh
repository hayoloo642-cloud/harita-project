#!/usr/bin/env bash
# Harita — jalankan server lokal lalu buka dashboard.
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${HARITA_PORT:-${MYACT_PORT:-8777}}"
URL="http://127.0.0.1:${PORT}"
LOG="$DIR/data/server.log"
mkdir -p "$DIR/data"

open_dashboard() {
  # Mode "aplikasi" ala desktop app; fallback ke browser default.
  if [ "${HARITA_TAB:-${MYACT_TAB:-0}}" = "1" ]; then
    xdg-open "$URL" >/dev/null 2>&1 &
    return
  fi
  if command -v google-chrome >/dev/null 2>&1; then
    google-chrome --app="$URL" --class=Harita --name=Harita \
      --window-size=1440,900 >/dev/null 2>&1 &
  elif command -v brave-browser >/dev/null 2>&1; then
    brave-browser --app="$URL" --class=Harita >/dev/null 2>&1 &
  elif command -v chromium >/dev/null 2>&1; then
    chromium --app="$URL" --class=Harita >/dev/null 2>&1 &
  else
    xdg-open "$URL" >/dev/null 2>&1 &
  fi
}

if curl -fsS --max-time 2 "$URL/api/health" >/dev/null 2>&1; then
  open_dashboard
  exit 0
fi

cd "$DIR" || exit 1
nohup python3 "$DIR/server.py" >>"$LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS --max-time 1 "$URL/api/health" >/dev/null 2>&1; then
    open_dashboard
    exit 0
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server gagal berjalan. Cek log: $LOG" >&2
    command -v notify-send >/dev/null 2>&1 && notify-send "Harita gagal dijalankan" "Buka $LOG untuk detail."
    exit 1
  fi
  sleep 0.25
done

echo "Server tidak merespons di $URL setelah 15 detik. Cek log: $LOG" >&2
exit 1
