const APP_VERSION = '1.0.0';
/* ============================================================
   App bootstrap, navigation, realtime tick, settings
   ============================================================ */
function safeViewRender(view, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`Render ${view} gagal:`, err);
    showCrashOverlay(`Kegagalan di halaman ${view}: ${err && err.message ? err.message : err}`);
  }
}

function setView(view) {
  if (!PAGE_META[view]) view = 'beranda';
  const prev = state.view;
  state.view = view;
  if (prev === 'device') stopDevicePoll();
  if (window.location.hash !== `#/${view}`) history.replaceState(null, '', `#/${view}`);
  $$('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${view}`));
  renderChrome();
  if (view === 'beranda') safeViewRender(view, renderDashboard);
  if (view === 'cuaca') safeViewRender(view, renderWeatherView);
  if (view === 'tugas') safeViewRender(view, renderTasksView);
  if (view === 'kalender') safeViewRender(view, renderCalendarView);
  if (view === 'lomba') safeViewRender(view, renderCompetitionsView);
  if (view === 'fokus') safeViewRender(view, renderFocusView);
  if (view === 'catatan') safeViewRender(view, renderNotesView);
  if (view === 'jadwal') safeViewRender(view, renderScheduleView);
  if (view === 'nilai') safeViewRender(view, () => loadGrades && loadGrades());
  if (view === 'flashcard') safeViewRender(view, () => loadFlashcards && loadFlashcards());
  if (view === 'device') safeViewRender(view, startDevicePoll);
  if (view === 'music') safeViewRender(view, () => { initMusic && initMusic(); loadMusic && loadMusic(); });
  if (view === 'streak') safeViewRender(view, () => { loadStreak && loadStreak(); renderStreakView && renderStreakView(); });
  const mainScroller = document.querySelector('.main');
  if (mainScroller) mainScroller.scrollTo({ top: 0, behavior: 'auto' });
}

function renderAll() {
  renderChrome();
  renderDashboard();
  renderWeatherView();
  renderTasksView();
  renderCalendarView();
  renderCompetitionsView();
  renderNotesView();
  renderScheduleView();
  renderFocusView();
  if (typeof loadGrades === 'function') loadGrades();
  if (typeof loadFlashcards === 'function') loadFlashcards();
}

async function changeWeatherLocation(key) {
  if (!key) return;
  state.settings.location = key;
  api('/api/settings', { method: 'POST', body: { location: key } }).catch(() => {});
  await loadWeather(key);
}

async function refreshApp() {
  const btn = $('#refreshApp');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="ico">' + iconSvg('spinner', 'spin') + '</span><span class="refresh-app-text">Memuat ulang…</span>';
  }
  toast('Menyegarkan aplikasi…');

  // 1. nuke every Cache Storage bucket
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }

  // 2. unregister every service worker so it can't serve stale assets
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* ignore */ }

  // 3. hard navigate with a unique query to bypass the HTTP cache entirely
  const fresh = window.location.pathname + '?_=' + Date.now();
  window.location.replace(fresh);
}

async function refreshAll() {
  try {
    await loadBootstrap();
    await Promise.allSettled([
      loadTasks(state.taskDate, { silent: true }),
      loadEvents(),
      loadCompetitions(),
      loadNotes(),
      loadSchedule(),
      loadFocus(),
      loadWeather(state.weather.key, true),
    ]);
    renderAll();
    toast('Semua data diperbarui');
  } catch (err) {
    toast(err.message, 'error');
  }
}

const ACCENT_SWATCHES = [
  { id: 'terracotta', label: 'Terracotta', color: '#fc8f8f' },
  { id: 'teal',       label: 'Teal',       color: '#67e8f9' },
  { id: 'emerald',    label: 'Emerald',    color: '#6ee7b7' },
  { id: 'amber',      label: 'Amber',      color: '#fcd34d' },
  { id: 'rose',       label: 'Rose',       color: '#fb7185' },
  { id: 'violet',     label: 'Violet',     color: '#c4b5fd' },
  { id: 'sky',        label: 'Sky',        color: '#7dd3fc' },
  { id: 'slate',      label: 'Slate',      color: '#e2e8f0' },
];

