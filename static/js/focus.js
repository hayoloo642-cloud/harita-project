/* ============================================================
   Focus timer (Pomodoro)
   ============================================================ */
const focusTimer = {
  mode: 'focus',
  duration: 25 * 60,
  remaining: 25 * 60,
  running: false,
  endAt: null,
  label: '',
  subject: '',
  completing: false,
};
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 132;
const MODE_LABEL = { focus: 'Waktu fokus', short: 'Istirahat', long: 'Istirahat', custom: 'Deep work' };

function saveTimer() {
  storage.set('timer', {
    mode: focusTimer.mode,
    duration: focusTimer.duration,
    remaining: focusTimer.remaining,
    running: focusTimer.running,
    endAt: focusTimer.endAt,
    label: focusTimer.label,
    subject: focusTimer.subject,
  });
}

function restoreTimer() {
  const saved = storage.get('timer', null);
  if (!saved || !saved.duration) return;
  focusTimer.mode = saved.mode || 'focus';
  focusTimer.duration = saved.duration;
  focusTimer.remaining = saved.remaining ?? saved.duration;
  focusTimer.label = saved.label || '';
  focusTimer.subject = saved.subject || '';
  if (saved.running && saved.endAt) {
    const rem = Math.ceil((saved.endAt - Date.now()) / 1000);
    if (rem > 0) {
      focusTimer.running = true;
      focusTimer.endAt = saved.endAt;
      focusTimer.remaining = rem;
      requestAnimationFrame(tickTimer);
    } else {
      focusTimer.running = false;
      focusTimer.endAt = null;
      focusTimer.remaining = focusTimer.duration;
    }
  }
}

function fmtSecs(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

function updateTimerUI() {
  const display = $('#timerDisplay');
  if (!display) return;
  display.textContent = fmtSecs(focusTimer.remaining);
  const label = $('#timerLabel');
  const stateNode = $('#timerState');
  const fill = $('#timerFill');
  if (label) label.textContent = MODE_LABEL[focusTimer.mode] || 'Timer';
  if (stateNode) {
    stateNode.textContent = focusTimer.running
      ? (focusTimer.label ? focusTimer.label : 'Sedang berjalan…')
      : focusTimer.remaining < focusTimer.duration ? 'Dijeda' : 'Siap dimulai';
  }
  if (fill) {
    const pct = focusTimer.duration ? focusTimer.remaining / focusTimer.duration : 0;
    fill.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, pct))));
  }
  const startBtn = $('#timerStart');
  if (startBtn) {
    startBtn.innerHTML = focusTimer.running
      ? `${ico('pause')} Jeda`
      : `${ico('play')} ${focusTimer.remaining < focusTimer.duration ? 'Lanjutkan' : 'Mulai'}`;
  }
  $$('#focusModes .mode-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === focusTimer.mode));
  syncFocusMode();
}

function setTimerMode(mode, minutes) {
  if (focusTimer.running) {
    const go = window.confirm('Timer sedang berjalan. Ganti mode dan reset timer?');
    if (!go) return;
  }
  focusTimer.mode = mode;
  focusTimer.duration = Math.max(60, Number(minutes) * 60);
  focusTimer.remaining = focusTimer.duration;
  focusTimer.running = false;
  focusTimer.endAt = null;
  saveTimer();
  updateTimerUI();
}

function startPauseTimer() {
  if (focusTimer.running) {
    const rem = Math.max(0, Math.ceil((focusTimer.endAt - Date.now()) / 1000));
    focusTimer.remaining = rem;
    focusTimer.running = false;
    focusTimer.endAt = null;
    saveTimer();
    updateTimerUI();
    return;
  }
  if (focusTimer.remaining <= 0) focusTimer.remaining = focusTimer.duration;
  focusTimer.running = true;
  focusTimer.endAt = Date.now() + focusTimer.remaining * 1000;
  saveTimer();
  updateTimerUI();
  requestAnimationFrame(tickTimer);
  if (state.settings.notifications === '1' && Notification.permission === 'default') requestNotifications();
}

function resetTimer() {
  focusTimer.running = false;
  focusTimer.endAt = null;
  focusTimer.remaining = focusTimer.duration;
  saveTimer();
  updateTimerUI();
}

