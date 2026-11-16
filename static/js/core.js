/* ============================================================
   Core: helpers, state, API, modal, toast
   ============================================================ */
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const CATEGORY_LABEL = { lomba: 'Lomba', sekolah: 'Sekolah', tugas: 'Tugas', pribadi: 'Pribadi', ujian: 'Ujian', lain: 'Lainnya' };
const PRIORITY_LABEL = { 1: 'Penting', 2: 'Normal', 3: 'Santai' };
const COLOR_LABEL = { teal: 'Teal', blue: 'Biru', purple: 'Ungu', amber: 'Amber', rose: 'Merah muda' };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pad2 = (n) => String(n).padStart(2, '0');

/* ---------- Tanggal & waktu (timezone lokal pengguna) ---------- */
function localNow() { return new Date(); }
function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function localTimeParts() {
  const d = new Date();
  return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), day: d.getDay() };
}
function hhmmNow() { const t = localTimeParts(); return `${pad2(t.h)}:${pad2(t.m)}`; }
function parseYMD(str) { const [y, m, d] = String(str).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function addDays(str, n) { const d = parseYMD(str); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dayOfWeek(str) { return parseYMD(str).getUTCDay(); }
function monthKey(str) { return String(str).slice(0, 7); }
function fmtLong(str) {
  const d = parseYMD(str);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function fmtMedium(str) {
  const d = parseYMD(str);
  return `${DAYS_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function fmtShort(str) {
  const d = parseYMD(str);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}
function fmtMonth(year, month) { return `${MONTHS[month]} ${year}`; }
function relDayLabel(str) {
  if (str === todayStr()) return 'Hari ini';
  if (str === todayStr(1)) return 'Besok';
  if (str === todayStr(-1)) return 'Kemarin';
  return DAYS[dayOfWeek(str)];
}
function parseLocalDT(value) {
  if (!value) return NaN;
  const v = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T23:59:59`).getTime();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return new Date(`${v}:00`).getTime();
  if (/^\+/.test(v.slice(-6)) || /Z$/.test(v)) return Date.parse(v);
  return new Date(v).getTime();
}
function fmtDeadline(value) {
  const v = String(value || '');
  if (!v) return '—';
  const day = v.slice(0, 10);
  const time = v.length > 10 ? v.slice(11, 16) : '';
  return `${fmtMedium(day)}${time ? ` · ${time}` : ''}`;
}
function greeting() {
  const h = localTimeParts().h;
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}
function timeAgo(iso) {
  if (!iso) return '';
  const then = Date.parse(iso);
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}
function countdownParts(value) {
  const target = parseLocalDT(value);
  if (!Number.isFinite(target)) return { past: false, invalid: true, days: 0, hours: 0, mins: 0, secs: 0 };
  const diff = target - Date.now();
  const past = diff < 0;
  const abs = Math.abs(diff);
  return {
    past, invalid: false,
    days: Math.floor(abs / 86400000),
    hours: Math.floor((abs % 86400000) / 3600000),
    mins: Math.floor((abs % 3600000) / 60000),
    secs: Math.floor((abs % 60000) / 1000),
  };
}
function countdownShort(value) {
  const c = countdownParts(value);
  if (c.invalid) return '—';
  if (c.past) return 'Lewat';
  if (c.days > 0) return `${c.days} hari ${c.hours} jam`;
  if (c.hours > 0) return `${c.hours} jam ${c.mins} menit`;
  return `${c.mins} menit ${c.secs} detik`;
}

/* ---------- state ---------- */
const state = {
  view: 'beranda',
  today: todayStr(),
  booted: false,
  settings: {},
  locations: {},
  weather: { key: 'jakarta', data: null, stale: false, fetchedAt: null, loading: false, error: null },
  tasks: { date: todayStr(), tasks: [], templates: [], loading: false },
  todayTasks: { date: todayStr(), tasks: [], templates: [] },
  taskDate: todayStr(),
  taskFilter: 'all',
  events: [],
  competitions: [],
  notes: [],
  schedule: [],
  scheduleDay: dayOfWeek(todayStr()),
  focus: { sessions: [], total_minutes: 0 },
  noteQuery: '',
  cal: { year: +todayStr().slice(0, 4), month: +todayStr().slice(5, 7) - 1, selected: todayStr() },
  mini: { year: +todayStr().slice(0, 4), month: +todayStr().slice(5, 7) - 1 },
};

const storage = {
  get(key, fallback) { try { const v = localStorage.getItem(`myact:${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`myact:${key}`, JSON.stringify(value)); } catch { /* ignore */ } },
  remove(key) { try { localStorage.removeItem(`myact:${key}`); } catch { /* ignore */ } },
};

/* ---------- API ---------- */
async function api(path, options = {}) {
  const config = { headers: {}, ...options };
  if (config.body !== undefined && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
    config.headers['Content-Type'] = 'application/json';
  }
  const pinToken = storage.get('pin_token', '');
  if (pinToken) config.headers['X-Pin-Token'] = pinToken;
  const res = await fetch(path, config);
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (res.status === 401 && data && data.code === 'locked') {
    showLockScreen();
    throw new Error('Aplikasi terkunci');
  }
  if (!res.ok) throw new Error((data && data.error) || `Permintaan gagal (${res.status})`);
  return data;
}

/* ---------- toast ---------- */
function toast(message, type = 'ok', timeout = 3200) {
  const wrap = $('#toastWrap');
  if (!wrap) return;
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : ''}`;
  node.innerHTML = `${ico(type === 'error' ? 'alert' : 'check-circle')}<span>${esc(message)}</span>`;
  wrap.appendChild(node);
  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 220);
  }, timeout);
}

/* ---------- app lock (PIN) ---------- */
function showLockScreen() {
  const overlay = $('#lockOverlay');
  if (overlay) { overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false'); setTimeout(() => $('#lockPin').focus(), 40); }
}
function hideLockScreen() {
  const overlay = $('#lockOverlay');
  if (overlay) { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }
}
async function unlockWithPin(pin) {
  const err = $('#lockError');
  err.classList.remove('show');
  try {
    const d = await api('/api/unlock', { method: 'POST', body: { pin } });
    if (d.ok) { storage.set('pin_token', d.token || 'ok'); hideLockScreen(); toast('Aplikasi dibuka'); return true; }
    return false;
  } catch (e) {
    err.textContent = e.message;
    err.classList.add('show');
    return false;
  }
}

/* ---------- undo toast (F1/B5) ---------- */
function toastUndo(message, onUndo, timeout = 6000) {
  const wrap = $('#toastWrap');
  if (!wrap) return;
  const node = document.createElement('div');
  node.className = 'toast undo';
  const label = esc(message);
  node.innerHTML = `${ico('info')}<span>${label}</span><button class="toast-undo-btn" type="button">Undo</button>`;
  wrap.appendChild(node);
  const timer = setTimeout(() => node.remove(), timeout);
  node.querySelector('.toast-undo-btn').addEventListener('click', () => {
    clearTimeout(timer);
    node.remove();
    Promise.resolve(onUndo()).catch(() => toast('Gagal mengembalikan', 'error'));
  });
}

/* ---------- sound & notifications ---------- */
function beep(times = 2) {
  if (state.settings.sound !== '1') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i % 2 === 0 ? 880 : 1174;
      gain.gain.value = 0.0001;
      osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.28;
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.start(t); osc.stop(t + 0.26);
    }
    setTimeout(() => ctx.close(), 1400);
  } catch { /* ignore */ }
}

function notify(title, body) {
  if (state.settings.notifications !== '1') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: '/icon.svg', tag: `myact-${title}` }); } catch { /* ignore */ }
}