function openSettingsModal() {
  const name = esc(state.settings.name || '');
  const locOptions = Object.entries(state.locations).map(([key, locName]) =>
    `<option value="${key}" ${state.settings.location === key ? 'selected' : ''}>${esc(locName)}</option>`).join('');

  const viewOptions = [
    ['beranda', 'Beranda'], ['tugas', 'Tugas'], ['kalender', 'Kalender'],
    ['fokus', 'Fokus'], ['catatan', 'Catatan'], ['jadwal', 'Jadwal'],
    ['nilai', 'Nilai'], ['flashcard', 'Flashcard'], ['lomba', 'Lomba'],
    ['streak', 'Streak'], ['cuaca', 'Cuaca'], ['music', 'Musik'],
  ].map(([v, l]) => `<option value="${v}" ${(state.settings.default_view || 'beranda') === v ? 'selected' : ''}>${esc(l)}</option>`).join('');

  const currentAccent = state.settings.accent || 'terracotta';
  const accentHtml = ACCENT_SWATCHES.map((s) => `
    <button type="button" class="accent-swatch ${currentAccent === s.id ? 'active' : ''}" data-accent="${s.id}" title="${s.label}" aria-label="Aksen ${s.label}" style="background:${s.color}"></button>
  `).join('');

  const body = `
    <div class="settings-scroll">
      <!-- Profil -->
      <p class="eyebrow" style="margin:4px 0 12px">Profil</p>
      <div class="form-grid">
        <div class="field">
          <label>Nama kamu</label>
          <input name="name" maxlength="40" value="${name}" placeholder="Nama panggilan" />
        </div>
        <div class="field">
          <label>Lokasi cuaca utama</label>
          <select name="location">${locOptions}</select>
        </div>
      </div>

      <!-- Tampilan -->
      <p class="eyebrow" style="margin:22px 0 12px">Tampilan</p>

      <div class="field full">
        <label>Tema</label>
        <div class="segmented" role="radiogroup" aria-label="Tema">
          <label class="seg-option ${state.settings.theme === 'dark' ? 'active' : ''}"><input type="radio" name="theme" value="dark" ${state.settings.theme === 'dark' ? 'checked' : ''} /> Gelap</label>
          <label class="seg-option ${state.settings.theme === 'light' ? 'active' : ''}"><input type="radio" name="theme" value="light" ${state.settings.theme === 'light' ? 'checked' : ''} /> Terang</label>
          <label class="seg-option ${(!state.settings.theme || state.settings.theme === 'system') ? 'active' : ''}"><input type="radio" name="theme" value="system" ${(!state.settings.theme || state.settings.theme === 'system') ? 'checked' : ''} /> Sistem</label>
        </div>
      </div>

      <div class="field full">
        <label>Aksen warna</label>
        <div class="accent-grid" role="radiogroup" aria-label="Aksen warna">${accentHtml}</div>
        <span class="help">Tema tetap, aksen berubah untuk tombol, ring, dan highlight.</span>
      </div>

      <div class="field full">
        <label>Ukuran teks</label>
        <div class="segmented" role="radiogroup" aria-label="Ukuran teks">
          <label class="seg-option ${(!state.settings.font_size || state.settings.font_size === 'small') ? 'active' : ''}"><input type="radio" name="font_size" value="small" ${(!state.settings.font_size || state.settings.font_size === 'small') ? 'checked' : ''} /> Kecil</label>
          <label class="seg-option ${(!state.settings.font_size || state.settings.font_size === 'normal') ? 'active' : ''}"><input type="radio" name="font_size" value="normal" ${(!state.settings.font_size || state.settings.font_size === 'normal') ? 'checked' : ''} /> Normal</label>
          <label class="seg-option ${state.settings.font_size === 'large' ? 'active' : ''}"><input type="radio" name="font_size" value="large" ${state.settings.font_size === 'large' ? 'checked' : ''} /> Besar</label>
        </div>
      </div>

      <div class="field full">
        <label>Halaman utama saat dibuka</label>
        <select name="default_view">${viewOptions}</select>
      </div>

      <!-- Tugas -->
      <p class="eyebrow" style="margin:22px 0 12px">Tugas</p>

      <div class="field full">
        <label class="check-line"><input type="checkbox" name="carry_over" ${state.settings.carry_over === '1' ? 'checked' : ''} />
          <span><strong>Bawa tugas yang belum selesai</strong>Saat hari baru dibuka, tugas yang belum dicentang otomatis disalin ke hari itu.</span>
        </label>
      </div>

      <!-- Notifikasi -->
      <p class="eyebrow" style="margin:22px 0 12px">Notifikasi</p>

      <div class="field full">
        <label class="check-line"><input type="checkbox" name="sound" ${state.settings.sound === '1' ? 'checked' : ''} />
          <span><strong>Suara timer</strong>Bunyi singkat saat sesi fokus selesai.</span>
        </label>
      </div>
      <div class="field full">
        <label class="check-line"><input type="checkbox" name="notifications" ${state.settings.notifications === '1' ? 'checked' : ''} />
          <span><strong>Notifikasi browser</strong>Pengingat agenda/tugas 10 menit sebelum dimulai, dan deadline lomba 24 jam sebelumnya.</span>
        </label>
      </div>

      <!-- Keamanan -->
      <p class="eyebrow" style="margin:22px 0 12px">Keamanan</p>

      <div class="field full">
        <label>Kunci aplikasi dengan PIN (opsional)</label>
        <input name="lock_pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" placeholder="Buat PIN 4+ digit — kosongkan untuk tetap terbuka" autocomplete="off" />
        <span class="help">Jika diisi, MyAct terkunci saat dibuka — masukkan PIN untuk membuka data.</span>
        <label class="check-line" style="margin-top:8px"><input type="checkbox" name="lock_disable" />
          <span><strong>Matikan kunci aplikasi</strong>Hapus PIN dan buka kunci — aplikasi terbuka seperti biasa.</span>
        </label>
      </div>

      <!-- Data -->
      <p class="eyebrow" style="margin:22px 0 12px">Data</p>
      <div class="field full" style="display:flex; gap:10px; flex-wrap:wrap">
        <a class="btn btn-ghost btn-sm" href="/api/export" download>${ico('download')} Unduh backup JSON</a>
        <button type="button" class="btn btn-ghost btn-sm" id="resetDataBtn">${ico('trash')} Hapus semua data</button>
      </div>

      <p style="font-size:9.5px;color:var(--faint);line-height:1.7;margin-top:16px">
        Semua data tersimpan lokal di <code>data/myact.db</code> (SQLite). Cuaca memakai Open-Meteo tanpa API key.<br>
        MyAct v${APP_VERSION} · <a class="link-btn" href="https://github.com/MyAct/myact/blob/main/CHANGELOG.md" target="_blank" rel="noopener">Changelog</a> · <a class="link-btn" href="https://github.com/MyAct/myact/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">Kontribusi</a>
      </p>
    </div>`;

  openModal({
    title: 'Pengaturan',
    eyebrow: 'MyAct',
    wide: true,
    hideSubmit: false,
    submitLabel: 'Simpan pengaturan',
    body,
    onSubmit: async (form) => {
      const wantsNotifications = formValue(form, 'notifications');
      let notificationValue = wantsNotifications ? '1' : '0';
      if (wantsNotifications) {
        const granted = await requestNotifications();
        if (!granted) {
          notificationValue = '0';
          throw new Error('Izin notifikasi belum diberikan. Aktifkan izin situs di browser lalu coba lagi.');
        }
      }
      const payload = {
        name: formValue(form, 'name') || 'Kamu',
        location: formValue(form, 'location') || state.weather.key,
        carry_over: formValue(form, 'carry_over') ? '1' : '0',
        sound: formValue(form, 'sound') ? '1' : '0',
        notifications: notificationValue,
        theme: formValue(form, 'theme') || 'dark',
        font_size: formValue(form, 'font_size') || 'normal',
        default_view: formValue(form, 'default_view') || 'beranda',
        accent: document.querySelector('.accent-swatch.active')?.dataset.accent || 'terracotta',
      };
      const lockPin = formValue(form, 'lock_pin');
      const lockDisable = formValue(form, 'lock_disable');
      if (lockPin) {
        if (lockPin.length < 4) throw new Error('PIN minimal 4 digit');
        await api('/api/lock', { method: 'POST', body: { action: 'set', pin: lockPin } });
      } else if (lockDisable) {
        await api('/api/lock', { method: 'POST', body: { action: 'disable' } });
      }
      const data = await api('/api/settings', { method: 'POST', body: payload });
      state.settings = data.settings;
      // apply theme/accent/font immediately
      document.documentElement.setAttribute('data-theme', state.settings.theme === 'system' ? resolveInitialTheme() : state.settings.theme);
      document.documentElement.setAttribute('data-accent', state.settings.accent);
      document.documentElement.setAttribute('data-font-size', state.settings.font_size);
      renderChrome();
      renderDashboard();
      toast(lockPin ? 'PIN kunci aplikasi diaktifkan' : lockDisable ? 'Kunci aplikasi dimatikan' : 'Pengaturan disimpan');
      if (payload.location !== state.weather.key) await changeWeatherLocation(payload.location);
    },
  });

  // accent swatch clicks — apply + mark active immediately (visual feedback)
  setTimeout(() => {
    document.querySelectorAll('.accent-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.accent-swatch').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const accent = btn.dataset.accent;
        document.documentElement.setAttribute('data-accent', accent);
      });
    });
    // reset data button
    const resetBtn = document.getElementById('resetDataBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        confirmDialog({
          title: 'Hapus semua data?',
          message: '<strong>Semua data</strong> (tugas, kalender, catatan, lomba, nilai, flashcard, streak, fokus, musik) akan dihapus permanen. <em>Hanya nama & pengaturan tampilan yang dipertahankan.</em> Unduh backup JSON dulu kalau butuh.',
          confirmLabel: 'Hapus semua data',
          danger: true,
          onConfirm: async () => {
            await api('/api/reset', { method: 'POST' });
            toast('Semua data dihapus. Aplikasi akan dimuat ulang.');
            setTimeout(() => window.location.reload(), 1200);
          },
        });
      });
    }
  }, 60);
}

