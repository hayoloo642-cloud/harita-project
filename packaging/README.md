# Packaging Harita

Skrip di folder ini membuat distribusi **one-file** Harita dengan
[PyInstaller](https://pyinstaller.org/). Tidak ada binary yang disimpan di
repositori — build dilakukan di mesin masing-masing.

> Repositori ini tetap source-first: pengguna cukup `git clone` + `./run.sh`.
> Paket ini opsional untuk membagikan aplikasi ke orang yang tidak ingin
> memasang Python.

## Isi folder

| File | Fungsi |
|------|--------|
| `harita.spec` | Spec PyInstaller one-file: `server.py` + `static/` + `LICENSE` |
| `build-linux.sh` | Build Linux binary, lalu AppImage jika `appimagetool` tersedia, DEB jika `dpkg-deb` tersedia, dan RPM jika `rpmbuild` tersedia |
| `build-deb.sh` | Membungkus binary `dist/Harita` menjadi paket DEB |
| `deb/control`, `deb/postinst`, `deb/prerm`, `deb/harita.desktop` | Metadata Debian package |
| `build-rpm.sh` | Membungkus binary `dist/Harita` menjadi paket RPM |
| `rpm/harita.spec` | Spec RPM: `/opt/harita`, symlink `/usr/bin/harita`, desktop entry, ikon |
| `build-windows.bat` | Build Windows portable → `dist\Harita.exe` |
| `windows/build-installer.ps1` | Membuat installer Inno Setup → `dist\Harita-Setup-<versi>.exe` |
| `windows/installer.iss` | Definisi installer Inno Setup (Desktop shortcut, Start Menu, uninstall) |
| `build-macos.sh` | Build macOS, lalu `.app` + `.dmg` jika `hdiutil` tersedia |
| `assets/music/README.txt` | Placeholder agar folder `music/` ikut terbundel |

Semua skrip `cd` ke root repositori sendiri, sehingga aman dijalankan dari
folder mana pun.

## Prasyarat

- Python 3.10 atau lebih baru (sesuai `README.md` utama).
- PyInstaller:

  ```bash
  python3 -m pip install --user pyinstaller
  # Windows: python -m pip install --user pyinstaller
  ```

- Opsional: `appimagetool` (Linux), `hdiutil` (macOS, biasanya sudah ada),
  `codesign` (macOS).
- Build **tidak bisa cross-compile**: paket Windows dibuat di Windows, paket
  macOS dibuat di macOS, paket Linux dibuat di Linux.

## Cara build

### Linux

```bash
sh packaging/build-linux.sh
```

Hasil:

- `dist/Harita` — binary one-file.
- `dist/harita-<versi>-linux-<arch>.AppImage` — jika `appimagetool` ada di `PATH` atau diset lewat `APPIMAGETOOL`.
- `dist/harita-<versi>-linux-<arch>.deb` — jika `dpkg-deb` tersedia.
- `dist/harita-<versi>-linux-<arch>.rpm` — jika `rpmbuild` tersedia.

### Windows

```bat
packaging\build-windows.bat
```

Hasil: `dist\Harita.exe`.

Untuk installer Windows juga:

```powershell
.\packaging\windows\build-installer.ps1
```

Hasil: `dist\Harita-Setup-<versi>.exe` (perlu Inno Setup; di CI dipasang otomatis).

### macOS

```bash
sh packaging/build-macos.sh
```

Hasil:

- `dist/Harita` — binary one-file.
- `dist/Harita.app` dan `dist/Harita.dmg` — hanya jika `hdiutil` tersedia.
- `.app` di sini adalah pembungkus sederhana; belum ada notarization.

Menjalankan binary:

```bash
./dist/Harita
```

Binary akan membuka `http://127.0.0.1:8777` di browser secara otomatis.
Set `HARITA_NO_OPEN=1` untuk menonaktifkan auto-open, atau
`HARITA_PORT=8780 ./dist/Harita` untuk port lain.

## Yang ikut dibundel

`harita.spec` memasukkan data berikut ke dalam executable:

| Sumber | Tujuan di bundle | Alasan |
|--------|------------------|--------|
| `static/` (rekursif) | `static/` | HTML, CSS, JS, font, ikon, manifest, service worker |
| `LICENSE` | `./LICENSE` | Kepatuhan lisensi MIT |

Audio pengguna di `music/` **tidak** ikut dibundel. Ini disengaja agar ukuran
paket tetap kecil dan file pribadi tidak ikut tersebar. Pada frozen build,
`MUSIC_DIR` default ke `<data user>/music`, atau `HARITA_MUSIC` bila diset.

## Verifikasi wajib setelah build

Jalankan binary hasil build, lalu periksa:

1. **Aset statis termuat.** Buka `http://127.0.0.1:8777` — halaman tidak boleh
   kosong atau 404. Uji juga `http://127.0.0.1:8777/app.css` dan
   `http://127.0.0.1:8777/icon.png`.
   `server.py` memakai `sys._MEIPASS` untuk menemukan `static/` pada frozen
   build, sehingga seharusnya cocok. **Jika aset 404, jangan ubah `server.py`
   secara diam-diam** — catat sebagai bug packaging dan sesuaikan `datas` di
   `harita.spec`.
2. **Data tersimpan permanen.** Lihat bagian "Batasan" di bawah. Uji dengan
   membuat satu tugas, menutup aplikasi, lalu membukanya lagi.
3. **Cuaca realtime** tampil (butuh internet; endpoint Open-Meteo).
4. **Port bentrok** ditangani: jalankan dua instance, instance kedua harus
   memberi pesan error yang jelas.
5. **Tidak ada error impor** di konsol saat startup (mis. `psutil` opsional).

Cek cepat dari terminal:

```bash
curl -fsS http://127.0.0.1:8777/ | head -n 5
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8777/app.css
```

## Batasan dan catatan penting

- **Data frozen build tersimpan permanen per-user** dengan default:
  - Linux: `${XDG_DATA_HOME:-~/.local/share}/harita/`
  - macOS: `~/Library/Application Support/Harita/`
  - Windows: `%LOCALAPPDATA%\Harita\`

  Override dengan `HARITA_DATA`, atau gunakan `HARITA_DB` bila ingin menaruh
  database terpisah. Instalasi dari source tetap memakai folder `data/` di
  repo.
- **Musik** memakai `MUSIC_DIR`: default `music/` di repo untuk source, atau
  `<data user>/music` untuk frozen build. Override dengan `HARITA_MUSIC`.
  Musik pengguna tidak ikut dibundel — salin file audio ke lokasi tersebut.
- **Bukan build bertanda tangan.** Windows SmartScreen dan macOS Gatekeeper
  akan memperingatkan pengguna. Untuk distribusi publik perlu code signing,
  notarization, dan (Windows) installer seperti Inno Setup.
- **Antivirus false positive** umum pada PyInstaller one-file. Alternatifnya
  gunakan mode `onedir` (ubah spec: tambahkan `COLLECT`).
- **Ukuran dan startup.** One-file mengekstrak ke temp setiap kali dijalankan,
  sehingga startup sedikit lebih lambat dan butuh ruang disk sementara.
- **Frozen build membuka browser otomatis.** Set `HARITA_NO_OPEN=1` bila tidak
  ingin membuka browser (mis. saat membuat service atau men-debug).
- **Data contoh, backup, dan SQLite** tetap berjalan seperti versi source,
  dengan data tersimpan di folder data per-user yang bisa ditulis.
- Artefak `build/` dan `dist/` sudah masuk `.gitignore`; jangan commit hasil
  build.

## Membersihkan hasil build

```bash
rm -rf build dist
```

Windows:

```bat
rmdir /s /q build dist
```
