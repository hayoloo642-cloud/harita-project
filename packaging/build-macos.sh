#!/usr/bin/env sh
# MyAct — build distribusi macOS: PyInstaller one-file, lalu .app/.dmg opsional.
# Jalankan di macOS: sh packaging/build-macos.sh
set -eu

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$ROOT"

PYTHON=${PYTHON:-python3}

[ "$(uname -s)" = "Darwin" ] \
  || die "Skrip ini harus dijalankan di macOS (PyInstaller tidak bisa cross-compile)."

command -v "$PYTHON" >/dev/null 2>&1 \
  || die "Python 3 tidak ditemukan. Install dari python.org atau via Homebrew."

"$PYTHON" -m PyInstaller --version >/dev/null 2>&1 \
  || die "PyInstaller belum terpasang. Jalankan: $PYTHON -m pip install --user pyinstaller"

say "==> MyAct: build macOS one-file (PyInstaller)"
rm -rf "$ROOT/build" "$ROOT/dist"
"$PYTHON" -m PyInstaller --clean --noconfirm packaging/myact.spec

BIN="$ROOT/dist/MyAct"
[ -x "$BIN" ] || die "Build selesai tanpa dist/MyAct yang bisa dieksekusi."

say ""
say "OK — binary: $BIN"
say "Jalankan: $BIN"
say "Lalu buka: http://127.0.0.1:8777"

# --- .app + .dmg opsional ----------------------------------------------------
# Catatan: .app di bawah hanyalah pembungkus sederhana agar bisa dibuka dari
# Finder. Untuk distribusi serius, gunakan py2app atau codesign + notarization.
if command -v hdiutil >/dev/null 2>&1; then
  say ""
  say "==> hdiutil ditemukan — membuat MyAct.app dan MyAct.dmg"

  APP="$ROOT/dist/MyAct.app"
  rm -rf "$APP"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cp "$BIN" "$APP/Contents/MacOS/MyAct"
  chmod +x "$APP/Contents/MacOS/MyAct"

  cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>MyAct</string>
  <key>CFBundleDisplayName</key>
  <string>MyAct</string>
  <key>CFBundleIdentifier</key>
  <string>local.myact.app</string>
  <key>CFBundleVersion</key>
  <string>1.1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.1.0</string>
  <key>CFBundleExecutable</key>
  <string>MyAct</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

  if command -v codesign >/dev/null 2>&1; then
    # Tanda tangan ad-hoc: cukup untuk mesin sendiri, bukan untuk distribusi.
    if codesign --force --deep --sign - "$APP" >/dev/null 2>&1; then
      say "OK — codesign ad-hoc selesai."
    else
      say "PERINGATAN: codesign ad-hoc gagal; app tetap bisa dicoba secara lokal."
    fi
  fi

  rm -f "$ROOT/dist/MyAct.dmg"
  if hdiutil create -volname "MyAct" -srcfolder "$APP" -ov -format UDZO \
      "$ROOT/dist/MyAct.dmg" >/dev/null; then
    say "OK — DMG: $ROOT/dist/MyAct.dmg"
  else
    say "PERINGATAN: hdiutil gagal membuat DMG; .app dan binary tetap ada."
  fi
else
  say ""
  say "Info: hdiutil tidak ditemukan (bukan macOS?) — .app/.dmg dilewati."
  say "      Binary dist/MyAct tetap bisa dijalankan dari Terminal."
fi

say ""
say "Selesai. Isi dist/:"
ls -1 "$ROOT/dist" 2>/dev/null || true
