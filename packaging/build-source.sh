#!/usr/bin/env sh
# Buat source archive dari git HEAD — tidak mengunggah apa pun.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

command -v git >/dev/null 2>&1 || { echo "ERROR: git tidak ditemukan." >&2; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERROR: bukan git work tree." >&2; exit 1; }

VERSION=$(sed -n 's/^__version__ = "\([^"]*\)".*$/\1/p' server.py | head -1)
[ -n "$VERSION" ] || { echo "ERROR: versi tidak ditemukan." >&2; exit 1; }

OUT_DIR="$ROOT/dist"
OUT="$OUT_DIR/myact-$VERSION-source.zip"
mkdir -p "$OUT_DIR"

echo "==> git archive HEAD -> $OUT"
git archive --format=zip --prefix="myact-$VERSION/" -o "$OUT" HEAD

(cd "$OUT_DIR" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256")
echo "OK — $OUT"
echo "SHA256: $OUT.sha256"
