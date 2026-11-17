# Packaging MyAct

Skrip di folder ini membuat distribusi **one-file** MyAct dengan
[PyInstaller](https://pyinstaller.org/). Tidak ada binary yang disimpan di
repositori — build dilakukan di mesin masing-masing.

> Repositori ini tetap source-first: pengguna cukup `git clone` + `./run.sh`.
> Paket ini opsional untuk membagikan aplikasi ke orang yang tidak ingin
> memasang Python.

## Isi folder

| File | Fungsi |
|------|--------|
| `myact.spec` | Spec PyInstaller one-file: `server.py` + `static/` + `LICENSE` |
| `build-linux.sh` | Build Linux, lalu AppImage jika `appimagetool` tersedia |
| `build-windows.bat` | Build Windows → `dist\MyAct.exe` |
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

- `dist/MyAct` — binary one-file.
- `dist/MyAct-<arch>.AppImage` — hanya jika `appimagetool` ada di `PATH`.

### Windows

```bat
packaging\build-windows.bat
```

Hasil: `dist\MyAct.exe`.

### macOS

```bash
sh packaging/build-macos.sh
```

Hasil:

- `dist/MyAct` — binary one-file.
- `dist/MyAct.app` dan `dist/MyAct.dmg` — hanya jika `hdiutil` tersedia.
- `.app` di sini adalah pembungkus sederhana; belum ada notarization.

Menjalankan binary:

```bash
./dist/MyAct
```

Binary akan membuka `http://127.0.0.1:8777` di browser secara otomatis.
Set `MYACT_NO_OPEN=1` untuk menonaktifkan auto-open, atau
`MYACT_PORT=8780 ./dist/MyAct` untuk port lain.

## Yang ikut dibundel

`myact.spec` memasukkan data berikut ke dalam executable:

| Sumber | Tujuan di bundle | Alasan |
|--------|------------------|--------|
| `static/` (rekursif) | `static/` | HTML, CSS, JS, font, ikon, manifest, service worker |
| `LICENSE` | `./LICENSE` | Kepatuhan lisensi MIT |

Audio pengguna di `music/` **tidak** ikut dibundel. Ini disengaja agar ukuran
paket tetap kecil dan file pribadi tidak ikut tersebar. Pada frozen build,
`MUSIC_DIR` default ke `<data user>/music`, atau `MYACT_MUSIC` bila diset.

## Verifikasi wajib setelah build

Jalankan binary hasil build, lalu periksa:

1. **Aset statis termuat.** Buka `http://127.0.0.1:8777` — halaman tidak boleh
   kosong atau 404. Uji juga `http://127.0.0.1:8777/app.css` dan
   `http://127.0.0.1:8777/icon.png`.
   `server.py` memakai `sys._MEIPASS` untuk menemukan `static/` pada frozen
   build, sehingga seharusnya cocok. **Jika aset 404, jangan ubah `server.py`
   secara diam-diam** — catat sebagai bug packaging dan sesuaikan `datas` di
   `myact.spec`.
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
  - Linux: `${XDG_DATA_HOME:-~/.local/share}/myact/`
  - macOS: `~/Library/Application Support/MyAct/`
  - Windows: `%LOCALAPPDATA%\MyAct\`

  Override dengan `MYACT_DATA`, atau gunakan `MYACT_DB` bila ingin menaruh
  database terpisah. Instalasi dari source tetap memakai folder `data/` di
  repo.
- **Musik** memakai `MUSIC_DIR`: default `music/` di repo untuk source, atau
  `<data user>/music` untuk frozen build. Override dengan `MYACT_MUSIC`.
  Musik pengguna tidak ikut dibundel — salin file audio ke lokasi tersebut.
- **Bukan build bertanda tangan.** Windows SmartScreen dan macOS Gatekeeper
  akan memperingatkan pengguna. Untuk distribusi publik perlu code signing,
  notarization, dan (Windows) installer seperti Inno Setup.
- **Antivirus false positive** umum pada PyInstaller one-file. Alternatifnya
  gunakan mode `onedir` (ubah spec: tambahkan `COLLECT`).
- **Ukuran dan startup.** One-file mengekstrak ke temp setiap kali dijalankan,
  sehingga startup sedikit lebih lambat dan butuh ruang disk sementara.
- **Frozen build membuka browser otomatis.** Set `MYACT_NO_OPEN=1` bila tidak
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
