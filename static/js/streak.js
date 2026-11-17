/* ============================================================
   Streak & Kebiasaan (multi-habit)
   ============================================================ */
let habitsCache = [];

async function loadHabits() {
  try {
    const d = await api('/api/habits');
    habitsCache = d.habits || [];
    renderHabitsView();
    loadActivity();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function habitStreakText(h) {
  if (!h) return '0';
  return String(h.current || 0);
}

function renderHabitsView() {
  const grid = $('#habitsGrid');
  const empty = $('#habitsEmpty');
  if (!grid) return;
  const today = todayStr();
  if (!habitsCache.length) {
    grid.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  renderAchievements();
  grid.innerHTML = habitsCache.map((h) => {
    const week = h.week || [];
    const todayEntry = week.find((s) => s.date === today);
    const doneToday = todayEntry ? Number(todayEntry.completed) === 1 : false;
    const days = week.map((s) => {
      const isToday = s.date === today;
      const done = Number(s.completed) === 1;
      const d = parseYMD(s.date);
      return `<button class="habit-day ${done ? 'done' : ''} ${isToday ? 'today' : ''}" data-habit-day="${esc(s.date)}" data-habit-id="${h.id}" title="${esc(fmtLong(s.date))}"><span>${DAYS_SHORT[d.getUTCDay()]}</span><span>${d.getUTCDate()}</span></button>`;
    }).join('');
    return `<div class="card habit-card" data-habit-id="${h.id}">
      <div class="habit-head">
        <div class="habit-ico">${iconSvg(h.icon || 'flame')}</div>
        <div><strong>${esc(h.name)}</strong><span>streak konsistensi</span></div>
        <button class="icon-btn xs" data-habit-del="${h.id}" title="Hapus kebiasaan" aria-label="Hapus kebiasaan" style="margin-left:auto"><span class="ico">${iconSvg('trash')}</span></button>
      </div>
      <div class="habit-streak">${habitStreakText(h)}<small> hari berturut-turut</small></div>
      <div class="habit-week">${days}</div>
      <div class="habit-foot">
        <span class="hint" style="margin:0">${doneToday ? 'Selesai hari ini 🎉' : 'Belum ditandai hari ini'}</span>
        <button class="btn ${doneToday ? 'btn-ghost' : 'btn-primary'} btn-sm" data-habit-toggle="${h.id}" data-done="${doneToday ? 1 : 0}">${doneToday ? `${iconSvg('rotate')} Batalkan` : `${iconSvg('check')} Tandai selesai`}</button>
      </div>
    </div>`;
  }).join('');
}

function renderAchievements() {
  const node = $('#achievementGrid');
  if (!node) return;
  const best = habitsCache.reduce((max, h) => Math.max(max, Number(h.best || h.current || 0)), 0);
  const current = habitsCache.reduce((max, h) => Math.max(max, Number(h.current || 0)), 0);
  const badges = [
    { days: 3, label: 'Awal yang baik', icon: 'sparkles' },
    { days: 7, label: 'Seminggu penuh', icon: 'flame' },
    { days: 30, label: 'Sebulan konsisten', icon: 'trophy' },
    { days: 100, label: '100 hari', icon: 'star' },
  ];
  node.innerHTML = badges.map((b) => {
    const unlocked = best >= b.days;
    return `<div class="achievement ${unlocked ? 'unlocked' : 'locked'}" title="${unlocked ? 'Terbuka' : `Butuh ${b.days} hari berturut-turut`}">
      <div class="ach-ico">${iconSvg(unlocked ? b.icon : 'lock')}</div>
      <strong>${b.days} hari</strong>
      <span>${b.label}</span>
      <div class="ach-bar"><span style="width:${Math.min(100, Math.round((current / b.days) * 100))}%"></span></div>
    </div>`;
  }).join('');
}

async function toggleHabit(habitId, done) {
  const today = todayStr();
  try {
    await api(`/api/habits/${habitId}/toggle`, { method: 'POST', body: { date: today, completed: done } });
    await loadHabits();
    if (done) toast('Kebiasaan ditandai selesai');
  } catch (err) { toast(err.message, 'error'); }
}

function openHabitModal() {
  const overlay = $('#habitOverlay');
  if (!overlay) return;
  overlay.hidden = false;
  $('#habitName').value = '';
  $('#habitIcon').value = 'flame';
  $('#habitError').classList.remove('show');
  setTimeout(() => $('#habitName').focus(), 40);
}
function closeHabitModal() {
  const overlay = $('#habitOverlay');
  if (overlay) overlay.hidden = true;
}

function bindHabitsActions() {
  const btn = $('#habitAdd');
  if (btn) btn.addEventListener('click', openHabitModal);
  $('#habitClose').addEventListener('click', closeHabitModal);
  $('#habitCancel').addEventListener('click', closeHabitModal);
  $('#habitOverlay').addEventListener('click', (e) => { if (e.target.id === 'habitOverlay') closeHabitModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHabitModal(); });

  $('#habitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = formValue(form, 'name');
    const icon = formValue(form, 'icon');
    const errBox = $('#habitError');
    errBox.classList.remove('show');
    if (!name) { errBox.textContent = 'Nama kebiasaan wajib diisi'; errBox.classList.add('show'); return; }
    try {
      await api('/api/habits', { method: 'POST', body: { name, icon } });
      closeHabitModal();
      await loadHabits();
      toast(`Kebiasaan "${name}" ditambahkan`);
    } catch (err) { errBox.textContent = err.message; errBox.classList.add('show'); }
  });

  document.addEventListener('click', async (e) => {
    const toggle = e.target.closest('[data-habit-toggle]');
    if (toggle) { const id = Number(toggle.dataset.habitToggle); const done = toggle.dataset.done !== '1'; await toggleHabit(id, done); return; }
    const dayBtn = e.target.closest('[data-habit-day]');
    if (dayBtn) {
      const id = Number(dayBtn.dataset.habitId);
      const date = dayBtn.dataset.habitDay;
      const habit = habitsCache.find((h) => h.id === id);
      const entry = (habit?.week || []).find((s) => s.date === date);
      const done = entry ? Number(entry.completed) !== 1 : true;
      await api(`/api/habits/${id}/toggle`, { method: 'POST', body: { date, completed: done } }).catch((err) => toast(err.message, 'error'));
      await loadHabits();
      return;
    }
    const del = e.target.closest('[data-habit-del]');
    if (del) {
      const id = Number(del.dataset.habitDel);
      const habit = habitsCache.find((h) => h.id === id);
      confirmDialog({
        title: 'Hapus kebiasaan?',
        message: `<strong>${esc(habit?.name || '')}</strong> beserta riwayat streak-nya akan dihapus.`,
        confirmLabel: 'Hapus kebiasaan',
        onConfirm: async () => {
          await api(`/api/habits/${id}`, { method: 'DELETE' });
          await loadHabits();
          toastUndo('Kebiasaan dipindahkan ke sampah', async () => {
            await api('/api/restore', { method: 'POST', body: { kind: 'habit', id } });
            await loadHabits();
          });
        },
      });
    }
  });
}

/* backward-compat aliases for older callers */
function loadStreak() { return loadHabits(); }
function renderStreakView() { renderHabitsView(); }
function bindStreakActions() { bindHabitsActions(); }

/* ---------- activity heatmap (F13) ---------- */
async function loadActivity() {
  const node = $('#activityHeatmap');
  if (!node) return;
  try {
    const d = await api('/api/activity');
    const days = d.days || [];
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    const maxScore = Math.max(1, ...days.map((d) => d.tasks + d.focus_min / 25 + d.habits));
    node.innerHTML = weeks.map((week) => `<div class="hm-col">${week.map((d) => {
      const score = d.tasks + d.focus_min / 25 + d.habits;
      const level = score <= 0 ? 0 : Math.min(4, Math.ceil((score / maxScore) * 4));
      return `<div class="hm-cell hm-${level}" title="${esc(d.date)} · ${d.tasks} tugas · ${d.focus_min} menit fokus"></div>`;
    }).join('')}</div>`).join('');
  } catch {
    node.innerHTML = '';
  }
}