/* ---------- ticker (ringan) ---------- */
let lastSecond = -1;
function tick() {
  const now = Date.now();
  const sec = Math.floor(now / 1000);
  if (sec === lastSecond) return;
  lastSecond = sec;
  const t = localTimeParts();
  const side = $('#sideClock');
  if (side) side.textContent = `${pad2(t.h)}:${pad2(t.m)}`;
  if (state.view === 'beranda') {
    const clock = $('#heroClock');
    if (clock) clock.innerHTML = `${pad2(t.h)}:${pad2(t.m)}`;
  }
  tickCountdowns();

  const currentDay = todayStr();
  if (currentDay !== state.today) handleNewDay(currentDay);

  if (t.s % 30 === 0 && lastReminderCheck !== Math.floor(now / 30000)) {
    lastReminderCheck = Math.floor(now / 30000);
    checkReminders();
  }
}

async function handleNewDay(newDay) {
  const viewingToday = state.taskDate === state.today;
  state.today = newDay;
  state.cal.year = +newDay.slice(0, 4);
  state.cal.month = +newDay.slice(5, 7) - 1;
  state.cal.selected = newDay;
  state.mini.year = state.cal.year;
  state.mini.month = state.cal.month;
  if (viewingToday) state.taskDate = newDay;
  toast('Hari baru dimulai — checklist direset');
  await Promise.allSettled([
    loadTasks(state.taskDate, { silent: true }),
    loadEvents(),
    loadFocus(),
    loadCompetitions(),
  ]);
  renderAll();
}

