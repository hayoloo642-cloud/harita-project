#!/usr/bin/env sh
# MyAct release readiness check — local, no upload, no publish.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

say() { printf '%s\n' "$*"; }
ok() { printf '  ok   %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

PYTHON=${PYTHON:-python3}
NODE=${NODE:-node}

say "==> checking tracked files for release mistakes"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files | grep -E '(^|/)(data/|node_modules/|build/|dist/|.*\.db$|.*\.(log|tmp|bak)$)'; then
    die "file data/build/backup ter-track; keluarkan dari git sebelum rilis"
  fi
  ok "no tracked data/build artifacts"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    say "  warn  working tree kotor — build source archive memakai HEAD"
  fi
else
  say "  warn  bukan git work tree — cek tracked files dilewati"
fi

say "==> syntax checks"
"$PYTHON" -m py_compile server.py
for f in static/js/*.js static/sw.js; do
  "$NODE" --check "$f" >/dev/null
done
"$NODE" --check tests/e2e/app.spec.js >/dev/null
ok "python/js syntax"

say "==> unit tests"
"$NODE" tests/js/recurrence.test.js >/dev/null
ok "recurrence"

say "==> smoke + stress"
"$PYTHON" tests/smoke.py --stress >/tmp/myact-release-smoke.log
tail -n 2 /tmp/myact-release-smoke.log

say "==> asset budget (< 700 KB uncompressed)"
total=$(find static -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.woff2' \) -printf '%s\n' | awk '{s+=$1} END {print s}')
say "  static assets: $((total/1024)) KB"
[ "$total" -lt 716800 ] || die "asset budget exceeded"
ok "asset budget"

say "==> version consistency"
PY_VERSION=$(sed -n 's/^__version__ = "\([^"]*\)".*$/\1/p' server.py | head -1)
APP_VERSION=$(sed -n "s/^const APP_VERSION = '\([^']*\)';.*$/\1/p" static/js/main.js | head -1)
SW_CACHE=$(sed -n "s/^const CACHE = 'myact-v\([0-9][0-9]*\)';.*$/\1/p" static/sw.js | head -1)
CHANGELOG_TOP=$(sed -n 's/^## \[\([^]]*\)\].*$/\1/p' CHANGELOG.md | head -1)
[ -n "$PY_VERSION" ] || die "server.__version__ tidak ditemukan"
[ "$APP_VERSION" = "$PY_VERSION" ] || die "APP_VERSION ($APP_VERSION) != server ($PY_VERSION)"
[ "$CHANGELOG_TOP" = "$PY_VERSION" ] || die "CHANGELOG top ($CHANGELOG_TOP) != server ($PY_VERSION)"
[ -n "$SW_CACHE" ] || die "SW cache tidak ditemukan"
ok "server=$PY_VERSION app=$APP_VERSION changelog=$CHANGELOG_TOP sw_cache=myact-v$SW_CACHE"

say ""
say "MyAct $PY_VERSION siap secara lokal untuk release. Belum ada yang di-publish."
