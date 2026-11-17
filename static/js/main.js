const APP_VERSION = '1.4.0';
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
  if (view === 'pengeluaran') safeViewRender(view, () => { loadExpenses(state.expenseMonth); renderExpensesView(); });
  if (view === 'jadwal') safeViewRender(view, renderScheduleView);
  if (view === 'nilai') safeViewRender(view, () => loadGrades && loadGrades());
  if (view === 'flashcard') safeViewRender(view, () => loadFlashcards && loadFlashcards());
  if (view === 'device') safeViewRender(view, startDevicePoll);
  if (view === 'music') safeViewRender(view, () => { initMusic && initMusic(); loadMusic && loadMusic(); });
  if (view === 'streak') safeViewRender(view, () => { loadStreak && loadStreak(); renderStreakView && renderStreakView(); });
  const mainScroller = document.querySelector('.main');
  if (mainScroller) mainScroller.scrollTo({ top: 0, behavior: 'auto' });
  if (typeof localizeStatic === 'function') localizeStatic();
}

function renderAll() {
  renderChrome();
  renderDashboard();
  renderWeatherView();
  renderTasksView();
  renderCalendarView();
  renderCompetitionsView();
  renderNotesView();
  renderExpensesView();
  renderScheduleView();
  renderFocusView();
  if (typeof loadGrades === 'function') loadGrades();
  if (typeof loadFlashcards === 'function') loadFlashcards();
  if (typeof localizeStatic === 'function') localizeStatic();
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
      loadExpenses(),
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

  const navViews = [
    ['beranda', 'Beranda'], ['tugas', 'Tugas'], ['kalender', 'Kalender'],
    ['fokus', 'Fokus'], ['catatan', 'Catatan'], ['jadwal', 'Jadwal'],
    ['nilai', 'Nilai'], ['flashcard', 'Flashcard'], ['lomba', 'Lomba'],
    ['pengeluaran', 'Pengeluaran'], ['streak', 'Streak'], ['cuaca', 'Cuaca'], ['music', 'Musik'],
  ];
  const viewOptions = navViews.map(([v, l]) => `<option value="${v}" ${(state.settings.default_view || 'beranda') === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const pinnedSet = new Set(parseViewList(state.settings.pinned_views));
  const hiddenSet = new Set(parseViewList(state.settings.hidden_views));
  const navPrefsHtml = navViews.map(([v, l]) => `
    <div class="nav-pref-row">
      <span class="nav-pref-name">${esc(l)}</span>
      <label class="check-line compact"><input type="checkbox" data-pin-view="${v}" ${pinnedSet.has(v) ? 'checked' : ''} /><span>${esc(t('settings.pin'))}</span></label>
      <label class="check-line compact"><input type="checkbox" data-hide-view="${v}" ${hiddenSet.has(v) ? 'checked' : ''} /><span>${esc(t('settings.hide'))}</span></label>
    </div>`).join('');

  const currentAccent = state.settings.accent || 'terracotta';
  const accentHtml = ACCENT_SWATCHES.map((s) => `
    <button type="button" class="accent-swatch ${currentAccent === s.id ? 'active' : ''}" data-accent="${s.id}" title="${s.label}" aria-label="Aksen ${s.label}" style="background:${s.color}"></button>
  `).join('');

  const body = `
    <div class="settings-scroll">
      <!-- Profil -->
      <p class="eyebrow" style="margin:4px 0 12px">${esc(t('settings.profile'))}</p>
      <div class="form-grid">
        <div class="field">
          <label>${esc(t('settings.name'))}</label>
          <input name="name" maxlength="40" value="${name}" placeholder="Nama panggilan" />
        </div>
        <div class="field">
          <label>${esc(t('settings.location'))}</label>
          <select name="location">${locOptions}</select>
        </div>
      </div>

      <!-- Tampilan -->
      <p class="eyebrow" style="margin:22px 0 12px">${esc(t('settings.appearance'))}</p>

      <div class="field full">
        <label>${esc(t('settings.theme'))}</label>
        <div class="segmented" role="radiogroup" aria-label="Tema">
          <label class="seg-option ${state.settings.theme === 'dark' ? 'active' : ''}"><input type="radio" name="theme" value="dark" ${state.settings.theme === 'dark' ? 'checked' : ''} /> ${esc(t('settings.theme.dark'))}</label>
          <label class="seg-option ${state.settings.theme === 'light' ? 'active' : ''}"><input type="radio" name="theme" value="light" ${state.settings.theme === 'light' ? 'checked' : ''} /> ${esc(t('settings.theme.light'))}</label>
          <label class="seg-option ${(!state.settings.theme || state.settings.theme === 'system') ? 'active' : ''}"><input type="radio" name="theme" value="system" ${(!state.settings.theme || state.settings.theme === 'system') ? 'checked' : ''} /> ${esc(t('settings.theme.system'))}</label>
        </div>
      </div>

      <div class="field full">
        <label>${esc(t('settings.accent'))}</label>
        <div class="accent-grid" role="radiogroup" aria-label="Aksen warna">${accentHtml}</div>
        <span class="help">Tema tetap, aksen berubah untuk tombol, ring, dan highlight.</span>
      </div>

      <div class="field full">
        <label>${esc(t('settings.fontSize'))}</label>
        <div class="segmented" role="radiogroup" aria-label="Ukuran teks">
          <label class="seg-option ${(!state.settings.font_size || state.settings.font_size === 'small') ? 'active' : ''}"><input type="radio" name="font_size" value="small" ${(!state.settings.font_size || state.settings.font_size === 'small') ? 'checked' : ''} /> ${esc(t('settings.size.small'))}</label>
          <label class="seg-option ${(!state.settings.font_size || state.settings.font_size === 'normal') ? 'active' : ''}"><input type="radio" name="font_size" value="normal" ${(!state.settings.font_size || state.settings.font_size === 'normal') ? 'checked' : ''} /> ${esc(t('settings.size.normal'))}</label>
          <label class="seg-option ${state.settings.font_size === 'large' ? 'active' : ''}"><input type="radio" name="font_size" value="large" ${state.settings.font_size === 'large' ? 'checked' : ''} /> ${esc(t('settings.size.large'))}</label>
        </div>
      </div>

      <div class="field full">
        <label>${esc(t('settings.contrast'))}</label>
        <div class="segmented" role="radiogroup" aria-label="Kontras tampilan">
          <label class="seg-option ${(!state.settings.contrast || state.settings.contrast === 'normal') ? 'active' : ''}"><input type="radio" name="contrast" value="normal" ${(!state.settings.contrast || state.settings.contrast === 'normal') ? 'checked' : ''} /> ${esc(t('settings.contrast.normal'))}</label>
          <label class="seg-option ${state.settings.contrast === 'high' ? 'active' : ''}"><input type="radio" name="contrast" value="high" ${state.settings.contrast === 'high' ? 'checked' : ''} /> ${esc(t('settings.contrast.high'))}</label>
        </div>
        <span class="help">Kontras tinggi mempertegas teks, garis, dan fokus keyboard.</span>
      </div>

      <div class="field full">
        <label>${esc(t('settings.defaultView'))}</label>
        <select name="default_view">${viewOptions}</select>
      </div>

      <div class="field">
        <label>${esc(t('settings.language'))}</label>
        <select name="language">
          <option value="id" ${(state.settings.language || 'id') === 'id' ? 'selected' : ''}>Bahasa Indonesia</option>
          <option value="en" ${state.settings.language === 'en' ? 'selected' : ''}>English</option>
        </select>
        <span class="help">Chrome, navigation, and settings. Changes reload the app.</span>
      </div>

      <div class="field full">
        <details class="nav-prefs">
          <summary>${esc(t('settings.navManage'))}</summary>
          <p class="help" style="margin:8px 0">Semat item yang sering dipakai ke atas, sembunyikan yang jarang. Item tersembunyi tetap bisa dibuka lewat pencarian (Ctrl+K).</p>
          <div class="nav-pref-list">${navPrefsHtml}</div>
        </details>
      </div>

      <!-- Tugas -->
      <p class="eyebrow" style="margin:22px 0 12px">${esc(t('settings.tasks'))}</p>

      <div class="field full">
        <label class="check-line"><input type="checkbox" name="carry_over" ${state.settings.carry_over === '1' ? 'checked' : ''} />
          <span><strong>Bawa tugas yang belum selesai</strong>Saat hari baru dibuka, tugas yang belum dicentang otomatis disalin ke hari itu.</span>
        </label>
      </div>

      <!-- Uang -->
      <p class="eyebrow" style="margin:22px 0 12px">${esc(t('settings.money', 'Uang'))}</p>
      <div class="field">
        <label>${esc(t('settings.budget', 'Anggaran pengeluaran bulanan (Rp)'))}</label>
        <input name="expense_budget" type="number" min="0" step="1000" inputmode="numeric" value="${Number(state.settings.expense_budget) || 0}" />
        <span class="help">${esc(t('settings.budgetHelp', 'Isi 0 untuk mematikan anggaran. Progres muncul di halaman Pengeluaran.'))}</span>
      </div>

      <!-- Notifikasi -->
      <p class="eyebrow" style="margin:22px 0 12px">${esc(t('settings.notifications'))}</p>

      <div class="field full">
        <label class="check-line"><input type="checkbox" name="sound" ${state.settings.sound === '1' ? 'checked' : ''} />
          <span><strong>${esc(t('settings.sound'))}</strong>Bunyi singkat saat sesi fokus selesai.</span>
        </label>
      </div>
      <div class="field full">
        <label class="check-line"><input type="checkbox" name="notifications" ${state.settings.notifications === '1' ? 'checked' : ''} />
          <span><strong>${esc(t('settings.notifyBrowser'))}</strong>Pengingat agenda/tugas sebelum dimulai, dan deadline lomba 24 jam sebelumnya.</span>
        </label>
      </div>
      <div class="field">
        <label>${esc(t('settings.reminderLead'))}</label>
        <input name="reminder_lead" type="number" min="1" max="120" step="1" value="${Number(state.settings.reminder_lead) || 10}" />
        <span class="help">Berlaku untuk agenda dan tugas yang punya jam mulai (1–120 menit).</span>
      </div>

      <!-- Keamanan -->
      <p class="eyebrow" style="margin:22px 0 12px">${esc(t('settings.security'))}</p>

      <div class="field full">
        <label>${esc(t('settings.pinLock'))}</label>
        <input name="lock_pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" placeholder="Buat PIN 4+ digit — kosongkan untuk tetap terbuka" autocomplete="off" />
        <span class="help">Jika diisi, MyAct terkunci saat dibuka — masukkan PIN untuk membuka data.</span>
        <label class="check-line" style="margin-top:8px"><input type="checkbox" name="lock_disable" />
          <span><strong>Matikan kunci aplikasi</strong>Hapus PIN dan buka kunci — aplikasi terbuka seperti biasa.</span>
        </label>
      </div>

      <!-- Data -->
      <p class="eyebrow" style="margin:22px 0 12px">${esc(t('settings.data'))}</p>
      <div class="field full" style="display:flex; gap:10px; flex-wrap:wrap">
        <a class="btn btn-ghost btn-sm" href="/api/export" download>${ico('download')} ${esc(t('settings.backup'))}</a>
        <button type="button" class="btn btn-ghost btn-sm" id="importDataBtn">${ico('upload')} Impor backup</button>
        <button type="button" class="btn btn-ghost btn-sm" id="demoDataBtn">${ico('sparkles')} ${esc(t('settings.demo'))}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="swResetBtn">${ico('refresh')} ${esc(t('settings.clearCache'))}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="diagCopyBtn">${ico('copy')} ${esc(t('settings.diagnostics'))}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="resetDataBtn">${ico('trash')} ${esc(t('settings.reset'))}</button>
      </div>
      <div class="field full db-info" id="settingsDbInfo">
        <span class="help">Memeriksa status database…</span>
      </div>

      <p style="font-size:9.5px;color:var(--faint);line-height:1.7;margin-top:16px">
        Semua data tersimpan lokal di <code>data/myact.db</code> (SQLite). Cuaca memakai Open-Meteo tanpa API key.<br>
        MyAct v${APP_VERSION} · MIT · Changelog &amp; kontribusi tersedia di paket source repository.
      </p>
    </div>`;

  openModal({
    title: t('settings.title'),
    eyebrow: 'MyAct',
    wide: true,
    hideSubmit: false,
    submitLabel: t('settings.save'),
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
        contrast: formValue(form, 'contrast') || 'normal',
        reminder_lead: formValue(form, 'reminder_lead') || '10',
        default_view: formValue(form, 'default_view') || 'beranda',
        accent: document.querySelector('.accent-swatch.active')?.dataset.accent || 'terracotta',
        pinned_views: [...form.querySelectorAll('[data-pin-view]:checked')].map((el) => el.dataset.pinView).join(','),
        hidden_views: [...form.querySelectorAll('[data-hide-view]:checked')].map((el) => el.dataset.hideView).join(','),
        language: formValue(form, 'language') || 'id',
        expense_budget: formValue(form, 'expense_budget') || '0',
      };
      const languageChanged = payload.language !== (state.settings.language || 'id');
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
      document.documentElement.setAttribute('data-contrast', state.settings.contrast || 'normal');
      renderChrome();
      renderDashboard();
      if (languageChanged) {
        toast('Language changed — reloading…');
        setTimeout(() => window.location.reload(), 700);
        return;
      }
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
    const diagBtn = document.getElementById('diagCopyBtn');
    if (diagBtn) diagBtn.addEventListener('click', copyDiagnostics);
    const dbInfo = document.getElementById('settingsDbInfo');
    if (dbInfo) {
      api('/api/db/status').then((data) => {
        state.dbStatus = data;
        const backups = data.backups || [];
        const files = data.corrupt_files || [];
        const last = backups[0];
        dbInfo.innerHTML = `
          <label>Backup & pemulihan</label>
          <p class="help" style="margin:0 0 8px">
            ${backups.length} backup JSON tersimpan${last ? ` — terbaru <strong>${esc(last.name)}</strong>` : ''}.
            ${files.length ? ` <span style="color:var(--danger)">${files.length} file database rusak terdeteksi.</span>` : ''}
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn btn-ghost btn-sm" id="settingsDbRestore" ${backups.length ? '' : 'disabled'}>${ico('refresh')} Pulihkan backup terbaru</button>
            <button type="button" class="btn btn-ghost btn-sm" id="settingsDbCorrupt" ${files.length ? '' : 'disabled'}>${ico('download')} Unduh file rusak</button>
          </div>`;
        const restoreBtn = document.getElementById('settingsDbRestore');
        if (restoreBtn) restoreBtn.addEventListener('click', () => restoreDbFromBackup(last ? last.name : ''));
        const corruptBtn = document.getElementById('settingsDbCorrupt');
        if (corruptBtn) corruptBtn.addEventListener('click', () => {
          if (files.length) window.location.href = `/api/db/corrupt?name=${encodeURIComponent(files[0])}`;
        });
      }).catch(() => {
        dbInfo.innerHTML = '<span class="help">Status database tidak tersedia di server ini.</span>';
      });
    }
    const swResetBtn = document.getElementById('swResetBtn');
    if (swResetBtn) swResetBtn.addEventListener('click', async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        toast('Cache file dibersihkan. Memuat ulang…');
        setTimeout(() => { window.location.href = `/?_=${Date.now()}`; }, 700);
      } catch (err) {
        toast('Gagal membersihkan cache: ' + err.message, 'error');
      }
    });
    const importBtn = document.getElementById('importDataBtn');
    if (importBtn) importBtn.addEventListener('click', importBackupFile);
    const demoBtn = document.getElementById('demoDataBtn');
    if (demoBtn) demoBtn.addEventListener('click', () => {
      confirmDialog({
        title: t('settings.demo') + '?',
        message: 'Data contoh (tugas, catatan, jadwal, lomba, nilai, flashcard, kebiasaan) akan ditambahkan. Data yang sudah ada <strong>tidak dihapus</strong>.',
        confirmLabel: 'Isi data contoh',
        onConfirm: async () => {
          await api('/api/demo', { method: 'POST', body: { force: true } });
          toast('Data contoh ditambahkan');
          setTimeout(() => window.location.reload(), 900);
        },
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
  const leadMin = Math.max(1, Math.min(120, Number(state.settings.reminder_lead) || 10));
  const leadMs = leadMin * 60000;
  const leadLabel = leadMin === 1 ? '1 menit' : `${leadMin} menit`;
  eventsForDay(state.today).forEach((ev) => {
    if (!ev.time || ev.pseudo) return;
    const key = `ev-${ev.id}-${state.today}`;
    const start = parseLocalDT(`${state.today}T${String(ev.time).slice(0, 5)}`);
    const diff = start - now;
    if (diff > 0 && diff <= leadMs && !notified[key]) {
      notifyFallback(`Agenda ${leadLabel} lagi`, `${ev.title} · ${String(ev.time).slice(0, 5)}`);
      notified[key] = now; changed = true;
    }
  });
  (state.todayTasks.tasks || []).forEach((task) => {
    if (!task.start_time || task.done) return;
    const key = `task-${task.id}-${state.today}`;
    const start = parseLocalDT(`${state.today}T${String(task.start_time).slice(0, 5)}`);
    const diff = start - now;
    if (diff > 0 && diff <= leadMs && !notified[key]) {
      notifyFallback(`Tugas dalam ${leadLabel}`, `${task.title} · ${String(task.start_time).slice(0, 5)}`);
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
    ['Ctrl / ⌘ + N', 'Tugas baru — dari halaman mana pun'],
    ['Ctrl / ⌘ + Enter', 'Centang tugas yang terakhir disentuh / difokuskan'],
    ['Ctrl / ⌘ + D', 'Hapus tugas yang terakhir difokuskan'],
    ['Alt + H', 'Kembali ke Beranda'],
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
async function seedDemoData() {
  try {
    await api('/api/demo', { method: 'POST', body: {} });
    const overlay = $('#onboardOverlay');
    if (overlay) { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }
    toast('Data contoh dimuat. Membersihkan…');
    setTimeout(() => window.location.reload(), 900);
  } catch (err) {
    toast(err.message, 'error');
  }
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
    if (e.target.id === 'onboardDemo') {
      seedDemoData();
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

async function checkDbHealth() {
  const banner = $('#dbRecovery');
  if (!banner) return;
  try {
    const data = await api('/api/db/status');
    state.dbStatus = data;
    if (!data.corrupt_detected) { banner.hidden = true; return; }
    banner.hidden = false;
    const files = data.corrupt_files || [];
    const backups = data.backups || [];
    $('#dbRecoveryText').textContent = backups.length
      ? `File rusak: ${files[0] || 'tidak diketahui'}. Backup terakhir: ${backups[0].name}. Pulihkan untuk memasukkan kembali data terakhir — pengaturan & PIN tidak diubah.`
      : 'Tidak ada backup JSON terdeteksi. Unduh file rusak untuk inspeksi manual, lalu buat backup rutin ke depannya.';
    const corruptBtn = $('#dbCorruptBtn');
    if (corruptBtn) corruptBtn.disabled = !files.length;
  } catch { /* status endpoint tidak tersedia — diabaikan */ }
}

const TABLE_LABELS = {
  settings: 'Pengaturan', tasks: 'Tugas', task_templates: 'Rutinitas tugas', events: 'Agenda',
  competitions: 'Lomba', competition_tasks: 'Checklist lomba', notes: 'Catatan', schedule: 'Jadwal',
  focus_sessions: 'Sesi fokus', music_tracks: 'Musik', music_state: 'Status musik', streak: 'Streak',
  habits: 'Kebiasaan', habit_log: 'Log kebiasaan', grades: 'Nilai', flashcards: 'Flashcard', reminder: 'Pengingat',
};

function importTableLabel(table) {
  return TABLE_LABELS[table] || table;
}

function importSummaryText(preview) {
  return (preview.tables || [])
    .map((item) => `${importTableLabel(item.table)}: ${item.rows} baris`)
    .join(' · ');
}

function openImportPreview(payload, sourceName) {
  let preview = null;
  api('/api/db/preview', { method: 'POST', body: { data: payload } })
    .then((data) => {
      preview = data;
      const rows = (data.tables || []).map((item) => {
        const current = (data.current || {})[item.table] ?? 0;
        return `<label class="check-line compact import-row"><input type="checkbox" data-import-table="${esc(item.table)}" ${item.table === 'settings' ? '' : 'checked'} />
          <span><strong>${esc(importTableLabel(item.table))}</strong> ${item.rows} baris di backup · ${current} sekarang</span></label>`;
      }).join('');
      const body = `
        <div class="import-preview">
          <p class="hint" style="margin-top:0">Sumber: <strong>${esc(sourceName || 'file JSON')}</strong>${data.exported_at ? ` · diekspor ${esc(data.exported_at)}` : ''}</p>
          <p class="hint">Pilih tabel yang diganti. Snapshot database saat ini dibuat otomatis sebelum impor.</p>
          <div class="import-tables">${rows || '<p class="hint">Tidak ada tabel yang dikenali.</p>'}</div>
          <p class="hint" style="margin-bottom:0">PIN dan status kunci tidak pernah diimpor, meskipun “Pengaturan” dicentang.</p>
        </div>`;
      openModal({
        title: 'Impor backup JSON',
        eyebrow: 'Pratinjau',
        body,
        wide: true,
        submitLabel: 'Impor tabel terpilih',
        onSubmit: async (form) => {
          const selected = [...form.querySelectorAll('[data-import-table]:checked')].map((el) => el.dataset.importTable);
          if (!selected.length) throw new Error('Pilih minimal satu tabel');
          const res = await api('/api/db/import', { method: 'POST', body: { data: payload, tables: selected } });
          toast(`Impor selesai: ${res.rows || 0} baris${res.snapshot ? ` · snapshot ${res.snapshot}` : ''}`);
          setTimeout(() => window.location.reload(), 1200);
        },
      });
    })
    .catch((err) => toast(`Backup tidak valid: ${err.message}`, 'error', 7000));
}

function importBackupFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 25_000_000) { toast('File terlalu besar (maks 25 MB)', 'error'); return; }
    try {
      const payload = JSON.parse(await file.text());
      openImportPreview(payload, file.name);
    } catch (err) {
      toast(`File bukan JSON yang valid: ${err.message}`, 'error', 6000);
    }
  });
  input.click();
}

async function restoreDbFromBackup(name) {
  let summary = '';
  try {
    const preview = await api('/api/db/preview', { method: 'POST', body: name ? { name } : {} });
    summary = importSummaryText(preview);
  } catch (err) {
    toast(`Tidak bisa membaca backup: ${err.message}`, 'error', 6000);
    return;
  }
  confirmDialog({
    title: 'Pulihkan dari backup?',
    message: `Snapshot database saat ini dibuat otomatis, lalu tabel diganti dengan <strong>${esc(name || 'backup terbaru')}</strong>.<br><br><span class="hint">${esc(summary || 'Ringkasan tidak tersedia.')}</span><br><br>Pengaturan, tema, bahasa, dan PIN tetap dipertahankan.`,
    confirmLabel: 'Pulihkan data',
    onConfirm: async () => {
      const res = await api('/api/db/restore', { method: 'POST', body: name ? { name } : {} });
      toast(`Dipulihkan ${res.rows || 0} baris. Memuat ulang…`);
      setTimeout(() => window.location.reload(), 1200);
    },
  });
}

function bindDbRecovery() {
  const restore = $('#dbRestoreBtn');
  if (restore) restore.addEventListener('click', () => {
    const backups = (state.dbStatus && state.dbStatus.backups) || [];
    if (!backups.length) { toast('Belum ada backup JSON untuk dipulihkan', 'error'); return; }
    restoreDbFromBackup(backups[0].name);
  });
  const corrupt = $('#dbCorruptBtn');
  if (corrupt) corrupt.addEventListener('click', () => {
    const files = (state.dbStatus && state.dbStatus.corrupt_files) || [];
    if (!files.length) { toast('File rusak tidak ditemukan', 'error'); return; }
    window.location.href = `/api/db/corrupt?name=${encodeURIComponent(files[0])}`;
  });
  const dismiss = $('#dbDismissBtn');
  if (dismiss) dismiss.addEventListener('click', async () => {
    try { await api('/api/db/dismiss', { method: 'POST', body: {} }); } catch {}
    const banner = $('#dbRecovery');
    if (banner) banner.hidden = true;
    toast('Peringatan ditutup. Backup tetap tersedia di Pengaturan → Data.');
  });
}

function bindGlobal() {
  const navEl = document.querySelector('nav.nav');
  if (navEl) navEl.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (item && item.dataset.view) setView(item.dataset.view);
  });
  const topHome = $('#topHome');
  if (topHome) topHome.addEventListener('click', () => setView('beranda'));
  const sidebarToggle = $('#sidebarToggle');
  if (sidebarToggle) {
    const apply = (collapsed) => {
      document.documentElement.setAttribute('data-sidebar', collapsed ? 'collapsed' : 'expanded');
      sidebarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      sidebarToggle.title = collapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar';
      sidebarToggle.setAttribute('aria-label', sidebarToggle.title);
    };
    apply(state.settings.sidebar === 'collapsed');
    sidebarToggle.addEventListener('click', async () => {
      const collapsed = document.documentElement.getAttribute('data-sidebar') !== 'collapsed';
      apply(collapsed);
      state.settings.sidebar = collapsed ? 'collapsed' : 'expanded';
      try { await api('/api/settings', { method: 'POST', body: { sidebar: state.settings.sidebar } }); } catch {}
    });
  }
  $('#topWeather').addEventListener('click', () => setView('cuaca'));
  bindDbRecovery();
  const bindViewSearch = (id, key, render) => {
    const el = $(id);
    if (!el) return;
    el.value = state[key] || '';
    el.addEventListener('input', (e) => { state[key] = e.target.value; render(); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.target.value = ''; state[key] = ''; render(); }
    });
  };
  bindViewSearch('#compSearch', 'compQuery', renderCompetitionsView);
  bindViewSearch('#gradeSearch', 'gradeQuery', renderGradesView);
  bindViewSearch('#calendarSearch', 'eventQuery', renderCalendarView);
  const refreshAppBtn = $('#refreshApp');
  if (refreshAppBtn) refreshAppBtn.addEventListener('click', refreshApp);
  $('#topAvatar').addEventListener('click', openSettingsModal);
  $('#openSettings').addEventListener('click', openSettingsModal);
  $('#modalClose').addEventListener('click', closeModal);
  $('#refreshWeather').addEventListener('click', () => loadWeather(state.weather.key, true));
  $('#heroAddTask').addEventListener('click', () => openTaskModal(null, state.today));

  let lastFocusedTaskId = 0;
  document.addEventListener('focusin', (e) => {
    const item = e.target.closest && e.target.closest('.task-item');
    if (item && item.dataset.taskId) lastFocusedTaskId = Number(item.dataset.taskId);
  });
  document.addEventListener('keydown', (e) => {
    const isMac = /Mac/i.test(navigator.platform || '');
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key === 'Enter' && lastFocusedTaskId) {
      const t = [...(state.tasks.tasks || []), ...(state.todayTasks.tasks || [])].find((x) => x.id === lastFocusedTaskId);
      if (t && !t.done) { e.preventDefault(); toggleTask(t.id, true); return; }
    }
    if (mod && String(e.key).toLowerCase() === 'd' && lastFocusedTaskId) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
        const t = [...(state.tasks.tasks || []), ...(state.todayTasks.tasks || [])].find((x) => x.id === lastFocusedTaskId);
        if (t) { e.preventDefault(); const btn = document.querySelector(`[data-task-del="${t.id}"]`); if (btn) btn.click(); return; }
      }
    }
    if (mod && e.key === '/') { e.preventDefault(); openShortcutsHelp(); }
    if (mod && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'n') {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
        e.preventDefault();
        openTaskModal(null, state.taskDate || state.today);
      }
    }
    if (e.altKey && String(e.key).toLowerCase() === 'h') { e.preventDefault(); setView('beranda'); }
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
      if (found) {
        clearTimeout(noteClickTimer);
        noteClickTimer = setTimeout(() => openNoteModal(found), 260);
      }
      return;
    }
    if (e.target.closest('[data-note-new]')) { openNoteModal(); return; }

    const evEdit = e.target.closest('[data-ev-edit]');
    if (evEdit) {
      const found = state.events.find((ev) => ev.id === Number(evEdit.dataset.evEdit));
      if (!found) return;
      const base = found.seriesId ? state.events.find((ev) => ev.id === Number(found.seriesId) && !ev.seriesId) : found;
      if (base) openEventModal(base);
      return;
    }
    const evDel = e.target.closest('[data-ev-del]');
    if (evDel) {
      const found = state.events.find((ev) => ev.id === Number(evDel.dataset.evDel));
      if (!found) return;
      const base = found.seriesId ? state.events.find((ev) => ev.id === Number(found.seriesId) && !ev.seriesId) : found;
      if (!base) return;
      confirmDialog({
        title: base.repeat ? 'Hapus seluruh rangkaian agenda?' : 'Hapus agenda?',
        message: base.repeat
          ? `<strong>${esc(base.title)}</strong> diulang ${base.repeat === 'weekly' ? 'setiap minggu' : 'setiap bulan'} mulai ${esc(fmtLong(base.date))}. Semua kemunculannya akan dihapus.`
          : `<strong>${esc(base.title)}</strong> pada ${esc(fmtLong(base.date))} akan dihapus.`,
        confirmLabel: 'Hapus agenda',
        onConfirm: async () => {
          await api(`/api/events/${base.id}`, { method: 'DELETE' });
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
  bindExpenseActions();
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
function recordError(message) {
  try {
    storage.set('last_error', { message: String(message || '').slice(0, 1200), at: new Date().toISOString(), view: state.view, version: APP_VERSION });
  } catch { /* ignore */ }
}
function buildDiagnostics() {
  const last = storage.get('last_error', null);
  const lines = [
    `MyAct v${APP_VERSION}`,
    `Waktu: ${new Date().toISOString()}`,
    `Halaman: ${state.view || 'beranda'}`,
    `Tema: ${document.documentElement.getAttribute('data-theme') || '-'} / aksen ${document.documentElement.getAttribute('data-accent') || '-'}`,
    `Layar: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}`,
    `Bahasa: ${navigator.language || '-'} · TZ ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    `Browser: ${navigator.userAgent}`,
    last ? `Error terakhir (${last.at} di ${last.view || '-'}): ${last.message}` : 'Error terakhir: tidak ada',
  ];
  return lines.join('\n');
}
async function copyDiagnostics() {
  const text = buildDiagnostics();
  try {
    await navigator.clipboard.writeText(text);
    toast('Laporan disalin ke clipboard');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Laporan disalin ke clipboard'); }
    catch { toast('Gagal menyalin — buka konsol untuk menyalin manual', 'error'); console.log(text); }
    ta.remove();
  }
}
function showCrashOverlay(message) {
  recordError(message);
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
$('#crashCopy')?.addEventListener('click', copyDiagnostics);
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
      loadExpenses(),
      loadSchedule(),
      loadFocus(),
      loadWeather(state.weather.key),
    ]);
    state.booted = true;
    renderAll();
    checkDbHealth();
    const vNode = $('#appVersion');
    if (vNode) vNode.textContent = `v${APP_VERSION}`;

    if (typeof bindPalette === 'function') bindPalette();
    if (new URLSearchParams(window.location.search).get('open') === 'settings') {
      setTimeout(() => openSettingsModal(), 500);
    }
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
    const hashView = window.location.hash.replace(/^#\/?/, '');
    const initial = hashView || state.settings.default_view || 'beranda';
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