async function completeTimer() {
  if (focusTimer.completing) return;
  focusTimer.completing = true;
  focusTimer.running = false;
  focusTimer.endAt = null;
  const wasFocus = focusTimer.mode === 'focus' || focusTimer.mode === 'custom';
  const minutes = Math.round(focusTimer.duration / 60);
  chime();
  notify(wasFocus ? 'Sesi fokus selesai 🌿' : 'Istirahat selesai', wasFocus ? `${minutes} menit fokus tercatat. Waktunya istirahat sejenak.` : 'Siap kembali fokus?');
  if (wasFocus) {
    try {
      await api('/api/focus', { method: 'POST', body: { minutes, label: focusTimer.label, subject: focusTimer.subject || '' } });
      await loadFocus();
      toast(`Sesi ${minutes} menit selesai & tercatat`);
    } catch (err) { toast(err.message, 'error'); }
  } else {
    toast('Istirahat selesai — kembali fokus!');
  }
  focusTimer.remaining = focusTimer.duration;
  saveTimer();
  updateTimerUI();
  if (state.view === 'fokus') renderFocusView();
  focusTimer.completing = false;
}

let lastTimerDomUpdate = -1;
function tickTimer() {
  if (focusTimer.running && focusTimer.endAt) {
    const rem = Math.ceil((focusTimer.endAt - Date.now()) / 1000);
    if (rem <= 0) {
      completeTimer();
      lastTimerDomUpdate = -1;
    } else {
      focusTimer.remaining = rem;
      if (rem !== lastTimerDomUpdate) {           // update DOM at most once per second
        lastTimerDomUpdate = rem;
        updateTimerUI();
        if (state.settings.focus_tick === '1' && rem > 0 && typeof tickSound === 'function') tickSound();
      }
    }
  }
  if (focusTimer.running) {
    setTimeout(tickTimer, 200);                    // poll instead of 60fps rAF
  }
}
function renderFocusView() {
  const display = $('#timerDisplay');
  if (!display) return;
  updateTimerUI();
  updateFocusTaskOptions();

  const sessions = state.focus.sessions || [];
  const total = state.focus.total_minutes || 0;
  $('#focusTotal').textContent = total;
  $('#focusCount').textContent = sessions.length;
  const target = Math.min(100, Math.round((total / 100) * 100));
  $('#focusTarget').textContent = `${target}%`;
  $('#focusProgress').style.width = `${target}%`;
  $('#focusTodayTag').textContent = `${total} menit fokus hari ini`;


  // per-subject stats (7 days)
  loadFocusSubjects();
  loadFocusTrend();
  const list = $('#focusSessions');
  list.innerHTML = sessions.length
    ? sessions.slice(0, 6).map((s) => `
      <div class="session-row">${ico('check')}<span>${esc(s.label || 'Sesi fokus')}</span><time>${esc(String(s.created_at || '').slice(11, 16))} · ${s.minutes}m</time></div>`).join('')
    : `<p class="hint" style="margin-top:0">Belum ada sesi hari ini. Mulai satu sesi 25 menit — kecil tapi konsisten.</p>`;
}

function updateFocusTaskOptions() {
  const select = $('#focusTaskSelect');
  if (!select) return;
  const tasks = (state.todayTasks.tasks || []).filter((t) => !t.done);
  const current = focusTimer.label || select.value || '';
  select.innerHTML = `<option value="">Tanpa tugas spesifik</option>` +
    tasks.map((t) => `<option value="${esc(t.title)}">${esc(t.title)}</option>`).join('');
  if (current && !tasks.some((t) => t.title === current)) {
    select.innerHTML += `<option value="${esc(current)}">${esc(current)}</option>`;
  }
  select.value = current;

  // subject options from today's school schedule + common mapel
  const subjSel = $('#focusSubjectSelect');
  if (subjSel) {
    const fromSchedule = [...new Set((state.schedule || []).map((s) => s.subject || s.mata_pelajaran || '').filter(Boolean))];
    const common = ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Indonesia', 'Bahasa Inggris', 'Pemrograman Web', 'Jaringan Dasar', 'PKWU', 'PJOK'];
    const all = [...new Set([...fromSchedule, ...common])];
    const cur = focusTimer.subject || subjSel.value || '';
    subjSel.innerHTML = `<option value="">Tanpa mapel</option>` + all.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if (cur && !all.includes(cur)) subjSel.innerHTML += `<option value="${esc(cur)}">${esc(cur)}</option>`;
    subjSel.value = cur;
  }
}



