# Berkontribusi ke MyAct

Terima kasih sudah mempertimbangkan! MyAct dibangun dengan prinsip: **lokal-first, tanpa cloud, tanpa akun, tanpa dependency JS.** Kalau PR kamu melanggar prinsip itu, kemungkinan besar ditolak.

## Cara mulai

1. Fork repo → clone di lokal
2. Jalankan: `./run.sh` → buka `http://127.0.0.1:8777`
3. Database lokal dibuat otomatis di `data/myact.db` — jangan commit file ini
4. Buat branch fitur: `git checkout -b fitur/nama-fitur`

## Prinsip kode

- **Frontend: vanilla JS, tanpa framework, tanpa build step.** Jangan tambah dependency NPM.
- **Backend: Python stdlib only.** Jangan tambah `requests`, `flask`, `fastapi`, dsb.
- **SQLite untuk persistensi.** Query lewat `db_connect()` helper.
- **Bahasa UI: Bahasa Indonesia.** Komponen baru harus pakai Bahasa Indonesia yang natural.
- **Theme:** gunakan CSS variables (`var(--accent)`, dll.) — jangan hardcode hex di komponen baru.

## Sebelum kirim PR

- [ ] App jalan (`./run.sh`) tanpa error di console
- [ ] Fitur kamu teruji manual (tidak ada test otomatis, tapi harus jalan di dark & light mode)
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