function checkReminders() {
  if (state.settings.notifications !== '1') return;
  const canNotify = ('Notification' in window) && Notification.permission === 'granted';
  const notifyFallback = (title, body) => {
    if (canNotify) notify(title, body);
    else toast(`${title}: ${body}`, 'ok', 6000);
  };
  const notified = storage.get('notified', {});
  let changed = false;
  const now = Date.now();
  eventsForDay(state.today).forEach((ev) => {
    if (!ev.time || ev.pseudo) return;
    const key = `ev-${ev.id}-${state.today}`;
    const start = parseLocalDT(`${state.today}T${String(ev.time).slice(0, 5)}`);
    const diff = start - now;
    if (diff > 0 && diff <= 10 * 60000 && !notified[key]) {
      notifyFallback('Agenda 10 menit lagi', `${ev.title} · ${String(ev.time).slice(0, 5)} WITA`);
      notified[key] = now; changed = true;
    }
  });
  (state.todayTasks.tasks || []).forEach((task) => {
    if (!task.start_time || task.done) return;
    const key = `task-${task.id}-${state.today}`;
    const start = parseLocalDT(`${state.today}T${String(task.start_time).slice(0, 5)}`);
    const diff = start - now;
    if (diff > 0 && diff <= 10 * 60000 && !notified[key]) {
      notifyFallback('Tugas dalam 10 menit', `${task.title} · ${String(task.start_time).slice(0, 5)} WITA`);
      notified[key] = now; changed = true;
    }
  });
  // competition deadlines within 24h
  (state.competitions || []).forEach((comp) => {
    if (comp.status === 'selesai') return;
    const dl = parseLocalDT(comp.deadline);
    if (!Number.isFinite(dl)) return;
    const diff = dl - now;
    const key = `comp-${comp.id}`;
    if (diff > 0 && diff <= 24 * 3600 * 1000 && !notified[key]) {
      notifyFallback('Deadline lomba 24 jam lagi', `${comp.title} · ${fmtDeadline(comp.deadline)}`);
      notified[key] = now; changed = true;
    }
  });
  if (changed) {
    const entries = Object.entries(notified);
    const pruned = entries.slice(-80);
    storage.set('notified', Object.fromEntries(pruned));
  }
}


