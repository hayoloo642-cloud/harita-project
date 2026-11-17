# Changelog

Semua perubahan penting pada proyek ini didokumentasikan di sini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/).

## [1.5.0] — 2026-11-17

### Diubah
- **Rebrand MyAct → Harita** di UI, dokumen, manifest PWA, service worker, dan binary/paket distribusi
- Variabel environment utama menjadi `HARITA_*`; `MYACT_*` lama tetap didukung untuk kompatibilitas
- Database default menjadi `harita.db`; `data/myact.db` lama dimigrasikan otomatis bila memungkinkan
- Frozen build memakai folder data `Harita`/`harita`; folder data MyAct lama dimigrasikan otomatis bila memungkinkan
- localStorage memakai prefix `harita:`; preferensi `myact:` lama dimigrasikan otomatis
- Referensi repo GitHub menjadi `hayoloo642-cloud/harita-project`

### Ditambahkan (Tahap 1–2)
- Onboarding berbasis tujuan belajar (belajar/ujian, lomba, kebiasaan, uang, atau campuran)
- Beranda mode sederhana dan mode lengkap — kartu sekunder bisa disembunyikan
- Global search via Ctrl/Cmd+K yang mencari tugas, agenda, catatan, uang, flashcard, lomba, dan kebiasaan
- Inbox cepat untuk menangkap tugas/catatan/agenda/pengeluaran tanpa pindah halaman (tombol + atau Ctrl+Alt+K)
- Review malam setelah pukul 17.00
- Target mingguan satu hal besar
- Template rutin belajar: ujian, KTI, membaca harian, dan fokus
- Empty state tugas lebih berguna dengan CTA langsung
- PWA: manifest lengkap (shortcuts, screenshots, categories), pengalaman install di Pengaturan, fallback instruksi iOS/Android
- `docs/demo.gif` untuk landing/README

### Diubah
- Beranda lebih ringkas secara default; detail lengkap bisa ditampilkan lewat tombol mode
- Weather API tidak lagi memblok boot/refresh aplikasi

### Kompatibilitas
- PIN hash lama tetap valid; salt sengaja tidak diubah
- Backup JSON lama (metadata `app: "MyAct"`) tetap bisa diimpor
- Instalasi dari source tetap memakai folder `data/`
- `HARITA_*` adalah nama variabel lingkungan utama; `MYACT_*` lama masih didukung

## [1.4.0] — 2026-11-17

### Ditambahkan
- **Pencatatan pengeluaran** — halaman Pengeluaran dengan total bulanan, rata-rata harian, rincian per kategori, pencarian, dan filter bulan
- **Anggaran bulanan** di Pengaturan → Uang, lengkap dengan bilah progres dan peringatan saat mendekati/melewati anggaran
- 8 kategori (makan, transport, belajar, hiburan, kesehatan, belanja, tagihan, lainnya) dan 5 metode bayar (tunai, QRIS, transfer, kartu, lainnya)
- CRUD API `/api/expenses` + `/api/expenses/<id>`, soft-delete + Undo, dan dukungan restore
- Pengeluaran ikut dalam ekspor/impor backup JSON dan pembersihan data
- Data contoh kini menyertakan beberapa pengeluaran
- Perintah “Catat pengeluaran…” di command palette dan pencarian isi pengeluaran
- Smoke test mencakup CRUD pengeluaran, filter bulan, soft-delete/restore, anggaran, dan ekspor; E2E baru untuk alur pengeluaran
- Terjemahan Indonesia/Inggris untuk label halaman, kategori, metode bayar, dan pengaturan anggaran

### Keamanan & kesiapan rilis
- Header keamanan di API/static/music: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- Origin/Referer cross-origin kini dibandingkan persis (skema, host, port) — bukan `startswith` lagi
- Path traversal static/music ditolak dengan boundary `realpath` + prefix `root/`
- Frozen build (PyInstaller) menyimpan data di folder user persisten (Linux/macOS/Windows), musik memakai `HARITA_MUSIC`, dan membuka browser otomatis (`HARITA_NO_OPEN=1` untuk mematikan)
- `HARITA_PORT` divalidasi; smoke test menambah cek header keamanan, Origin palsu, dan traversal
- `docs/RELEASE.md`, `packaging/release-check.sh`, `packaging/build-source.sh`, dan `.gitattributes` untuk proses rilis yang dapat diulang

### Catatan
- Nominal disimpan sebagai bilangan bulat rupiah; batas wajar 1 triliun per transaksi.
- Tombol hapus di baris pengeluaran langsung membuka dialog konfirmasi (dengan Undo setelahnya).

## [1.3.0] — 2026-11-17

### Ditambahkan
- **Impor backup JSON** dari file yang sudah diunduh (Pengaturan → Data), dengan pratinjau jumlah baris per tabel dan pilihan tabel yang diganti
- i18n tahap 2: nama hari/bulan, label tanggal relatif, sapaan, “time ago”, header kalender, serta label dan tombol modal kini mengikuti bahasa Inggris
- **Pratinjau sebelum restore** backup internal — nama file, waktu ekspor, dan jumlah baris tiap tabel ditampilkan sebelum konfirmasi
- **Snapshot otomatis** (`export-<timestamp>-before-import.json`) sebelum setiap impor/restore, terpisah dari backup harian
- Validasi payload impor: struktur `tables`, tipe baris, batas 25 MB, dan penolakan file yang tidak dikenali
- Impor tidak pernah membawa `lock_pin_hash`/`lock_enabled` — PIN tetap milik perangkat
- `tests/js/recurrence.test.js` — unit test clamp akhir bulan agenda berulang
- Smoke test mencakup sub-tugas, reorder, agenda berulang, pin/sembunyi sidebar, bahasa, preview/impor backup
- E2E baru: aksi massal + Undo, drag & drop, banner database korup, dan chrome bahasa Inggris

