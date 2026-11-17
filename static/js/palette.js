/* ============================================================
   Command Palette (Ctrl/Cmd + K)
   ============================================================ */

function paletteCommands() {
  const cmds = [];
  const views = [
    ['beranda', 'home', 'Beranda', 'Ringkasan hari ini'],
    ['cuaca', 'cloud-sun', 'Cuaca', 'Cuaca realtime'],
    ['tugas', 'check-square', 'Tugas', 'Checklist harian'],
    ['kalender', 'calendar', 'Kalender', 'Agenda & kalender'],
    ['lomba', 'trophy', 'Lomba', 'Deadline & persiapan'],
    ['fokus', 'timer', 'Fokus', 'Pomodoro & fokus'],
    ['catatan', 'note', 'Catatan', 'Ide & materi'],
    ['jadwal', 'book', 'Jadwal', 'Jadwal pelajaran'],
    ['nilai', 'star', 'Nilai', 'Nilai & KKM'],
    ['device', 'gauge', 'Device', 'Performa laptop'],
    ['music', 'play', 'Musik', 'Music player'],
    ['streak', 'flame', 'Streak', 'Streak & kebiasaan'],
    ['pengeluaran', 'wallet', 'Pengeluaran', 'Catatan uang keluar & anggaran'],
    ['flashcard', 'book', 'Flashcard', 'Kartu & SM-2 spaced repetition'],
  ];
  for (const [view, ico, label, hint] of views) {
    cmds.push({ ico, label: `Buka ${label}`, hint, keywords: `${view} ${label} ${hint}`, run: () => setView(view) });
  }
  cmds.push({ ico: 'plus', label: 'Tambah tugas baru…', hint: 'Langsung buka form tugas', keywords: 'tambah tugas baru task', run: () => openTaskModal(null, state.today) });
  cmds.push({ ico: 'note', label: 'Catatan baru…', hint: 'Langsung buka form catatan', keywords: 'catatan baru note', run: () => openNoteModal() });
  cmds.push({ ico: 'wallet', label: 'Catat pengeluaran…', hint: 'Uang keluar bulan ini', keywords: 'pengeluaran uang belanja expense budget', run: () => { setView('pengeluaran'); openExpenseModal(); } });
  cmds.push({ ico: 'trophy', label: 'Lomba baru…', hint: 'Tambah lomba / proyek', keywords: 'lomba baru deadline project', run: () => openCompModal() });
  cmds.push({ ico: 'calendar', label: 'Agenda baru…', hint: 'Tambah ke kalender', keywords: 'agenda baru jadwal event', run: () => openEventModal(null, state.cal.selected || state.today) });
  cmds.push({ ico: 'moon', label: 'Ganti tema gelap / terang', hint: 'Toggle dark & light', keywords: 'tema gelap terang dark light mode', run: () => toggleTheme() });
  cmds.push({ ico: 'bell', label: 'Aktifkan notifikasi deadline', hint: 'Izinkan notifikasi browser', keywords: 'notifikasi deadline reminder notif', run: () => enableNotifications() });
  cmds.push({ ico: 'timer', label: 'Mode fokus layar penuh', hint: 'Timer 25/5/15 menit tersembunyi', keywords: 'mode fokus fullscreen pomodoro', run: () => openFocusMode() });
  cmds.push({ ico: 'flame', label: 'Tandai kebiasaan hari ini', hint: 'Centang streak hari ini', keywords: 'streak kebiasaan centang hari ini', run: () => { setView('streak'); } });
  cmds.push({ ico: 'book', label: 'Review flashcard jatuh tempo', hint: 'Buka sesi SM-2', keywords: 'flashcard kartu review ulangan sm2 belajar', run: () => { setView('flashcard'); } });
  cmds.push({ ico: 'download', label: 'Export backup JSON', hint: 'Unduh semua data', keywords: 'export backup json unduh', run: () => { window.location.href = '/api/export'; } });
  cmds.push({ ico: 'refresh', label: 'Rescan library musik', hint: 'Cari lagu baru di folder music', keywords: 'rescan musik music scan library', run: () => { setView('music'); const b = $('#musicRescan'); if (b) b.click(); } });
  cmds.push({ ico: 'settings', label: 'Pengaturan', hint: 'Nama, lokasi, suara, notifikasi', keywords: 'pengaturan settings setting', run: () => openSettingsModal() });
  return cmds;
}

let paletteIndex = 0;
let paletteMatches = [];
let globalResults = [];
let globalSearchTimer = null;
let globalSearchToken = 0;

function globalSearch(query, token) {
  return api(`/api/search?q=${encodeURIComponent(query)}`).then((data) => {
    if (token !== globalSearchToken) return;
    globalResults = (data.results || []).map((item) => ({
      ico: ({ task: 'check-square', event: 'calendar', note: 'note', expense: 'wallet', flashcard: 'book', competition: 'trophy', habit: 'flame' }[item.type]) || 'search',
      label: item.label,
      hint: item.hint,
      keywords: `${item.type} ${item.label} ${item.hint}`,
      run: () => setView(item.view),
    }));
    renderPaletteList(query);
  }).catch(() => {
    if (token !== globalSearchToken) return;
    globalResults = [];
    renderPaletteList(query);
  });
}

function scheduleGlobalSearch(query) {
  clearTimeout(globalSearchTimer);
  const q = String(query || '').trim();
  globalSearchToken += 1;
  const token = globalSearchToken;
  if (q.length < 2) { globalResults = []; return; }
  globalSearchTimer = setTimeout(() => globalSearch(q, token), 220);
}