function bindShortcutsHelp() {
  const btn = $('#shortcutsHelp');
  if (btn) btn.addEventListener('click', openShortcutsHelp);
}
function openShortcutsHelp() {
  const rows = [
    ['Ctrl / ⌘ + K', 'Buka command palette (lompat ke halaman / aksi)'],
    ['Ctrl / ⌘ + /', 'Bantuan shortcut keyboard'],
    ['Esc', 'Tutup modal / command palette / mode fokus / pengunci'],
    ['Enter', 'Jalankan perintah di palette · simpan form'],
  ];
  openModal({
    title: 'Shortcut keyboard',
    eyebrow: 'Bantuan',
    wide: false,
    hideSubmit: true,
    body: `<div class="shortcut-list">${rows.map(([k, d]) => `<div class="shortcut-row"><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join('')}</div>`,
  });
}

function resolveInitialTheme() {
  const saved = state.settings.theme;
  if (saved) return saved;
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  } catch {}
  return 'dark';
}

/* ---------- global bindings ---------- */


/* ---------- app lock form ---------- */
function bindLockForm() {
  const form = $('#lockForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await unlockWithPin($('#lockPin').value);
    if (ok) $('#lockPin').value = '';
  });
  document.addEventListener('keydown', (e) => {
    const overlay = $('#lockOverlay');
    if (overlay && !overlay.hidden && e.key === 'Escape') e.stopPropagation();
  });
}

/* ---------- onboarding wizard ---------- */
async function maybeShowOnboarding() {
  if (state.settings.onboarded === '1') return;
  if (state.settings.last_open_date && state.todayTasks && state.todayTasks.tasks && state.todayTasks.tasks.length > 3) {
    // existing user — mark onboarded silently
    try { await api('/api/settings', { method: 'POST', body: { onboarded: '1' } }); state.settings.onboarded = '1'; } catch {}
    return;
  }
  const overlay = $('#onboardOverlay');
  if (overlay) { overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false'); }
}
function bindOnboarding() {
  const overlay = $('#onboardOverlay');
  if (!overlay) return;
  overlay.addEventListener('click', (e) => {
    const next = e.target.closest('[data-onboard-next]');
    if (next) {
      const current = next.closest('.onboard-step');
      const n = Number(current.dataset.step);
      const nextStep = overlay.querySelector(`.onboard-step[data-step="${n + 1}"]`);
      current.hidden = true;
      if (nextStep) nextStep.hidden = false;
      return;
    }
    if (e.target.id === 'onboardFinish') {
      api('/api/settings', { method: 'POST', body: { onboarded: '1' } }).then(() => { state.settings.onboarded = '1'; }).catch(() => {});
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      toast('Selamat menggunakan MyAct');
    }
  });
}

function bindGlobal() {
  $$('.nav-item').forEach((item) => item.addEventListener('click', () => setView(item.dataset.view)));
  $('#topWeather').addEventListener('click', () => setView('cuaca'));
  const refreshAppBtn = $('#refreshApp');
  if (refreshAppBtn) refreshAppBtn.addEventListener('click', refreshApp);
  $('#topAvatar').addEventListener('click', openSettingsModal);
  $('#openSettings').addEventListener('click', openSettingsModal);
  $('#modalClose').addEventListener('click', closeModal);
  $('#refreshWeather').addEventListener('click', () => loadWeather(state.weather.key, true));
  $('#heroAddTask').addEventListener('click', () => openTaskModal(null, state.today));

  document.addEventListener('keydown', (e) => {
    const isMac = /Mac/i.test(navigator.platform || '');
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key === '/') { e.preventDefault(); openShortcutsHelp(); }
    if (e.key === 'Escape' && !$('#modalOverlay').hidden) closeModal();
  });

  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'heroLocSelect') changeWeatherLocation(e.target.value);
  });

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) { setView(go.dataset.goto); return; }

    const toggle = e.target.closest('[data-task-toggle]');
    if (toggle) { toggleTask(Number(toggle.dataset.taskToggle), toggle.dataset.done !== '1'); return; }

    const edit = e.target.closest('[data-task-edit]');
    if (edit) {
      const id = Number(edit.dataset.taskEdit);
      const task = [...(state.tasks.tasks || []), ...(state.todayTasks.tasks || [])].find((t) => t.id === id);
      if (task) openTaskModal(task);
      return;
    }

    const del = e.target.closest('[data-task-del]');
    if (del) {
      const id = Number(del.dataset.taskDel);
      const task = [...(state.tasks.tasks || []), ...(state.todayTasks.tasks || [])].find((t) => t.id === id);
      if (!task) return;
      confirmDialog({
        title: 'Hapus tugas?',
        message: `<strong>${esc(task.title)}</strong> akan dihapus dari daftar.`,
        confirmLabel: 'Hapus tugas',
        onConfirm: async () => {
          await api(`/api/tasks/${id}`, { method: 'DELETE' });
          await loadTasks(state.taskDate);
          toast('Tugas dihapus');
        },
      });
      return;
    }

    const tpl = e.target.closest('[data-template-del]');
    if (tpl) {
      confirmDialog({
        title: 'Hapus rutinitas?',
        message: 'Rutinitas ini tidak akan muncul lagi di hari-hari berikutnya. Tugas yang sudah ada tetap bisa dihapus terpisah.',
        confirmLabel: 'Hapus rutinitas',
        onConfirm: async () => {
          await api(`/api/templates/${tpl.dataset.templateDel}`, { method: 'DELETE' });
          await loadTasks(state.taskDate);
          toast('Rutinitas dihapus');
        },
      });
      return;
    }

    const miniDay = e.target.closest('[data-mini-day]');
    if (miniDay) {
      const day = miniDay.dataset.miniDay;
      state.cal.selected = day;
      state.cal.year = +day.slice(0, 4);
      state.cal.month = +day.slice(5, 7) - 1;
      setView('kalender');
      return;
    }

    const loc = e.target.closest('[data-loc]');
    if (loc) { changeWeatherLocation(loc.dataset.loc); return; }

    const streakDay = e.target.closest('[data-streak-day]');
    if (streakDay) {
      const day = streakDay.dataset.streakDay;
      const done = streakDay.classList.contains('done');
      api("/api/streak", { method: "POST", body: { date: day, completed: done ? 0 : 1 } })
        .then(() => loadStreak())
        .then(() => toast(done ? "Streak dibatalkan" : "Streak hari ini ditandai selesai"))
        .catch((err) => toast(err.message, "error"));
      return;
    }

    if (e.target.closest('[data-wx-retry]')) { loadWeather(state.weather.key, true); return; }

    const note = e.target.closest('[data-note-edit]');
    if (note) {
      const found = state.notes.find((n) => n.id === Number(note.dataset.noteEdit));
      if (found) openNoteModal(found);
      return;
    }
    if (e.target.closest('[data-note-new]')) { openNoteModal(); return; }

    const evEdit = e.target.closest('[data-ev-edit]');
    if (evEdit) {
      const found = state.events.find((ev) => ev.id === Number(evEdit.dataset.evEdit));
      if (found) openEventModal(found);
      return;
    }
    const evDel = e.target.closest('[data-ev-del]');
    if (evDel) {
      const found = state.events.find((ev) => ev.id === Number(evDel.dataset.evDel));
      if (!found) return;
      confirmDialog({
        title: 'Hapus agenda?',
        message: `<strong>${esc(found.title)}</strong> pada ${esc(fmtLong(found.date))} akan dihapus.`,
        confirmLabel: 'Hapus agenda',
        onConfirm: async () => {
          await api(`/api/events/${found.id}`, { method: 'DELETE' });
          await loadEvents();
          renderCalendarView();
          toast('Agenda dihapus');
        },
      });
      return;
    }

    const calDay = e.target.closest('[data-cal-day]');
    if (calDay) {
      const day = calDay.dataset.calDay;
      state.cal.selected = day;
      if (monthKey(day) !== `${state.cal.year}-${pad2(state.cal.month + 1)}`) {
        state.cal.year = +day.slice(0, 4);
        state.cal.month = +day.slice(5, 7) - 1;
      }
      renderCalendarView();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.note-card')) {
      e.target.click();
    }
  });

  bindTaskQuickActions();
  bindCalendarActions();
  bindCompetitionActions();
  bindNoteActions();
  bindScheduleActions();
  bindFocusActions();
  bindTheme();
  bindStreakActions();
  bindShortcutsHelp();
  if (typeof bindFlashcardActions === "function") bindFlashcardActions();
  bindLockForm();
  bindOnboarding();
}

async function toggleTheme() {
  const next = state.settings.theme === 'dark' ? 'light' : 'dark';
  try {
    await api('/api/settings', { method: 'POST', body: { theme: next } });
    state.settings.theme = next;
    renderChrome();
    renderDashboard();
    toast(next === 'light' ? 'Mode terang ☀️' : 'Mode gelap 🌙');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function bindTheme() {
  const btn = $('#topTheme');
  if (!btn) return;
  btn.addEventListener('click', toggleTheme);
}

async function enableNotifications() {
  const ok = await requestNotifications();
  if (ok) {
    try {
      await api('/api/settings', { method: 'POST', body: { notifications: '1' } });
      state.settings.notifications = '1';
      toast('Notifikasi deadline aktif 🔔');
    } catch (err) { toast(err.message, 'error'); }
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(window.location.protocol)) return;
  if (window.location.search.includes('nosw=1')) return;
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    reg.update().catch(() => {});
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }).catch(() => {});
  // one-time self-heal: after new SW takes control, reload once per browser session
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (storage.get('sw_reloaded', false)) return;
    storage.set('sw_reloaded', true);
    window.location.reload();
  });
}


/* ---------- global error boundary (C6/F4) ---------- */
let crashShown = false;
function showCrashOverlay(message) {
  if (crashShown) return;
  crashShown = true;
  const overlay = $('#crashOverlay');
  if (!overlay) return;
  const detail = $('#crashDetail');
  if (detail) detail.textContent = message ? String(message).slice(0, 300) : 'Terjadi kesalahan tak terduga.';
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  overlay.focus();
}
window.addEventListener('error', (e) => {
  // ignore benign ResizeObserver noise
  if (e.message && /ResizeObserver|Script error/i.test(e.message)) return;
  showCrashOverlay(e.error ? e.error.stack || e.message : e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  showCrashOverlay(reason && reason.message ? reason.message : String(reason));
});
$('#crashReload')?.addEventListener('click', () => window.location.reload());
$('#crashClose')?.addEventListener('click', () => {
  const overlay = $('#crashOverlay');
  if (overlay) overlay.hidden = true;
});

/* ---------- init ---------- */
async function init() {
  hydrateIcons();
  restoreTimer();
  bindGlobal();
  try {
    await loadBootstrap();
    if (!state.settings.theme) state.settings.theme = resolveInitialTheme();
    renderChrome();
    await Promise.allSettled([
      loadTasks(state.today),
      loadEvents(),
      loadCompetitions(),
      loadNotes(),
      loadSchedule(),
      loadFocus(),
      loadWeather(state.weather.key),
    ]);
    state.booted = true;
    renderAll();
    const vNode = $('#appVersion');
    if (vNode) vNode.textContent = `v${APP_VERSION}`;

    if (typeof bindPalette === 'function') bindPalette();
    maybeShowOnboarding();
    if (typeof loadWeeklyReview === 'function') loadWeeklyReview();
    registerServiceWorker();
    // splash out setelah app siap — beri sedikit napas untuk animasi
    setTimeout(() => {
      const splash = document.getElementById('splash');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => { splash.hidden = true; splash.style.display = 'none'; }, 480);
      }
    }, 300);
    const initial = window.location.hash.replace(/^#\/?/, '');
    if (PAGE_META[initial] && initial !== 'beranda') setView(initial);
    window.addEventListener('hashchange', () => {
      const hashView = window.location.hash.replace(/^#\/?/, '') || 'beranda';
      if (PAGE_META[hashView] && hashView !== state.view) {
        state.view = hashView;
        $$('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${hashView}`));
        renderChrome();
        setView(hashView);
      }
    });
    tick();
    setInterval(tick, 1000);
    setInterval(() => loadWeather(state.weather.key, false), 10 * 60 * 1000);
  } catch (err) {
    const splash = document.getElementById('splash');
    if (splash) splash.hidden = true;
    toast(`Tidak dapat terhubung ke server MyAct: ${err.message}`, 'error', 8000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
