# Roadmap MyAct

Status: **v1.2.0** — fitur inti + kualitas rilis sudah berjalan lokal. Berikut rencana berikutnya.

## Sedang dikerjakan / berikutnya

- [x] **Mode bahasa Inggris** — i18n chrome, navigasi, dan Pengaturan (isi view dinamis menyusul)
- [x] **Urutkan tugas dengan drag & drop** — kolom `position` + migrasi
- [x] **Agenda berulang** — mingguan/bulanan untuk Kalender
- [x] **Sematkan halaman favorit** di sidebar + sembunyikan item jarang
- [x] **Checklist sub-tugas** di dalam satu tugas
- [x] **Aksi massal** di daftar tugas (selesaikan/pindah/hapus + Undo)
- [ ] Terjemahan penuh untuk teks dinamis di semua view (toast, empty state, modal tugas)
- [ ] Fuzz test import/export JSON dan `.ics`

## Kualitas & pengujian

- [x] Smoke test API + stress test (`tests/smoke.py --stress`)
- [x] Performance budget aset di CI (< 700 KB)
- [x] Uji end-to-end browser (Playwright) untuk alur CRUD utama
- [ ] Uji visual lintas browser (Firefox/Safari) otomatis — Safari tidak tersedia di Linux
- [ ] Fuzz test untuk import/export JSON dan `.ics`

## Distribusi

- [x] Skrip paket PyInstaller + AppImage/Windows/macOS (`packaging/`) — belum ada binary rilis
- [x] Halaman landing offline (`docs/landing/`)
- [ ] Panduan upgrade antar versi (migrasi database otomatis sudah ada)

## Ide yang belum dijadwalkan

- Warna aksen kustom (color picker bebas) di samping 8 preset
- Widget jam/waktu belajar di sidebar
- Ekspor laporan mingguan ke PDF
- Sinkronisasi opsional antar perangkat lewat file backup terenkripsi

---

Kalau kamu ingin berkontribusi pada salah satu item, lihat [CONTRIBUTING.md](../CONTRIBUTING.md).