function paletteOpen() {
  const overlay = $('#paletteOverlay');
  if (!overlay) return;
  overlay.hidden = false;
  const input = $('#paletteInput');
  input.value = '';
  globalResults = [];
  clearTimeout(globalSearchTimer);
  renderPaletteList('');
  setTimeout(() => input.focus(), 30);
}
function paletteClose() {
  const overlay = $('#paletteOverlay');
  if (overlay) overlay.hidden = true;
}
function contentMatches(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  const add = (ico, label, hint, run) => out.push({ ico, label, hint, run });
  const match = (text) => q.split(/\s+/).every((t) => String(text || '').toLowerCase().includes(t));
  for (const t of (state.todayTasks.tasks || [])) if (match(t.title)) add('check-square', t.title, 'tugas', () => setView('tugas'));
  for (const ev of (state.events || [])) if (match(ev.title)) add('calendar', ev.title, 'agenda', () => setView('kalender'));
  for (const n of (state.notes || [])) if (match(n.title + ' ' + n.body)) add('note', n.title, 'catatan', () => setView('catatan'));
  for (const g of (state.grades.grades || [])) if (match(g.subject + ' ' + g.label)) add('star', `${g.subject} · ${g.label} (${g.score})`, 'nilai', () => setView('nilai'));
  for (const c of (state.flashcards.cards || [])) if (match(c.subject + ' ' + c.front + ' ' + c.back)) add('book', c.front, `flashcard · ${c.subject}`, () => setView('flashcard'));
  for (const c of (state.competitions || [])) if (match(c.title)) add('trophy', c.title, 'lomba', () => setView('lomba'));
  for (const x of (state.expenses || [])) if (match(`${x.note || ''} ${x.category || ''} ${x.amount}`)) add('wallet', x.note || formatRupiah(x.amount), `pengeluaran · ${formatRupiah(x.amount)}`, () => setView('pengeluaran'));
  return out.slice(0, 10);
}

function renderPaletteList(query) {
  const list = $('#paletteList');
  const q = String(query || '').trim().toLowerCase();
  const cmds = paletteCommands();
  const commandMatches = cmds.filter((c) => {
    if (!q) return true;
    const hay = `${c.label} ${c.keywords || ''} ${c.hint || ''}`.toLowerCase();
    return q.split(/\s+/).every((term) => hay.includes(term));
  });
  const localResults = q ? contentMatches(q) : [];
  const remoteResults = q ? globalResults : [];
  const results = [...localResults, ...remoteResults];
  paletteMatches = [...commandMatches, ...results];
  paletteIndex = 0;

  let html = '';
  let idx = 0;
  const renderSection = (title, items) => {
    if (!items.length) return '';
    return `<div class="palette-section">${esc(title)}</div>` + items.map((c) => {
      const i = idx++;
      return `
    <button class="palette-item ${i === 0 ? 'selected' : ''}" role="option" data-idx="${i}">
      <span class="ico">${iconSvg(c.ico)}</span><span>${esc(c.label)}</span>${c.hint ? `<span class="kbd">${esc(c.hint)}</span>` : ''}
    </button>`;
    }).join('');
  };
  if (commandMatches.length) html += renderSection('Perintah', commandMatches);
  if (localResults.length) html += renderSection('Di layar ini', localResults);
  if (remoteResults.length) html += renderSection('Semua data', remoteResults);
  if (results.length) {
    html += `<div class="palette-section">Hasil pencarian</div>`;
    html += results.map((c) => {
      const i = idx++;
      return `
      <button class="palette-item" role="option" data-idx="${i}">
        <span class="ico">${iconSvg(c.ico)}</span><span>${esc(c.label)}</span>${c.hint ? `<span class="kbd">${esc(c.hint)}</span>` : ''}
      </button>`;
    }).join('');
  }
  if (!paletteMatches.length) {
    html = '<div class="palette-empty">Tidak ada hasil.<br>Coba kata kunci lain, atau tekan Ctrl+K lalu ketik perintah.</div>';
  }
  paletteMatches = [...commandMatches, ...results];
  list.innerHTML = html;
}
function paletteMove(delta) {
  if (!paletteMatches.length) return;
  paletteIndex = (paletteIndex + delta + paletteMatches.length) % paletteMatches.length;
  $$('.palette-item').forEach((el, i) => el.classList.toggle('selected', i === paletteIndex));
  const sel = $('.palette-item.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
function paletteRunSelected() {
  const cmd = paletteMatches[paletteIndex];
  if (!cmd) return;
  paletteClose();
  try { cmd.run(); } catch (err) { toast(err.message, 'error'); }
}

function bindPalette() {
  const overlay = $('#paletteOverlay');
  if (!overlay) return;
  $('#paletteInput').addEventListener('input', (e) => {
    scheduleGlobalSearch(e.target.value);
    renderPaletteList(e.target.value);
  });
  $('#paletteInput').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); paletteMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); paletteMove(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); paletteRunSelected(); }
    else if (e.key === 'Escape') { paletteClose(); }
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { paletteClose(); return; }
    const item = e.target.closest('.palette-item');
    if (item) { paletteIndex = Number(item.dataset.idx); paletteRunSelected(); }
  });
  document.addEventListener('keydown', (e) => {
    const isMac = /Mac/i.test(navigator.platform || '');
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      const o = $('#paletteOverlay');
      if (o && o.hidden) paletteOpen(); else paletteClose();
    } else if (e.key === 'Escape' && !$('#modalOverlay').hidden) {
      closeModal();
    } else if (e.key === 'Escape' && $('#focusMode') && $('#focusMode').classList.contains('open')) {
      closeFocusMode();
    }
  });
}
