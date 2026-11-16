#!/bin/bash
set -e

# MyAct uninstaller — removes shortcuts, keeps your data.

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

read -r -p "Benar-benar hapus MyAct shortcuts? Data di data/ TIDAK dihapus. [y/N] " response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Batal."
    exit 0
fi

rm -f "${XDG_DATA_HOME:-$HOME/.local/share}/applications/myact.desktop"
rm -f "${XDG_CONFIG_HOME:-$HOME/.config}/autostart/myact.desktop"

echo "Shortcuts dihapus. Data kamu masih aman di: $APP_DIR/data/"
echo "Untuk hapus total (kehilangan data!), jalankan: rm -rf $APP_DIR/data"
