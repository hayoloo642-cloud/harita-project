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
  beep(3);
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
}
function closeFocusMode() {
  const o = $('#focusMode');
  if (!o) return;
  o.classList.remove('open');
  o.setAttribute('aria-hidden', 'true');
}
function syncFocusMode() {
  const time = $('#focusModeTime');
  if (!time) return;
  time.textContent = fmtSecs(focusTimer.remaining);
  const label = $('#focusModeLabel');
  if (label) label.textContent = MODE_LABEL[focusTimer.mode] || 'Fokus';
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
  $('#focusCustomMinutes').addEventListener('change', (e) => {
    const minutes = Math.max(1, Math.min(240, Number(e.target.value) || 45));
    if (focusTimer.mode === 'custom') {
      focusTimer.duration = minutes * 60;
      focusTimer.remaining = minutes * 60;
      focusTimer.running = false;
      focusTimer.endAt = null;
      saveTimer();
      $('#focusCustomTab').textContent = `Kustom · ${minutes}`;
      updateTimerUI();
    }
  });
  $('#focusTaskSelect').addEventListener('change', (e) => {
    focusTimer.label = e.target.value;
    saveTimer();
    updateTimerUI();
  });
  const subj = $('#focusSubjectSelect');
  if (subj) subj.addEventListener('change', (e) => { focusTimer.subject = e.target.value; saveTimer(); });
  $('#focusModeOpen').addEventListener('click', openFocusMode);
  $('#focusModeExit').addEventListener('click', closeFocusMode);
  $('#focusModeToggle').addEventListener('click', () => { startPauseTimer(); syncFocusMode(); });
  $('#focusModeReset').addEventListener('click', () => { resetTimer(); syncFocusMode(); });
}
