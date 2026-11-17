# Changelog

Semua perubahan penting pada proyek ini didokumentasikan di sini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/).

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
- Splash screen dengan logo MyAct dan tagline
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
- Backup otomatis harian ke `data/backups/` + `~/myact-backups/`
- Notifikasi deadline (dengan fallback toast jika izin browser tidak diberikan)
- Import/export `.ics`, export CSV nilai
- PWA: installable, service worker network-first
- PIN lock (opsional, di Pengaturan)
- Onboarding wizard untuk pengguna baru
- Dokumentasi lengkap: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG
- CI (lint + smoke test) via GitHub Actions
- Installer Linux/macOS (`install.sh`), uninstaller (`uninstall.sh`)

### Perubahan ibarat rilis publik pertama
- Nama aplikasi: **MyAct** — sebelumnya hanya didistribusikan di komputer pribadi
- Default name: "Kamu", bukan nama pemilik asli
- Cuaca: 16 kota Indonesia sebagai default (Jakarta default)
- Timezone: ikut sistem, bukan lagi hardcoded WITA
