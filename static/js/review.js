/* ============================================================
   Weekly review — rekap minggu berjalan di Beranda
   ============================================================ */

async function loadWeeklyReview() {
  try {
    const d = await api('/api/weekly-review');
    const node = $('#weeklyReview');
    if (!node) return;
    const minimal = (state.settings.dashboard_mode || 'minimal') !== 'full';
    const focusDays = d.focus_days || [];
    const focusTotal = focusMinutesOf(d);
    $('#wrFocus').textContent = focusTotal >= 60 ? `${Math.floor(focusTotal / 60)} jam ${focusTotal % 60}m` : `${focusTotal} menit`;

    const done = d.tasks_done || 0, total = d.tasks_total || 0;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const ring = $('#wrRing');
    if (ring) ring.style.strokeDashoffset = String(188.5 * (1 - Math.min(1, done / Math.max(1, total))));

    const stats = [];
    stats.push(`<div class="wr-stat"><b>${done}/${total}</b><span>tugas selesai</span></div>`);
    stats.push(`<div class="wr-stat"><b>${d.streak || 0}</b><span>hari streak</span></div>`);
    stats.push(`<div class="wr-stat"><b>${d.habits_done_today || 0}/${d.habits_total || 0}</b><span>kebiasaan hari ini</span></div>`);
    if (d.upcoming && d.upcoming.length) {
      const u = d.upcoming[0];
      stats.push(`<div class="wr-stat"><b>${esc(String(u.deadline).slice(0, 10))}</b><span>deadline: ${esc(u.title.slice(0, 26))}</span></div>`);
    } else {
      stats.push(`<div class="wr-stat"><b>—</b><span>tidak ada deadline lomba</span></div>`);
    }
    $('#wrStats').innerHTML = stats.join('');
    node.hidden = minimal;
    if (typeof applyDashboardMode === 'function') applyDashboardMode();
  } catch (err) {
    /* silent — review bukan kritikal */
    console.warn('weekly-review gagal:', err);
  }
}

function focusMinutesOf(d) {
  return d.focus_total || 0;
}

async function loadWeeklyGoal() {
  try {
    const data = await api('/api/weekly-goal');
    state.weeklyGoal = data.goal || null;
    state.weeklyGoalLoaded = true;
    renderWeeklyGoal(data.week_start);
  } catch (err) { toast(err.message, 'error'); }
}

function renderWeeklyGoal(weekStart) {
  const input = $('#weeklyGoalInput');
  const hint = $('#weeklyGoalHint');
  const doneButton = $('#weeklyGoalDone');
  if (!input) return;
  const goal = state.weeklyGoal;
  input.value = goal ? goal.title : '';
  if (doneButton) {
    doneButton.classList.toggle('active', !!(goal && Number(goal.done)));
    doneButton.setAttribute('aria-pressed', goal && Number(goal.done) ? 'true' : 'false');
    doneButton.title = goal && Number(goal.done) ? 'Tandai belum selesai' : 'Tandai selesai';
  }
  if (hint) {
    const start = weekStart || (goal ? goal.week_start : null);
    hint.textContent = start ? `Minggu mulai ${fmtShort(start)} · satu target besar saja` : 'Tentukan satu target utama sampai akhir minggu ini.';
  }
}

async function bindWeeklyGoal() {
  const form = $('#weeklyGoalForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#weeklyGoalInput');
      const title = input ? input.value.trim() : '';
      if (!title) { toast('Tulis target mingguan dulu', 'error'); input?.focus(); return; }
      const data = await api('/api/weekly-goal', { method: 'POST', body: { title, done: !!(state.weeklyGoal && Number(state.weeklyGoal.done)) } });
      state.weeklyGoal = data.goal;
      renderWeeklyGoal(data.week_start);
      toast('Target minggu ini disimpan');
    });
  }
  const doneButton = $('#weeklyGoalDone');
  if (doneButton) doneButton.addEventListener('click', async () => {
    const current = state.weeklyGoal;
    const title = current ? current.title : ($('#weeklyGoalInput')?.value.trim() || '');
    if (!title) { toast('Isi target mingguan dulu', 'error'); return; }
    const data = await api('/api/weekly-goal', { method: 'POST', body: { title, done: !(current && Number(current.done)) } });
    state.weeklyGoal = data.goal;
    renderWeeklyGoal(data.week_start);
    toast(Number(data.goal.done) ? 'Target minggu ini selesai' : 'Target dibuka lagi');
  });
}

async function loadNightlyReview() {
  try {
    const data = await api(`/api/daily-review?date=${encodeURIComponent(state.today)}`);
    state.nightlyReview = data.review || null;
    state.nightlyReviewLoaded = true;
    renderNightlyReview();
  } catch (err) { toast(err.message, 'error'); }
}

function renderNightlyReview() {
  const section = $('#nightlyReview');
  if (!section) return;
  const hour = localTimeParts().h;
  const saved = state.nightlyReview;
  section.hidden = hour < 17 && !saved;
  const form = $('#nightlyReviewForm');
  if (!form) return;
  form.elements.wins.value = saved ? saved.wins || '' : '';
  form.elements.carried.value = saved ? saved.carried || '' : '';
  form.elements.tomorrow.value = saved ? saved.tomorrow || '' : '';
  const status = $('#nightlyReviewStatus');
  if (status) status.textContent = saved ? 'Review malam sudah tersimpan.' : 'Otomatis muncul setelah pukul 17.00.';
}

function bindNightlyReview() {
  const form = $('#nightlyReviewForm');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      date: state.today,
      wins: form.elements.wins.value.trim(),
      carried: form.elements.carried.value.trim(),
      tomorrow: form.elements.tomorrow.value.trim(),
    };
    if (!payload.wins && !payload.carried && !payload.tomorrow) { toast('Isi minimal satu bagian review', 'error'); return; }
    const data = await api('/api/daily-review', { method: 'POST', body: payload });
    state.nightlyReview = data.review;
    renderNightlyReview();
    toast('Review malam tersimpan');
  });
  const dismiss = $('#nightlyReviewDismiss');
  if (dismiss) dismiss.addEventListener('click', () => { const section = $('#nightlyReview'); if (section) section.hidden = true; });
}