async function requestNotifications() {
  if (!('Notification' in window)) { toast('Browser ini tidak mendukung notifikasi', 'error'); return false; }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') { toast('Notifikasi diblokir browser. Izinkan dari pengaturan situs.', 'error'); return false; }
  try { const p = await Notification.requestPermission(); return p === 'granted'; } catch { return false; }
}

/* ---------- modal ---------- */
let modalState = { onSubmit: null, onDelete: null };

function openModal(opts) {
  const {
    title, eyebrow = 'MyAct', body = '', submitLabel = 'Simpan', onSubmit = null,
    onDelete = null, deleteLabel = 'Hapus', wide = false, hideSubmit = false, danger = false,
  } = opts;
  const overlay = $('#modalOverlay');
  overlay.hidden = false;
  $('.modal').classList.toggle('wide', !!wide);
  $('#modalEyebrow').textContent = eyebrow;
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = `<form id="modalForm" novalidate>${body}<div class="form-error" id="modalError"></div></form>`;
  $('#modalFoot').innerHTML = `
    ${onDelete ? `<button class="btn btn-danger-ghost" type="button" id="modalDelete">${ico('trash')} ${deleteLabel}</button>` : ''}
    <span style="flex:1"></span>
    <button class="btn btn-ghost" type="button" id="modalCancel">Batal</button>
    ${hideSubmit ? '' : `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="submit" form="modalForm" id="modalSubmit">${submitLabel}</button>`}
  `;
  modalState = { onSubmit, onDelete };
  const close = () => closeModal();
  $('#modalCancel').addEventListener('click', close);
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  overlay.hidden = false;
  const delBtn = $('#modalDelete');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const fn = modalState.onDelete;
      if (!fn) return;
      closeModal();
      await fn();
    });
  }
  const form = $('#modalForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!modalState.onSubmit) return;
    const errorBox = $('#modalError');
    const submitBtn = $('#modalSubmit');
    errorBox.classList.remove('show');
    if (submitBtn) { submitBtn.disabled = true; }
    try {
      await modalState.onSubmit(form);
      closeModal();
    } catch (err) {
      errorBox.textContent = err.message || 'Terjadi kesalahan';
      errorBox.classList.add('show');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
  setTimeout(() => {
    const first = $('#modalForm input:not([type=hidden]), #modalForm textarea, #modalForm select');
    if (first) first.focus();
  }, 60);
}

function closeModal() {
  $('#modalOverlay').hidden = true;
  $('#modalBody').innerHTML = '';
  $('#modalFoot').innerHTML = '';
  modalState = { onSubmit: null, onDelete: null };
}

function confirmDialog({ title = 'Konfirmasi', message, confirmLabel = 'Ya, lanjutkan', danger = true, onConfirm }) {
  openModal({
    title,
    eyebrow: 'Konfirmasi',
    body: `<p class="confirm-text">${message}</p>`,
    submitLabel: confirmLabel,
    danger,
    onSubmit: async () => { await onConfirm(); },
  });
}

function formValue(form, name) {
  const node = form.elements[name];
  if (!node) return '';
  if (node.type === 'checkbox') return node.checked;
  return node.value.trim();
}

function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach((node) => {
    if (node.dataset.hydrated === '1') return;
    node.innerHTML = iconSvg(node.dataset.icon);
    node.dataset.hydrated = '1';
  });
}

/* enter key submit for quick inputs */
function onEnter(input, handler) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handler(e); }
  });
}
