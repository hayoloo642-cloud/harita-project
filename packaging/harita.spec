# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for Harita (one-file build).

Build from the repository root:
    python -m PyInstaller --clean --noconfirm packaging/harita.spec

The bundle contains:
  - server.py              (entry point)
  - static/                (HTML, CSS, JS, fonts, icons)
  - LICENSE

server.py resolves ``static/`` via ``sys._MEIPASS`` under a PyInstaller
one-file build, so the data files below are found at runtime. Frozen builds write SQLite and
backups to a persistent per-user directory by default (see packaging/README.md);
set HARITA_DATA to override.
"""

import os

ROOT = os.path.abspath(os.path.join(SPECPATH, os.pardir))
STATIC_DIR = os.path.join(ROOT, "static")
LICENSE_PATH = os.path.join(ROOT, "LICENSE")
ENTRY_POINT = os.path.join(ROOT, "server.py")

for required in (ENTRY_POINT, STATIC_DIR):
    if not os.path.exists(required):
        raise SystemExit(
            "Harita spec: file tidak ditemukan / missing required path: %s\n"
            "Jalankan PyInstaller dari root repositori." % required
        )

datas = [(STATIC_DIR, "static")]

if os.path.isfile(LICENSE_PATH):
    datas.append((LICENSE_PATH, "."))
else:
    print("Harita spec: WARNING — LICENSE tidak ditemukan, dilewati.")

# The repository's music/ folder is intentionally not bundled (audio can be
# large and is user-owned). Frozen builds use a persistent per-user music
# directory instead: <user data>/music, or HARITA_MUSIC when set.
a = Analysis(
    [ENTRY_POINT],
    pathex=[ROOT],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Harita",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
