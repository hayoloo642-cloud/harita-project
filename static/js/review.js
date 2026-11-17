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
