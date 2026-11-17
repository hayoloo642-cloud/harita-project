# Laporan bug upstream yang ditemukan saat analisis

Bug-bug ini ditemukan saat mencoba menjalankan Harita v1.6.0 dari rilis resmi.
Silakan laporkan ke tracker upstream: https://github.com/hayoloo642-cloud/harita-project/issues

## 1. Binary resmi upstream crash di CPU generasi lama (Illegal instruction)

**Status:** confirmed pada 2026-11-17
**Build:** `harita-1.6.0-linux-x86_64.deb` / `harita-1.6.0-linux-x86_64.rpm` / AppImage

### Repro
```bash
sudo dpkg -i harita-1.6.0-linux-x86_64.deb   # atau: sudo dnf install harita-1.6.0-linux-x86_64.rpm
/opt/harita/Harita
# => illegal instruction (dengan core dump)
```

### Diagnosis
Embedded Python di dalam binary dikompilasi dengan target ISA yang lebih tinggi dari x86-64-v2.
Pada CPU Celeron N4020 (Gemini Lake, tanpa AVX), `_PyRuntimeState_Init` mengeksekusi `vmovdqu`
dan proses mati dengan SIGILL (exit code 132).

### Implikasi
Binary upstream hanya bisa berjalan di CPU dengan AVX; pengguna laptop lama tidak bisa
menjalankan build binary sama sekali. Workaround: jalankan dari source (`git clone ... && ./run.sh`).

### Usulan perbaikan
Build dengan `-march=x86-64-v2` (dan bukan `-march=native`), atau setidaknya dokumentasikan
persyaratan CPU upstream. Lihat juga `build-linux.sh` di repo ini yang menyetel `-march=x86-64-v2`.

## 2. Symlink /usr/bin/harita mengarah ke path yang salah (di .deb dan .rpm)

**Status:** confirmed pada 2026-11-17

### Temuan
`tar` / `dpkg-deb -c` pada rilis resmi memperlihatkan:

    lrwxrwxrwx root/root 20 ... ./usr/bin/harita -> ../opt/harita/Harita

Dari `/usr/bin`, `../opt/harita/Harita` resolve ke `/usr/opt/harita/Harita`,
bukan `/opt/harita/Harita`. Paket terinstal tetapi `harita` di shell tidak berjalan.

### Fix
Symlink harus absolut `/opt/harita/Harita` atau relatif `../../opt/harita/Harita`.
Build script pada paket Debian/RPM sebaiknya memakai path absolut, dan verifikasi pasca-install
(`harita --version` atau setidaknya `test -x /opt/harita/Harita`).

---

Kedua issue sudah diverifikasi pada Debian package dan RPM resmi v1.6.0.