/* ---------- focus stats per subject ---------- */
async function loadFocusSubjects() {
  const node = $('#focusSubjectStats');
  if (!node) return;
  try {
    const d = await api('/api/focus/stats');
    const rows = d.subjects || [];
    if (!rows.length) {
      node.innerHTML = '<p class="hint" style="margin:0">Belum ada sesi fokus dicatat minggu ini. Pilih mata pelajaran saat memulai sesi.</p>';
      return;
    }
    const max = Math.max(...rows.map((r) => r.minutes_7d), 1);
    node.innerHTML = rows.map((r) => `
      <div class="focus-subject-row"><strong>${esc(r.subject)}</strong><div class="fsr-bar"><div class="fsr-fill" style="width:${Math.round((r.minutes_7d / max) * 100)}%"></div></div><span>${r.minutes_7d}m · ${r.count} sesi</span></div>`).join('');
  } catch {
    node.innerHTML = '<p class="hint" style="margin:0">Statistik mapel belum tersedia.</p>';
  }
}

/* ---------- focus mode (fullscreen) ---------- */
function openFocusMode() {
  const o = $('#focusMode');
  if (!o) return;
  o.classList.add('open');
  o.setAttribute('aria-hidden', 'false');
  syncFocusMode();
  if (typeof window.__syncAmbient === 'function') window.__syncAmbient();
  if (window.ambientEngine && state.settings.ambient_sound && state.settings.ambient_sound !== 'off') {
    window.ambientEngine.play(state.settings.ambient_sound, (Number(state.settings.ambient_volume) || 35) / 100);
  }
  if (window.fmAmbient) window.fmAmbient.start('fmAmbientCanvas');
  // gelembung kecil saat masuk
  o.classList.remove('fm-enter');
  void o.offsetWidth;
  o.classList.add('fm-enter');
}
function closeFocusMode() {
  const o = $('#focusMode');
  if (!o) return;
  o.classList.remove('open');
  o.setAttribute('aria-hidden', 'true');
  if (window.ambientEngine) window.ambientEngine.stop();
  if (window.fmAmbient) window.fmAmbient.stop('fmAmbientCanvas');
}
const FM_RING = 2 * Math.PI * 96;
const FM_MODE_SUB = { focus: 'Pomodoro', short: 'Istirahat', long: 'Istirahat panjang', custom: 'Deep work' };

function syncFocusMode() {
  const time = $('#focusModeTime');
  if (!time) return;
  const overlay = $('#focusMode');
  if (overlay) overlay.classList.toggle('is-running', !!focusTimer.running);
  time.textContent = fmtSecs(focusTimer.remaining);
  const label = $('#focusModeLabel');
  if (label) label.textContent = MODE_LABEL[focusTimer.mode] || 'Fokus';
  const mode = $('#focusModeMode');
  if (mode) mode.textContent = FM_MODE_SUB[focusTimer.mode] || 'Fokus';
  const ring = $('#focusModeRing');
  if (ring) {
    const pct = focusTimer.duration ? Math.min(1, Math.max(0, focusTimer.remaining / focusTimer.duration)) : 0;
    ring.style.strokeDasharray = String(FM_RING);
    ring.style.strokeDashoffset = String(FM_RING * (1 - pct));
  }
  const ctx = $('#focusModeContextLabel');
  if (ctx) ctx.textContent = focusTimer.subject ? `📚 ${focusTimer.subject}` : 'Fokus bebas';
  const taskChip = $('#focusModeTaskLabel');
  if (taskChip) {
    if (focusTimer.label) {
      taskChip.textContent = `🎯 ${focusTimer.label}`;
      taskChip.hidden = false;
    } else {
      taskChip.textContent = '';
      taskChip.hidden = true;
    }
  }
  const toggle = $('#focusModeToggle');
  if (toggle) toggle.innerHTML = `<span class="ico">${iconSvg(focusTimer.running ? 'pause' : 'play')}</span>`;
}


/* ---------- focus trend (14 days) ---------- */
async function loadFocusTrend() {
  const node = $('#focusTrend');
  if (!node) return;
  try {
    const d = await api('/api/focus/history?days=14');
    const days = d.days || [];
    const total = days.reduce((a, b) => a + b.minutes, 0);
    const max = Math.max(...days.map((x) => x.minutes), 1);
    $('#focusTrendTotal').textContent = total >= 60 ? `${Math.floor(total / 60)}j ${total % 60}m total` : `${total} menit total`;
    node.innerHTML = days.map((x) => {
      const date = parseYMD(x.date);
      const isToday = x.date === todayStr();
      return `<div class="ft-col" title="${esc(fmtShort(x.date))} — ${x.minutes} menit"><div class="ft-bar ${isToday ? 'today' : ''}" style="height:${Math.max(3, Math.round((x.minutes / max) * 100))}%"></div><div class="ft-day">${date.getUTCDate()}</div><div class="ft-min">${x.minutes}</div></div>`;
    }).join('');
  } catch {
    node.innerHTML = '<p class="hint" style="margin:0;align-self:center">Tren belum tersedia.</p>';
  }
}

