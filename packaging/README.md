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
| `myact.spec` | Spec PyInstaller one-file: `server.py` + `static/` + placeholder `music/` + `LICENSE` |
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
# lalu buka http://127.0.0.1:8777
```

Port bisa diganti: `MYACT_PORT=8780 ./dist/MyAct`.

## Yang ikut dibundel

`myact.spec` memasukkan data berikut ke dalam executable:

| Sumber | Tujuan di bundle | Alasan |
|--------|------------------|--------|
| `static/` (rekursif) | `static/` | HTML, CSS, JS, font, ikon, manifest, service worker |
| `LICENSE` | `./LICENSE` | Kepatuhan lisensi MIT |
| `packaging/assets/music/` | `music/` | Placeholder folder musik |

Audio pengguna di `music/` **tidak** ikut dibundel. Ini disengaja agar ukuran
paket tetap kecil dan file pribadi tidak ikut tersebar.

## Verifikasi wajib setelah build

Jalankan binary hasil build, lalu periksa:

1. **Aset statis termuat.** Buka `http://127.0.0.1:8777` — halaman tidak boleh
   kosong atau 404. Uji juga `http://127.0.0.1:8777/app.css` dan
   `http://127.0.0.1:8777/icon.png`.
   `server.py` menghitung `STATIC_DIR` dari `os.path.dirname(__file__)`. Pada
   mode one-file, PyInstaller mengekstrak data ke direktori sementara dan
   mengarahkan `__file__` ke sana, sehingga seharusnya cocok. **Jika aset 404,
   jangan ubah `server.py` secara diam-diam** — catat sebagai bug packaging dan
   sesuaikan `datas` di `myact.spec`, atau tambahkan resolusi `sys._MEIPASS`.
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

- **Data one-file bersifat sementara.** `DATA_DIR` default adalah
  `<BASE_DIR>/data`, dan pada mode one-file `BASE_DIR` berada di folder
  ekstraksi sementara yang dihapus saat aplikasi keluar. Selalu set
  `MYACT_DATA` ke folder permanen sebelum distribusi:
  - Linux: `MYACT_DATA="$HOME/.local/share/myact"`
  - macOS: `MYACT_DATA="$HOME/Library/Application Support/MyAct"`
  - Windows: `MYACT_DATA=%LOCALAPPDATA%\MyAct`

  `MYACT_DB` juga bisa dipakai bila ingin menaruh database terpisah.
  Pertimbangkan membungkus binary dengan launcher yang menetapkan variabel ini
  secara otomatis.
- **Musik** memakai `MUSIC_DIR = <BASE_DIR>/music` dan belum punya variabel
  environment sendiri di versi ini. Pada build one-file, folder tersebut ada
  di direktori sementara; fitur musik karena itu terbatas pada placeholder.
  Verifikasi perilakunya sebelum mengklaim fitur musik berfungsi di paket.
- **Bukan build bertanda tangan.** Windows SmartScreen dan macOS Gatekeeper
  akan memperingatkan pengguna. Untuk distribusi publik perlu code signing,
  notarization, dan (Windows) installer seperti Inno Setup.
- **Antivirus false positive** umum pada PyInstaller one-file. Alternatifnya
  gunakan mode `onedir` (ubah spec: tambahkan `COLLECT`).
- **Ukuran dan startup.** One-file mengekstrak ke temp setiap kali dijalankan,
  sehingga startup sedikit lebih lambat dan butuh ruang disk sementara.
- **Tidak ada auto-open browser.** Buka `http://127.0.0.1:8777` manual, atau
  gunakan `run.sh` pada instalasi dari source.
- **Data contoh, backup, dan SQLite** tetap berjalan seperti versi source,
  asalkan `MYACT_DATA` diarahkan ke folder yang bisa ditulis.
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
