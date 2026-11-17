#!/usr/bin/env sh
# Build a Debian/Ubuntu .deb from an already-built PyInstaller binary at dist/Harita.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v dpkg-deb >/dev/null 2>&1 || die "dpkg-deb tidak ditemukan. Install paket dpkg-dev."
[ -x "dist/Harita" ] || die "Binary dist/Harita tidak ditemukan. Jalankan packaging/build-linux.sh dulu."

VERSION=$(sed -n 's/^__version__ = "\([^"]*\)".*$/\1/p' server.py | head -1)
[ -n "$VERSION" ] || die "Versi tidak ditemukan di server.py"
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) DEB_ARCH=amd64 ;;
  aarch64) DEB_ARCH=arm64 ;;
  i386|i686) DEB_ARCH=i386 ;;
  *) die "Arsitektur tidak didukung: $ARCH";;
esac

PKG="harita_${VERSION}_${DEB_ARCH}"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
ROOTDIR="$WORK/$PKG"
mkdir -p "$ROOTDIR/DEBIAN" \
         "$ROOTDIR/opt/harita" \
         "$ROOTDIR/usr/bin" \
         "$ROOTDIR/usr/share/applications" \
         "$ROOTDIR/usr/share/icons/hicolor/512x512/apps" \
         "$ROOTDIR/usr/share/doc/harita" \
         "$ROOTDIR/usr/share/doc/harita/copyright"

install -m 0755 dist/Harita "$ROOTDIR/opt/harita/Harita"
ln -sf ../opt/harita/Harita "$ROOTDIR/usr/bin/harita"
install -m 0644 packaging/deb/harita.desktop "$ROOTDIR/usr/share/applications/harita.desktop"
install -m 0644 static/icon.png "$ROOTDIR/usr/share/icons/hicolor/512x512/apps/harita.png"
install -m 0644 LICENSE "$ROOTDIR/usr/share/doc/harita/copyright/LICENSE"
install -m 0644 packaging/deb/copyright "$ROOTDIR/usr/share/doc/harita/copyright/copyright"
install -m 0644 README.md CHANGELOG.md "$ROOTDIR/usr/share/doc/harita/"
cp packaging/deb/control "$ROOTDIR/DEBIAN/control"
sed -i "s/__VERSION__/$VERSION/g; s/__ARCH__/$DEB_ARCH/g" "$ROOTDIR/DEBIAN/control"
install -m 0755 packaging/deb/postinst "$ROOTDIR/DEBIAN/postinst"
install -m 0755 packaging/deb/prerm "$ROOTDIR/DEBIAN/prerm"
chmod -R go-w "$ROOTDIR/opt/harita"

dpkg-deb --build --root-owner-group "$ROOTDIR" "dist/harita-${VERSION}-linux-${ARCH}.deb"
say "OK — DEB: $ROOT/dist/harita-${VERSION}-linux-${ARCH}.deb"
