#!/bin/bash
set -e

# Harita installer — installs local desktop entry + optional auto-start
# Safe to re-run. Does NOT touch your data.

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="Harita"

echo "Installing Harita from: $APP_DIR"
# Remove the pre-rename MyAct desktop shortcut when installing the rebranded app.
rm -f "${XDG_DATA_HOME:-$HOME/.local/share}/applications/myact.desktop" 2>/dev/null || true
rm -f "${XDG_CONFIG_HOME:-$HOME/.config}/autostart/myact.desktop" 2>/dev/null || true

# 1. Check Python 3
if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 tidak ditemukan. Install Python 3 dulu."
    exit 1
fi

# 2. Optional: psutil for device monitor
echo "Installing psutil (untuk device monitor)..."
python3 -m pip install --user psutil 2>/dev/null || echo "(opsional: psutil gagal install, device monitor dinonaktifkan)"

# 3. Create .desktop entry
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$DESKTOP_DIR"
cat > "$DESKTOP_DIR/harita.desktop" <<DEOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
GenericName=Harita — Dashboard Harian
Comment=Konsisten & rajin setiap hari — tugas, kalender, cuaca, lomba, fokus
Exec=$APP_DIR/run.sh
Icon=$APP_DIR/static/icon.png
Terminal=false
Categories=Office;Productivity;
StartupWMClass=$APP_NAME
StartupNotify=true
Keywords=konsisten;rajin;harian;tugas;kalender;fokus;harita;
DEOF

echo "Desktop entry created: $DESKTOP_DIR/harita.desktop"

# 4. Optional: autostart
read -r -p "Auto-start Harita saat login? [y/N] " response
if [[ "$response" =~ ^[Yy]$ ]]; then
    AUTOSTART_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
    mkdir -p "$AUTOSTART_DIR"
    ln -sf "$DESKTOP_DIR/harita.desktop" "$AUTOSTART_DIR/harita.desktop"
    echo "Autostart enabled."
fi

# 5. Make scripts executable
chmod +x "$APP_DIR/run.sh" "$APP_DIR/stop.sh" 2>/dev/null || true

echo "Done. Launch with: $APP_DIR/run.sh"
