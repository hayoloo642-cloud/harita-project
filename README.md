# MyAct

**Konsisten & rajin setiap hari.** MyAct adalah dashboard harian lokal untuk produktivitas dan kebiasaan — todo list, kalender, cuaca Indonesia realtime, lomba, pomodoro, flashcard, nilai & KKM, streak harian, dan pemantau device. Jalan sepenuhnya di laptop kamu — tanpa akun, tanpa cloud, tanpa subscription.

![MyAct — Beranda](docs/screenshots/beranda.png)

---

## Fitur

- **Beranda** — ringkasan hari: cuaca, tugas, agenda, kalender mini, countdown lomba, rekap mingguan
- **Cuaca realtime** — Open-Meteo (tanpa API key) untuk 16 kota Indonesia + auto refresh
- **Tugas harian** — checklist otomatis reset tiap hari, bawa tugas belum selesai, prioritas, rutinitas harian/mingguan/bulanan
- **Kalender** — agenda terkategorikan (lomba/sekolah/tugas/ujian), import/export `.ics`
- **Lomba & deadline** — countdown otomatis, checklist persiapan
- **Fokus (Pomodoro)** — 25/5/15/menit kustom, statistik per mata pelajaran, mode fokus layar penuh
- **Flashcard SM-2** — spaced repetition klasik (Anki-style) untuk belajar lebih cepat
- **Nilai & KKM** — catat nilai tiap mapel, pantau ketuntasan, cetak laporan / unduh CSV
- **Streak & kebiasaan** — multi-habit streak dengan heatmap 112 hari
- **Music player lokal** — putar file audio di laptop, progress, volume, now-playing bar
- **Device monitor** — CPU, RAM, disk, baterai, suhu, jaringan realtime
- **Tema & tampilan** — gelap/terang/ikuti sistem, 8 aksen warna, ukuran teks, kontras tinggi, sidebar bisa diciutkan, hormati `prefers-reduced-transparency`
- **Bahasa** — antarmuka Indonesia & Inggris (chrome, navigasi, Pengaturan); ganti di Pengaturan → Bahasa
- **Keyboard first** — `Ctrl/Cmd + K` command palette, `Ctrl/Cmd + N` tugas baru, `Ctrl/Cmd + Enter` centang, `Ctrl/Cmd + D` hapus, `Alt + H` beranda, `Ctrl/Cmd + /` bantuan shortcut
- **Data contoh** — tombol "Isi data contoh" untuk melihat semua fitur tanpa mengotori data asli
- **Tugas lebih cepat** — pencarian per view, selesaikan semua + undo, edit judul inline (tugas & catatan), checklist sub-tugas, aksi massal, drag & drop urutan
- **Kalender fleksibel** — agenda berulang mingguan/bulanan, pencarian agenda, unduh `.ics`
- **Sidebar adaptif** — sematkan halaman favorit, sembunyikan item yang jarang dipakai
- **Arsip & pemulihan** — soft-delete + Undo, backup JSON otomatis, restore database dari backup, deteksi database korup, bersihkan cache file dari Pengaturan
- **Uji & distribusi** — smoke/stress test, Playwright E2E, skrip paket PyInstaller/AppImage/Windows/macOS, landing page offline di `docs/landing/`
- **Privasi penuh** — semua data tersimpan lokal di SQLite; tidak ada akun atau cloud

---

## Instalasi

### Linux / macOS / Windows (dengan Python 3)

```bash
git clone <url-repo-ini>
cd myact
./run.sh      # atau di Windows: double-click run.bat
```

Buka `http://127.0.0.1:8777` di browser (Chrome/Chromium direkomendasikan untuk mode app standalone).

### Atau jalankan manual

```bash
python3 server.py
```

---

## Konfigurasi environment

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `MYACT_PORT` | `8777` | Port HTTP lokal |
| `MYACT_TZ` | timezone sistem | Contoh: `Asia/Jakarta`, `Asia/Makassar` |
| `MYACT_DATA` | `./data` | Folder data (database, music, cache, backup) |
| `MYACT_DB` | `$MYACT_DATA/myact.db` | Lokasi database SQLite |

Contoh:
```bash
MYACT_TZ=Asia/Makassar MYACT_PORT=8780 ./run.sh
```

---

## Roadmap

Lihat [docs/ROADMAP.md](docs/ROADMAP.md) untuk rencana fitur dan status pengujian.

## Struktur

```
myact/
├── server.py              # HTTP server + SQLite (tanpa dependency)
├── static/                # Frontend (HTML + CSS + vanilla JS)
│   ├── index.html
│   ├── app.css
│   ├── js/
│   ├── fonts/             # Bricolage Grotesque & Space Grotesk (OFL)
│   ├── icon.svg           # logo
│   └── manifest.webmanifest
├── data/                  # SQLite + cache cuaca + backups (auto-dibuat)
└── run.sh / stop.sh       # helper start/stop (Linux)
```

---

## Kontribusi

Silakan baca [CONTRIBUTING.md](CONTRIBUTING.md). Issues & PR terbuka.

## Lisensi

MIT — lihat [LICENSE](LICENSE).

## Credit

- Cuaca: [Open-Meteo](https://open-meteo.com) (CC BY 4.0) — gratis, tanpa API key
- Font: Bricolage Grotesque & Space Grotesk (SIL Open Font License)
