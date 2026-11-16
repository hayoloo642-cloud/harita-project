# Changelog

Semua perubahan penting pada proyek ini didokumentasikan di sini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/).

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
