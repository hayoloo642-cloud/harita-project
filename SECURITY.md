# Kebijakan Keamanan

## Melaporkan kerentanan

**JANGAN buat issue publik untuk kerentanan keamanan.**

Laporkan secara privat ke maintainer lewat GitHub Security Advisories atau email maintainer.

Harap sertakan:
- Deskripsi kerentanan
- Langkah reproduksi
- Dampak yang mungkin terjadi
- Saran perbaikan (jika ada)

Kami akan merespons dalam 72 jam. Setelah perbaikan dirilis, kami akan mengumumkan CVE kalau relevan.

## Lingkup

- Server lokal berjalan di `127.0.0.1` secara default — tidak terekspos ke internet
- PIN lock adalah proteksi kasual, bukan enkripsi data at-rest
- File `data/myact.db` harus dilindungi OS-level permission
- Jangan expose port ke jaringan publik tanpa lapisan auth tambahan (reverse proxy + auth)

## Versi yang didukung

Hanya versi terbaru (`main` branch) yang mendapat patch keamanan.
