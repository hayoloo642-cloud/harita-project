# Roadmap MyAct

Status: **v1.1.0** — semua fitur inti sudah berjalan lokal. Berikut rencana berikutnya,
diurutkan dari yang paling berdampak.

## Sedang dikerjakan / berikutnya

- [ ] **Mode bahasa Inggris** — lapisan i18n untuk chrome + semua view (UI saat ini 100% Indonesia)
- [ ] **Urutkan tugas dengan drag & drop** — butuh kolom `position` + migrasi
- [ ] **Agenda berulang** — mingguan/bulanan untuk Kalender (saat ini hanya tugas yang punya rutinitas)
- [ ] **Sematkan halaman favorit** di sidebar
- [ ] **Checklist sub-tugas** di dalam satu tugas
- [ ] **Aksi massal** di daftar tugas (pilih beberapa → hapus/pindah tanggal)

## Kualitas & pengujian

- [x] Smoke test API + stress test (`tests/smoke.py --stress`)
- [x] Performance budget aset di CI (< 700 KB)
- [ ] Uji end-to-end browser (Playwright) untuk alur CRUD utama
- [ ] Uji visual lintas browser (Firefox/Safari) otomatis
- [ ] Fuzz test untuk import/export JSON dan `.ics`

## Distribusi

- [ ] Paket siap pakai: `.AppImage` (Linux), `.exe` (Windows), `.dmg` (macOS)
- [ ] Halaman landing sederhana + GIF demo
- [ ] Panduan upgrade antar versi (migrasi database otomatis sudah ada)

## Ide yang belum dijadwalkan

- Warna aksen kustom (color picker bebas) di samping 8 preset
- Widget jam/waktu belajar di sidebar
- Ekspor laporan mingguan ke PDF
- Sinkronisasi opsional antar perangkat lewat file backup terenkripsi

---

Kalau kamu ingin berkontribusi pada salah satu item, lihat [CONTRIBUTING.md](../CONTRIBUTING.md).
