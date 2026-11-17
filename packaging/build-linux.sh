#!/usr/bin/env sh
# Harita — build distribusi Linux: PyInstaller one-file + AppImage opsional.
# POSIX shell, jalankan dari mana saja: sh packaging/build-linux.sh
set -eu

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$ROOT"

PYTHON=${PYTHON:-python3}

command -v "$PYTHON" >/dev/null 2>&1 \
  || die "Python 3 tidak ditemukan. Install dulu, atau set PYTHON=/path/ke/python3"

"$PYTHON" -m PyInstaller --version >/dev/null 2>&1 \
  || die "PyInstaller belum terpasang. Jalankan: $PYTHON -m pip install --user pyinstaller"

say "==> Harita: build Linux one-file (PyInstaller)"
rm -rf "$ROOT/build" "$ROOT/dist"
"$PYTHON" -m PyInstaller --clean --noconfirm packaging/harita.spec

BIN="$ROOT/dist/Harita"
[ -x "$BIN" ] || die "Build selesai tanpa dist/Harita yang bisa dieksekusi."

VERSION=$(sed -n 's/^__version__ = "\([^"]*\)".*$/\1/p' server.py | head -1)
APP_NAME="harita-${VERSION}-linux-${ARCH_NAME:-$(uname -m)}.AppImage"
say ""
say "OK — binary: $BIN"
say "Jalankan: $BIN"
say "Lalu buka: http://127.0.0.1:8777"

# --- AppImage opsional -------------------------------------------------------
APPIMAGETOOL_BIN=${APPIMAGETOOL:-appimagetool}
if command -v "$APPIMAGETOOL_BIN" >/dev/null 2>&1; then
  say ""
  say "==> appimagetool ditemukan — membuat AppImage"

  APPDIR="$ROOT/dist/Harita.AppDir"
  ARCH_NAME=$(uname -m)
  APP_NAME="harita-${VERSION:-$(sed -n 's/^__version__ = "\([^"]*\)".*$/\1/p' server.py | head -1)}-linux-${ARCH_NAME}.AppImage"
  rm -rf "$APPDIR"
  mkdir -p "$APPDIR/usr/bin" \
           "$APPDIR/usr/share/applications" \
           "$APPDIR/usr/share/icons/hicolor/512x512/apps"

  cp "$BIN" "$APPDIR/usr/bin/Harita"
  chmod +x "$APPDIR/usr/bin/Harita"

  if [ -f "$ROOT/static/icon.png" ]; then
    cp "$ROOT/static/icon.png" "$APPDIR/usr/share/icons/hicolor/512x512/apps/harita.png"
    cp "$ROOT/static/icon.png" "$APPDIR/harita.png"
    cp "$ROOT/static/icon.png" "$APPDIR/.DirIcon"
  fi

  cat > "$APPDIR/AppRun" <<'APPRUN'
#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$HERE/usr/bin/Harita" "$@"
APPRUN
  chmod +x "$APPDIR/AppRun"

  cat > "$APPDIR/harita.desktop" <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Harita
Comment=Dashboard harian lokal: tugas, fokus, kebiasaan, cuaca
Exec=Harita
Icon=harita
Categories=Utility;Office;
Terminal=false
DESKTOP
  cp "$APPDIR/harita.desktop" "$APPDIR/usr/share/applications/harita.desktop"

  APPIMAGETOOL_FLAGS=""
  case "$APPIMAGETOOL_BIN" in *.AppImage|*.appimage|*/*) case "$APPIMAGETOOL_BIN" in *.AppImage|*.appimage) APPIMAGETOOL_FLAGS=--appimage-extract-and-run;; esac;; esac
  if ARCH="$ARCH_NAME" "$APPIMAGETOOL_BIN" $APPIMAGETOOL_FLAGS "$APPDIR" "$ROOT/dist/$APP_NAME"; then
    say "OK — AppImage: $ROOT/dist/$APP_NAME"
    rm -rf "$APPDIR"
  else
    say "PERINGATAN: appimagetool gagal; binary dist/Harita tetap bisa dipakai."
  fi
else
  say ""
  say "Info: appimagetool tidak ditemukan — langkah AppImage dilewati."
  say "      Pasang appimagetool lalu jalankan ulang skrip ini bila ingin .AppImage."
  say "      Atau set APPIMAGETOOL=/path/ke/appimagetool dan jalankan lagi."
fi

# --- RPM opsional ----------------------------------------------------------
if command -v rpmbuild >/dev/null 2>&1; then
  say ""
  say "==> rpmbuild ditemukan — membuat RPM"
  sh packaging/build-rpm.sh
else
  say ""
  say "Info: rpmbuild tidak ditemukan — langkah RPM dilewati."
fi

say ""
say "Selesai. Isi dist/:"
ls -1 "$ROOT/dist" 2>/dev/null || true
