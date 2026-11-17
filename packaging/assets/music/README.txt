MyAct — placeholder folder musik
=================================

Folder ini dibundel ke dalam aplikasi sebagai `music/` supaya server
menemukan direktori yang dibutuhkan saat pertama kali berjalan.

Taruh file audio pribadi di folder `music/` pada repositori (bukan di sini)
untuk build dari source. File audio TIDAK ikut dibundel oleh spec PyInstaller
karena ukurannya bisa besar dan bersifat milik pengguna.

Catatan: pada build one-file, folder ini berada di direktori ekstraksi
sementara. Lihat ../../README.md untuk batasan terkait musik di versi paket.

MyAct — music placeholder
=========================

Bundled as `music/` so the server finds the directory it expects at startup.
Personal audio files belong in the repository's `music/` folder, not here.
Audio is deliberately not collected by the PyInstaller spec.
