# Berkontribusi ke Harita

Terima kasih sudah mempertimbangkan! Harita dibangun dengan prinsip: **lokal-first, tanpa cloud, tanpa akun, tanpa dependency JS.** Kalau PR kamu melanggar prinsip itu, kemungkinan besar ditolak.

## Cara mulai

1. Fork repo → clone di lokal
2. Jalankan: `./run.sh` → buka `http://127.0.0.1:8777`
3. Database lokal dibuat otomatis di `data/harita.db` — jangan commit file ini (Python 3.10+ direkomendasikan)
4. Buat branch fitur: `git checkout -b fitur/nama-fitur`

## Prinsip kode

- **Frontend: vanilla JS, tanpa framework, tanpa build step.** Jangan tambah dependency NPM.
- **Backend: Python stdlib only.** Jangan tambah `requests`, `flask`, `fastapi`, dsb.
- **SQLite untuk persistensi.** Query lewat `db_connect()` helper.
- **Bahasa UI: Indonesia & Inggris.** Default Indonesia; teks baru tambahkan juga kunci `id`/`en` di `static/js/i18n.js`.
- **Theme:** gunakan CSS variables (`var(--accent)`, dll.) — jangan hardcode hex di komponen baru.

## Sebelum kirim PR

- [ ] App jalan (`./run.sh`) tanpa error di console
- [ ] Jalankan `python3 tests/smoke.py --stress` dan `node tests/js/recurrence.test.js`
- [ ] Fitur kamu teruji manual di dark & light mode (dan, bila relevan, E2E)
- [ ] Tidak ada secrets/kredensial/token di commit
- [ ] File berikut TIDAK di-commit: `data/`, `backups/`, `*.log`, `__pycache__/`, `docs/screenshots/*` (kecuali diminta)

## Lapor bug

Gunakan template di GitHub Issues:
- OS & browser
- Langkah reproduksi
- Screenshot/console error
- Apakah data kamu terpengaruh (jalankan `./stop.sh` lalu backup `data/` sebelum eksperimen)

## Lisensi kontribusi

Dengan mengirim PR, kamu setuju kontribusi di-lisensikan sebagai MIT.
