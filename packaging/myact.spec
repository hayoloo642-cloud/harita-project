# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for MyAct (one-file build).

Build from the repository root:
    python -m PyInstaller --clean --noconfirm packaging/myact.spec

The bundle contains:
  - server.py              (entry point)
  - static/                (HTML, CSS, JS, fonts, icons)
  - music/                 (placeholder folder; user audio is not bundled)
  - LICENSE

server.py resolves its asset paths from ``__file__``. Under a PyInstaller
one-file build that path points inside the temporary extraction directory,
so the data files below are found at runtime. Data the app writes (SQLite,
backups) also lands in that temporary directory unless MYACT_DATA is set.
See packaging/README.md before shipping a build.
"""

import os

ROOT = os.path.abspath(os.path.join(SPECPATH, os.pardir))
STATIC_DIR = os.path.join(ROOT, "static")
LICENSE_PATH = os.path.join(ROOT, "LICENSE")
MUSIC_PLACEHOLDER = os.path.join(SPECPATH, "assets", "music")
ENTRY_POINT = os.path.join(ROOT, "server.py")

for required in (ENTRY_POINT, STATIC_DIR):
    if not os.path.exists(required):
        raise SystemExit(
            "MyAct spec: file tidak ditemukan / missing required path: %s\n"
            "Jalankan PyInstaller dari root repositori." % required
        )

datas = [(STATIC_DIR, "static")]

if os.path.isfile(LICENSE_PATH):
    datas.append((LICENSE_PATH, "."))
else:
    print("MyAct spec: WARNING — LICENSE tidak ditemukan, dilewati.")

# The repository's music/ folder is intentionally not bundled (audio can be
# large and is user-owned). A placeholder keeps the runtime folder present.
if os.path.isdir(MUSIC_PLACEHOLDER):
    datas.append((MUSIC_PLACEHOLDER, "music"))
else:
    print("MyAct spec: WARNING — packaging/assets/music tidak ditemukan.")

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
    name="MyAct",
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
