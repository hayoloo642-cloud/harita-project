# Kebijakan Keamanan

## Melaporkan kerentanan

**JANGAN buat issue publik untuk kerentanan keamanan.**

Laporkan secara privat lewat GitHub Security Advisories (tab Security → “Report a vulnerability”) atau kontak maintainer yang tercantum di profil repository.

Harap sertakan:
- Deskripsi kerentanan
- Langkah reproduksi
- Dampak yang mungkin terjadi
- Saran perbaikan (jika ada)

Kami akan merespons dalam 72 jam. Setelah perbaikan dirilis, kami akan mengumumkan CVE kalau relevan.

## Lingkup

- Server lokal berjalan di `127.0.0.1` secara default — tidak terekspos ke internet
- PIN lock adalah proteksi kasual, bukan enkripsi data at-rest
- File `data/harita.db` harus dilindungi OS-level permission
- Jangan expose port ke jaringan publik tanpa lapisan auth tambahan (reverse proxy + auth)

## Versi yang didukung

Hanya versi terbaru yang dirilis (rilis terakhir + branch utama) yang mendapat patch keamanan.

## Hardening yang disertakan

- Server bind ke `127.0.0.1`; origin/referer cross-origin ditolak untuk mutasi API
- Security headers: CSP, `nosniff`, `frame-deny`, `no-referrer`
- Import/restore backup dibatasi 25 MB dan memvalidasi struktur sebelum menulis
- PIN lock adalah proteksi kasual, bukan enkripsi data at-rest
