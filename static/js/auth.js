/* ============================================================
   Harita — gerbang akun lokal (splash + daftar/masuk)
   Gate dipanggil di awal init() di main.js. Jika belum
   terdaftar -> mode daftar; jika sudah -> mode masuk.
   ============================================================ */
const haritaAuth = (() => {
  const $id = (id) => document.getElementById(id);
  let mode = 'register';
  let wired = false;

  function setMode(next, preferredName) {
    mode = next;
    const isRegister = mode === 'register';
    $id('authEyebrow').textContent = isRegister ? 'Selamat datang' : 'Selamat datang kembali';
    $id('authTitle').textContent = isRegister ? 'Buat akun Harita' : 'Masuk ke Harita';
    $id('authSub').textContent = isRegister
      ? 'Daftar sekali saja — namamu dan kata sandimu tersimpan hanya di perangkat ini.'
      : 'Masukkan nama dan kata sandi yang kamu buat saat pertama kali.';
    $id('authConfirmWrap').hidden = !isRegister;
    $id('authPassword').autocomplete = isRegister ? 'new-password' : 'current-password';
    $id('authSubmit').textContent = isRegister ? 'Daftar dan masuk' : 'Masuk';
    $id('authToggle').textContent = isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar';
    $id('authError').hidden = true;
    $id('authError').textContent = '';
    if (preferredName) $id('authName').value = preferredName;
  }

  function showError(message) {
    const node = $id('authError');
    node.textContent = message;
    node.hidden = false;
  }

  async function submitForm(event) {
    event.preventDefault();
    const name = $id('authName').value.trim();
    const password = $id('authPassword').value;
    const confirm = $id('authConfirm').value;
    const submit = $id('authSubmit');
    $id('authError').hidden = true;

    if (!name) return showError('Nama wajib diisi.');
    if (!password) return showError('Kata sandi wajib diisi.');
    if (mode === 'register') {
      if (password.length < 6) return showError('Kata sandi minimal 6 karakter.');
      if (password !== confirm) return showError('Konfirmasi kata sandi tidak cocok.');
    }

    submit.disabled = true;
    try {
      const res = await fetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, password, confirm } : { name, password }),
      });
      let data = {};
      try { data = await res.json(); } catch (_) { /* kosong */ }
      if (!res.ok) {
        showError(data.error || 'Gagal masuk. Coba lagi.');
        return;
      }
      // reload agar seluruh aplikasi boot bersih dengan sesi baru
      window.location.reload();
    } catch (err) {
      showError('Tidak dapat terhubung ke server Harita.');
    } finally {
      submit.disabled = false;
    }
  }

  function wire() {
    if (wired) return;
    wired = true;
    $id('authForm').addEventListener('submit', submitForm);
    $id('authToggle').addEventListener('click', () => {
      setMode(mode === 'register' ? 'login' : 'register', $id('authName').value.trim());
    });
  }

  function showOverlay(status) {
    wire();
    setMode(status && status.registered ? 'login' : 'register', status && status.name ? status.name : '');
    const overlay = $id('authOverlay');
    if (overlay) {
      overlay.hidden = false;
      if (typeof hydrateIcons === 'function') hydrateIcons(overlay);
      setTimeout(() => {
        const first = $id('authName');
        if (first) first.focus();
      }, 60);
    }
    const splash = document.getElementById('splash');
    if (splash) { splash.hidden = true; splash.style.display = 'none'; }
  }

  async function gate() {
    let status = null;
    try {
      const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
      status = await res.json();
    } catch (_) {
      return true; // server tidak terjangkau — biarkan init() menampilkan error koneksi
    }
    if (status && status.authenticated) return true;
    showOverlay(status);
    return false;
  }

  return { gate };
})();

window.haritaAuthGate = haritaAuth.gate;