### Catatan
- Restore/impor bersifat *replace per tabel terpilih*, bukan merge. Snapshot otomatis tersedia untuk membatalkan.

## [1.2.0] — 2026-11-17

### Ditambahkan
- Antarmuka bilingual Indonesia/Inggris (chrome, navigasi, halaman, Pengaturan) — ganti di Pengaturan → Bahasa
- Sub-tugas (checklist kecil) di dalam satu tugas + chip progres `2/3`
- Aksi massal: pilih beberapa tugas → selesaikan, pindah tanggal, hapus (dengan Undo)
- Drag & drop untuk mengurutkan tugas (kolom `position` + `/api/tasks/reorder`)
- Agenda kalender berulang mingguan/bulanan, pencarian agenda
- Pencarian di view Lomba, Nilai, dan Kalender
- Sematkan halaman favorit + sembunyikan item sidebar yang jarang dipakai
- Edit judul catatan inline (klik dua kali)
- Pemulihan database korup: banner, unduh file rusak, restore backup JSON terbaru (pengaturan & PIN dipertahankan)
- Shortcut `Ctrl/Cmd + Enter` (centang tugas fokus) dan `Ctrl/Cmd + D` (hapus tugas fokus)
- Undo untuk centang satu tugas; hierarki warna CTA per view; tag prioritas ramah buta warna (ikon + bentuk); dukungan `prefers-reduced-transparency`
- Playwright E2E (`tests/e2e/`), landing page offline (`docs/landing/`), skrip paket (`packaging/`)

### Diperbaiki
- Urutan tugas kini menghormati posisi manual sebelum jam mulai/prioritas
- Import backup tidak menimpa pengaturan tema, bahasa, atau PIN

## [1.1.0] — 2026-11-17

### Ditambahkan
- Splash screen dengan logo Harita dan tagline
- Pengaturan lengkap: tema (gelap/terang/sistem), 8 aksen warna, ukuran teks, kontras tinggi, halaman awal, sidebar ciut
- Data contoh sekali klik (onboarding & Pengaturan) — dataset kecil siap jelajah
- Tombol Beranda di topbar + shortcut `Alt + H` dan `Ctrl/Cmd + N` untuk tugas baru
- Indikator "Menyimpan…/Tersimpan" pada setiap perubahan
- Pencarian tugas, "Selesaikan semua" dengan Undo, edit judul tugas inline
- Badge pencapaian streak (3/7/30/100 hari) dan grafik tren fokus 7 hari di Beranda
- Loading skeleton untuk tugas, catatan, jadwal, nilai, flashcard, dan lomba
- Laporan diagnostik sekali klik (dari layar error maupun Pengaturan)
- Tombol "Bersihkan cache file" untuk memaksa muat ulang aset
- `tests/smoke.py` — uji API + mode `--stress` (300 tugas, 200 kartu)

### Diperbaiki
- `/api/reset` kini benar-benar menghapus semua data (fungsi sebelumnya belum terdaftar)
- Aksen warna kini mewarnai seluruh permukaan bertinta, bukan hanya beberapa tombol
- Pengaturan ukuran teks benar-benar mengubah ukuran teks isi
- Modal dan Pengaturan tidak terpotong pada layar pendek
- `api()` gagal dengan pesan jelas setelah 15 detik, bukan menggantung
- `localStorage` yang rusak tidak lagi membuat aplikasi gagal saat boot

## [1.0.0] — 2026-11-17

### Ditambahkan
- Dashboard harian lokal: tugas harian dengan reset otomatis, kalender, cuaca realtime (Open-Meteo, tanpa API key), lomba/deadline dengan countdown, pomodoro fokus + statistik per mapel, flashcard SM-2, nilai & KKM, multi-habit streak, music player lokal, device monitor
- Tema gelap & terang — sekarang ikut prefers-color-scheme pada fresh install
- Command palette (Ctrl/Cmd + K) — navigasi + pencarian isi
- Keyboard shortcuts (Ctrl/Cmd + / untuk bantuan)
- Soft-delete + Undo untuk tugas, agenda, catatan, lomba, kebiasaan, nilai
- Backup otomatis harian ke `data/backups/` + `~/harita-backups/`
- Notifikasi deadline (dengan fallback toast jika izin browser tidak diberikan)
- Import/export `.ics`, export CSV nilai
- PWA: installable, service worker network-first
- PIN lock (opsional, di Pengaturan)
- Onboarding wizard untuk pengguna baru
- Dokumentasi lengkap: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG
- CI (lint + smoke test) via GitHub Actions
- Installer Linux/macOS (`install.sh`), uninstaller (`uninstall.sh`)

### Perubahan ibarat rilis publik pertama
- Nama aplikasi: **Harita** — sebelumnya hanya didistribusikan di komputer pribadi
- Default name: "Kamu", bukan nama pemilik asli
- Cuaca: 16 kota Indonesia sebagai default (Jakarta default)
- Timezone: ikut sistem, bukan lagi hardcoded WITA