function bindFocusActions() {
  $('#timerStart').addEventListener('click', startPauseTimer);
  $('#timerReset').addEventListener('click', resetTimer);
  $('#focusModes').addEventListener('click', (e) => {
    const tab = e.target.closest('.mode-tab');
    if (!tab) return;
    const mode = tab.dataset.mode;
    if (mode === 'custom') {
      const customRow = $('#focusCustomRow');
      customRow.hidden = false;
      const minutes = Math.max(1, Math.min(240, Number($('#focusCustomMinutes').value) || 45));
      setTimerMode('custom', minutes);
      tab.textContent = `Kustom · ${minutes}`;
    } else {
      $('#focusCustomRow').hidden = true;
      setTimerMode(mode, Number(tab.dataset.min));
    }
    renderFocusView();
  });
  const customH = $('#focusCustomHours');
  const customM = $('#focusCustomMinutes');
  const customS = $('#focusCustomSeconds');
  function readCustomTime() {
    const h = Math.max(0, Math.min(23, Number(customH && customH.value) || 0));
    const m = Math.max(0, Math.min(59, Number(customM && customM.value) || 0));
    const s = Math.max(0, Math.min(59, Number(customS && customS.value) || 0));
    return (h * 3600) + (m * 60) + s;
  }
  function updateCustomSummary(total) {
    const summary = $('#customTimeSummary');
    if (!summary) return;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [];
    if (h) parts.push(`${h} jam`);
    if (m) parts.push(`${m} menit`);
    if (s) parts.push(`${s} detik`);
    summary.textContent = parts.length ? parts.join(' ') : '0 detik';
  }

  function applyCustomTime() {
    const total = readCustomTime();
    updateCustomSummary(total);
    if (focusTimer.mode === 'custom' && total > 0) {
      focusTimer.duration = total;
      focusTimer.remaining = total;
      focusTimer.running = false;
      focusTimer.endAt = null;
      saveTimer();
      const tab = $('#focusCustomTab');
      if (tab) tab.textContent = `Kustom · ${fmtSecs(total)}`;
      updateTimerUI();
      syncFocusMode();
    }
  }

  document.querySelectorAll('#focusCustomRow .ctg-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const h = Number(chip.dataset.h) || 0;
      const m = Number(chip.dataset.m) || 0;
      const s = Number(chip.dataset.s) || 0;
      const hours = $('#focusCustomHours');
      const minutes = $('#focusCustomMinutes');
      const seconds = $('#focusCustomSeconds');
      if (hours) hours.value = String(h);
      if (minutes) minutes.value = String(m);
      if (seconds) seconds.value = String(s);
      applyCustomTime();
    });
  });

  const h0 = $('#focusCustomHours'), m0 = $('#focusCustomMinutes'), s0 = $('#focusCustomSeconds');
  if (h0 && m0 && s0) {
    const total0 = (Number(h0.value) || 0) * 3600 + (Number(m0.value) || 0) * 60 + (Number(s0.value) || 0);
    updateCustomSummary(total0);
  }
  [customH, customM, customS].forEach((el) => {
    if (!el) return;
    el.addEventListener('change', applyCustomTime);
    el.addEventListener('input', applyCustomTime);
  });
  $('#focusTaskSelect').addEventListener('change', (e) => {
    focusTimer.label = e.target.value;
    saveTimer();
    updateTimerUI();
  });
  const subj = $('#focusSubjectSelect');
  if (subj) subj.addEventListener('change', (e) => { focusTimer.subject = e.target.value; saveTimer(); });
  // ambient sound engine
  const ambientBar = $('#ambientBar');
  const ambientToggle = $('#ambientToggle');
  const ambientVolume = $('#ambientVolume');
  const ambientVolumeValue = $('#ambientVolumeValue');
  const ambientChipsWrap = $('#ambientChips');

  function applyAmbientState() {
    const current = (state.settings.ambient_sound || 'off');
    if (ambientChipsWrap) {
      ambientChipsWrap.querySelectorAll('.fm-amb-chip').forEach((chip) => {
        if (chip.id === 'focusTickToggle') return;
        chip.classList.toggle('active', chip.dataset.amb === current);
      });
    }
    const tickBtn = document.getElementById('focusTickToggle');
    const tickOn = state.settings.focus_tick === '1';
    if (tickBtn) {
      tickBtn.classList.toggle('active', tickOn);
      tickBtn.setAttribute('aria-pressed', String(tickOn));
    }
    if (ambientToggle) {
      const on = current !== 'off';
      ambientToggle.setAttribute('aria-pressed', String(on));
      ambientToggle.textContent = on ? 'Aktif' : 'Mati';
      ambientToggle.classList.toggle('is-on', on);
    }
    if (ambientVolume && ambientVolumeValue) {
      ambientVolume.value = String(Number(state.settings.ambient_volume ?? 35));
      ambientVolumeValue.textContent = `${Number(state.settings.ambient_volume ?? 35)}%`;
    }
    if (window.ambientEngine) window.ambientEngine.setVolume((Number(state.settings.ambient_volume ?? 35)) / 100);

    const overlay = document.getElementById('focusMode');
    if (overlay) {
      ['ambient-rain','ambient-fire','ambient-ocean','ambient-forest','ambient-cafe','ambient-brown','ambient-river','ambient-beach','ambient-wind','ambient-white','ambient-night','ambient-breath','ambient-thunder','ambient-waterfall','ambient-train','ambient-library','ambient-cave','ambient-windchime','ambient-lofi','ambient-deep_space','ambient-city_rain','ambient-jungle','ambient-tide','ambient-aurora','ambient-bubble'].forEach((c) => overlay.classList.remove(c));
      if (current !== 'off') overlay.classList.add('ambient-' + current);
    }
    if (window.fmAmbient) window.fmAmbient.setAmbient(current, 'fmAmbientCanvas');
  }

  async function saveAmbientSettings(patch) {
    Object.assign(state.settings, patch);
    try {
      await api('/api/settings', { method: 'POST', body: patch });
    } catch (_) { /* keep local change anyway */ }
  }

  if (ambientChipsWrap) {
    ambientChipsWrap.addEventListener('click', async (e) => {
      const btn = e.target.closest('.fm-amb-chip');
      if (!btn) return;
      const name = btn.dataset.amb;
      await saveAmbientSettings({ ambient_sound: name, ambient_volume: state.settings.ambient_volume ?? 35 });
      if (window.ambientEngine) {
        if (name === 'off') window.ambientEngine.stop();
        else window.ambientEngine.play(name, (Number(state.settings.ambient_volume) || 35) / 100);
      }
      applyAmbientState();
    });
  }
  const tickToggle = $('#focusTickToggle');
  if (tickToggle) {
    tickToggle.addEventListener('click', async () => {
      const current = state.settings.focus_tick || '0';
      const next = current === '1' ? '0' : '1';
      await saveAmbientSettings({ focus_tick: next });
      applyAmbientState();
    });
  }
  const collapseBtn = $('#ambientCollapse');
  const ambientBody = $('#ambientBody');
  const collapseIcon = $('#ambientCollapseIcon');
  if (collapseBtn && ambientBody) {
    collapseBtn.addEventListener('click', () => {
      const collapsed = ambientBody.hidden;
      ambientBody.hidden = !collapsed;
      if (collapseIcon) collapseIcon.textContent = collapsed ? '▾' : '▸';
    });
  }

  if (ambientVolume) {
    ambientVolume.addEventListener('input', async (e) => {
      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      if (ambientVolumeValue) ambientVolumeValue.textContent = `${v}%`;
      await saveAmbientSettings({ ambient_volume: v });
      if (window.ambientEngine) window.ambientEngine.setVolume(v / 100);
    });
  }
  if (ambientToggle) {
    ambientToggle.addEventListener('click', async () => {
      const current = state.settings.ambient_sound || 'off';
      const next = current === 'off' ? 'rain' : 'off';
      await saveAmbientSettings({ ambient_sound: next });
      if (window.ambientEngine) {
        if (next === 'off') window.ambientEngine.stop();
        else window.ambientEngine.play(next, (Number(state.settings.ambient_volume) || 35) / 100);
      }
      applyAmbientState();
    });
  }

  $('#focusModeOpen').addEventListener('click', openFocusMode);
  $('#focusModeExit').addEventListener('click', closeFocusMode);
  $('#focusModeToggle').addEventListener('click', () => { startPauseTimer(); syncFocusMode(); });
  $('#focusModeReset').addEventListener('click', () => { resetTimer(); syncFocusMode(); });
  const skipBtn = $('#focusModeSkip');
  if (skipBtn) skipBtn.addEventListener('click', () => { completeTimer(); });

  // expose for syncFocusMode
  window.__syncAmbient = applyAmbientState;
}
