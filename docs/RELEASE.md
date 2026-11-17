# Rilis Harita

Dokumen ini adalah checklist untuk mempersiapkan dan menerbitkan rilis.
Menerbitkan release adalah tindakan manual — jangan upload apa pun sebelum
semua langkah di bawah hijau dan kamu memang memutuskan untuk publish.

## Status target: v1.5.0

Versi harus konsisten di:

- `server.py` → `__version__`
- `static/sw.js` → `CACHE`
- `static/js/main.js` → `APP_VERSION`
- `CHANGELOG.md` → entri paling baru

Cek otomatis:

```bash
python3 packaging/release-check.sh
```

Script ini menjalankan syntax check, unit test recurrence, smoke + stress,
asset budget, dan konsistensi versi. Script tidak mengunggah atau mem-publish
apa pun.

## Checklist pra-rilis

- [ ] Working tree bersih: `git status --short` kosong.
- [ ] Tidak ada `data/`, `*.db`, backup, log, `node_modules/`, atau `build/`/`dist/` yang ter-track.
- [ ] `LICENSE`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md` ada dan akurat.
- [ ] `.gitignore` dan `.gitattributes` benar.
- [ ] Semua environment variable terdokumentasi di `README.md` (`HARITA_PORT`, `HARITA_DATA`, `HARITA_DB`, `HARITA_TZ`, `HARITA_MUSIC`, `HARITA_NO_OPEN`).
- [ ] Tidak ada kredensial/token di history atau tree.
- [ ] Screenshot utama di `docs/screenshots/` masih mewakili UI saat ini.
- [ ] `docs/RELEASE.md` dan `CHANGELOG.md` diperbarui untuk rilis ini.

## Verifikasi otomatis

```bash
python3 -m py_compile server.py
for f in static/js/*.js static/sw.js; do node --check "$f"; done
node tests/js/recurrence.test.js
python3 tests/smoke.py --stress
npm install && npm run test:e2e
```

CI menjalankan langkah yang sama (kecuali `npm` hanya untuk job E2E).

## Membuat source archive

```bash
sh packaging/build-source.sh
```

Hasil: `dist/harita-<versi>-source.zip` + file `.sha256`. Archive dibuat dari
node `git archive HEAD`, jadi harus dijalankan setelah commit yang akan dirilis.

Isi archive: source + docs + LICENSE + static assets.
Tidak ada: `data/`, `music/`, backup, cache, atau node tooling.

## Paket biner (opsional)

Paket PyInstaller one-file dibuat per-OS, tidak bisa cross-compile:

```bash
sh packaging/build-linux.sh      # Linux (+ AppImage jika appimagetool ada)
packaging\build-windows.bat      # Windows
sh packaging/build-macos.sh      # macOS
```

Setelah build, jalankan binary hasil build dan periksa:

1. `curl -fsS http://127.0.0.1:8777/` mengembalikan HTML, bukan 404.
2. Buat satu tugas, tutup aplikasi, buka lagi — data harus tetap ada.
3. Lokasi data default frozen build:
   - Linux: `${XDG_DATA_HOME:-~/.local/share}/harita/`
   - macOS: `~/Library/Application Support/Harita/`
   - Windows: `%LOCALAPPDATA%\Harita\`
4. Atur `HARITA_DATA` untuk redirect data jika perlu.
5. `HARITA_NO_OPEN=1` mematikan auto-open browser pada frozen build.

Frozen build **belum ditandatangani**. Windows SmartScreen dan macOS Gatekeeper
mungkin memperingatkan pengguna. Untuk rilis publik yang serius perlu code
signing/notarization.

## Menerbitkan release (manual)

Setelah semua hijau, baru putuskan:

1. Buat tag: `git tag -a v1.5.0 -m "Harita v1.5.0"`
2. Push code + tag: `git push origin master --tags` (atau `main`)
3. Buat GitHub Release dari tag tersebut
4. Upload asset manual atau lewat `gh release create v1.5.0 dist/harita-*.zip`
5. Tempel isi `CHANGELOG.md` ke release notes

Jangan otomatiskan langkah 1–4 sebelum kamu benar-benar ingin mem-publish.
