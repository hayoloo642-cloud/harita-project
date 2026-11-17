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

say ""
say "OK — binary: $BIN"
say "Jalankan: $BIN"
say "Lalu buka: http://127.0.0.1:8777"

# --- AppImage opsional -------------------------------------------------------
if command -v appimagetool >/dev/null 2>&1; then
  say ""
  say "==> appimagetool ditemukan — membuat AppImage"

  APPDIR="$ROOT/dist/Harita.AppDir"
  ARCH_NAME=$(uname -m)
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
Terminal=true
DESKTOP
  cp "$APPDIR/harita.desktop" "$APPDIR/usr/share/applications/harita.desktop"

  if ARCH="$ARCH_NAME" appimagetool "$APPDIR" "$ROOT/dist/Harita-$ARCH_NAME.AppImage"; then
    say "OK — AppImage: $ROOT/dist/Harita-$ARCH_NAME.AppImage"
    rm -rf "$APPDIR"
  else
    say "PERINGATAN: appimagetool gagal; binary dist/Harita tetap bisa dipakai."
  fi
else
  say ""
  say "Info: appimagetool tidak ditemukan — langkah AppImage dilewati."
  say "      Pasang appimagetool lalu jalankan ulang skrip ini bila ingin .AppImage."
  say "      (Skrip TIDAK mengunduh apa pun dari internet.)"
fi

say ""
say "Selesai. Isi dist/:"
ls -1 "$ROOT/dist" 2>/dev/null || true
