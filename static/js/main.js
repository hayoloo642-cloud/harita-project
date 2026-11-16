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

function openSettingsModal() {
  const name = esc(state.settings.name || '');
  const locOptions = Object.entries(state.locations).map(([key, locName]) =>
    `<option value="${key}" ${state.settings.location === key ? 'selected' : ''}>${esc(locName)}</option>`).join('');
  const body = `
    <div class="form-grid">
      <div class="field">
        <label>Nama kamu</label>
        <input name="name" maxlength="40" value="${name}" placeholder="Nama panggilan" />
      </div>
      <div class="field">
        <label>Lokasi cuaca utama</label>
        <select name="location">${locOptions}</select>
      </div>
      <div class="field full">
        <label class="check-line"><input type="checkbox" name="carry_over" ${state.settings.carry_over === '1' ? 'checked' : ''} />
          <span><strong>Bawa tugas yang belum selesai</strong>Saat hari baru dibuka, tugas yang belum dicentang otomatis disalin ke hari itu.</span>
        </label>
      </div>
      <div class="field full">
        <label class="check-line"><input type="checkbox" name="sound" ${state.settings.sound === '1' ? 'checked' : ''} />
          <span><strong>Suara timer</strong>Bunyi singkat saat sesi fokus selesai.</span>
        </label>
      </div>
      <div class="field full">
        <label class="check-line"><input type="checkbox" name="notifications" ${state.settings.notifications === '1' ? 'checked' : ''} />
          <span><strong>Notifikasi browser</strong>Pengingat agenda/tugas 10 menit sebelum dimulai.</span>
        </label>
      </div>
      <div class="field full">
        <label>Kunci aplikasi dengan PIN (opsional)</label>
        <input name="lock_pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" placeholder="Buat PIN 4+ digit — kosongkan untuk tetap terbuka" autocomplete="off" />
        <span class="help">Jika diisi, MyAct terkunci saat dibuka — masukkan PIN untuk membuka data.</span>
        <label class="check-line" style="margin-top:8px"><input type="checkbox" name="lock_disable" />
          <span><strong>Matikan kunci aplikasi</strong>Hapus PIN dan buka kunci — aplikasi terbuka seperti biasa.</span>
        </label>
      </div>
      <div class="field full">
        <div class="modal-info">
          <strong style="color:var(--text)">Data tersimpan lokal.</strong><br>
          Semua progres ada di <code>data/myact.db</code> (SQLite).
          Cuaca memakai Open-Meteo tanpa API key.<br><br>
          MyAct v${APP_VERSION} · <a class="link-btn" href="https://github.com/MyAct/myact/blob/main/CHANGELOG.md" target="_blank" rel="noopener">Changelog</a><br>
          <a class="btn btn-ghost btn-sm" href="/api/export" download>${ico('download')} Unduh backup JSON</a>
        </div>
      </div>
    </div>`;
  openModal({
    title: 'Pengaturan',
    eyebrow: 'MyAct',
    body,
    submitLabel: 'Simpan pengaturan',
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
      renderChrome();
      renderDashboard();
      toast(lockPin ? 'PIN kunci aplikasi diaktifkan' : lockDisable ? 'Kunci aplikasi dimatikan' : 'Pengaturan disimpan');
      if (payload.location !== state.weather.key) await changeWeatherLocation(payload.location);
    },
  });
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
    toast(`Tidak dapat terhubung ke server MyAct: ${err.message}`, 'error', 8000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
