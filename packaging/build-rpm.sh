#!/usr/bin/env sh
# Build an RPM from an already-built PyInstaller one-file binary at dist/Harita.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v rpmbuild >/dev/null 2>&1 || die "rpmbuild tidak ditemukan. Install paket rpm-build."
[ -x "dist/Harita" ] || die "Binary dist/Harita tidak ditemukan. Jalankan packaging/build-linux.sh dulu."

VERSION=$(sed -n 's/^__version__ = "\([^"]*\)".*$/\1/p' server.py | head -1)
[ -n "$VERSION" ] || die "Versi tidak ditemukan di server.py"
ARCH=$(uname -m)
case "$ARCH" in x86_64|aarch64|i386) ;; *) die "Arsitektur tidak didukung: $ARCH";; esac

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
PKGDIR="$WORK/harita-$VERSION"
mkdir -p "$PKGDIR"
mkdir -p "$PKGDIR/dist"
cp dist/Harita "$PKGDIR/dist/Harita"
cp -a README.md LICENSE CHANGELOG.md static packaging "$PKGDIR/" 2>/dev/null || true
tar -C "$WORK" -czf "$WORK/harita-$VERSION.tar.gz" "harita-$VERSION"

RPMBUILD_DIR="$ROOT/dist/rpmbuild"
mkdir -p "$RPMBUILD_DIR"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
cp "$WORK/harita-$VERSION.tar.gz" "$RPMBUILD_DIR/SOURCES/"
cp packaging/rpm/harita.spec "$RPMBUILD_DIR/SPECS/"

rpmbuild -bb "$RPMBUILD_DIR/SPECS/harita.spec" \
  --define "_topdir $RPMBUILD_DIR" \
  --define "harita_version $VERSION" \
  --target "$ARCH"

OUT=$(find "$RPMBUILD_DIR/RPMS/$ARCH" -maxdepth 1 -type f -name "harita-$VERSION-*.rpm" | head -1)
[ -n "$OUT" ] || die "RPM hasil build tidak ditemukan"
cp "$OUT" "$ROOT/dist/harita-$VERSION-linux-$ARCH.rpm"
say "OK — RPM: $ROOT/dist/harita-$VERSION-linux-$ARCH.rpm"
