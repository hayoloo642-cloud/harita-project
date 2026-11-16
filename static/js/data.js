/* ============================================================
   Data loaders + weather helpers
   ============================================================ */
let tasksReqToken = 0;
let weatherLoadingRender = false;
let lastReminderCheck = 0;

async function loadBootstrap() {
  const data = await api('/api/bootstrap');
  state.settings = data.settings || {};
  state.locations = data.locations || {};
  state.today = data.today || todayStr();
  if (!state.locations[state.settings.location]) state.settings.location = state.weather.key;
  state.weather.key = state.settings.location || 'jakarta';
  state.cal.selected = state.today;
  state.cal.year = +state.today.slice(0, 4);
  state.cal.month = +state.today.slice(5, 7) - 1;
  state.mini.year = state.cal.year;
  state.mini.month = state.cal.month;
  state.taskDate = state.today;
  state.scheduleDay = dayOfWeek(state.today);
}

async function loadTasks(day = state.taskDate, { silent = false } = {}) {
  const token = ++tasksReqToken;
  state.taskDate = day;
  state.tasks.loading = true;
  if (!silent) renderTasksView();
  try {
    const data = await api(`/api/tasks?date=${encodeURIComponent(day)}`);
    if (token !== tasksReqToken) return;
    state.tasks = { date: data.date, tasks: data.tasks || [], templates: data.templates || [], loading: false };
    if (data.date === state.today) {
      state.todayTasks = { date: data.date, tasks: data.tasks || [], templates: data.templates || [] };
    }
    if (data.carried > 0 && day === state.today && !silent) {
      toast(`${data.carried} tugas belum selesai dibawa dari kemarin`);
    }
    if (state.view === 'tugas') renderTasksView();
    renderDashboard();
    updateNavBadge();
    updateFocusTaskOptions();
  } catch (err) {
    if (token !== tasksReqToken) return;
    state.tasks.loading = false;
    toast(err.message, 'error');
    if (state.view === 'tugas') renderTasksView();
  }
}

async function loadEvents() {
  try {
    const data = await api('/api/events');
    state.events = data.events || [];
    if (state.view === 'kalender') renderCalendarView();
    if (state.view === 'beranda') renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
}

async function loadCompetitions() {
  state.loading.competitions = true;
  try {
    const data = await api('/api/competitions');
    state.competitions = data.competitions || [];
    state.loading.competitions = false;
    if (state.view === 'lomba') renderCompetitionsView();
    if (state.view === 'beranda') renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
}

async function loadNotes() {
  state.loading.notes = true;
  try {
    const data = await api('/api/notes');
    state.notes = data.notes || [];
    state.loading.notes = false;
    renderNotesView();
    if (state.view === 'beranda') renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
}

async function loadSchedule() {
  state.loading.schedule = true;
  try {
    const data = await api('/api/schedule');
    state.schedule = data.schedule || [];
    state.loading.schedule = false;
    if (state.view === 'jadwal') renderScheduleView();
    if (state.view === 'beranda') renderDashboard();
  } catch (err) { toast(err.message, 'error'); }
}

async function loadFocus() {
  try {
    const data = await api(`/api/focus?date=${state.today}`);
    state.focus = { sessions: data.sessions || [], total_minutes: data.total_minutes || 0 };
    if (state.view === 'fokus') renderFocusView();
  } catch (err) { /* silent */ }
}

async function loadWeather(key = state.weather.key, force = false) {
  if (key && key !== state.weather.key) {
    state.weather = { key, data: null, stale: false, fetchedAt: null, loading: true, error: null };
  } else {
    state.weather.key = key || state.weather.key;
    state.weather.loading = true;
    state.weather.error = null;
  }
  renderHeroWeather();
  renderWeatherView();
  try {
    const data = await api(`/api/weather?loc=${encodeURIComponent(state.weather.key)}${force ? '&refresh=1' : ''}`);
    if (!data.ok) throw new Error(data.error || 'Gagal mengambil data cuaca');
    state.weather.data = data.data;
    state.weather.stale = !!data.stale;
    state.weather.fetchedAt = data.data.fetched_at;
    state.weather.error = null;
    try { storage.set(`weather:${key}`, data.data); } catch { /* ignore */ }
  } catch (err) {
    state.weather.error = err.message;
    // offline fallback: use last cached forecast from this device
    try {
      const cached = storage.get(`weather:${key}`);
      if (cached) {
        state.weather.data = cached;
        state.weather.stale = true;
        state.weather.error = null;
        toast('Cuaca: gagal memuat baru — menampilkan data tersimpan', 'error');
      } else {
        toast(`Cuaca: ${err.message}`, 'error');
      }
    } catch {
      toast(`Cuaca: ${err.message}`, 'error');
    }
  } finally {
    state.weather.loading = false;
    renderHeroWeather();
    renderWeatherView();
    renderTopWeather();
    if (state.view === 'beranda') renderDashboard();
  }
}

/* ============================================================
   Weather helpers
   ============================================================ */
function wx() { return state.weather.data; }

function currentHourIndex(data) {
  if (!data || !data.hourly) return 0;
  const prefix = `${todayStr()}T${pad2(localTimeParts().h)}`;
  const times = data.hourly.time || [];
  let idx = times.findIndex((t) => t.slice(0, 13) >= prefix);
  if (idx < 0) idx = 0;
  return idx;
}

function hoursFromNow(data, count = 8) {
  if (!data || !data.hourly) return [];
  const start = currentHourIndex(data);
  const out = [];
  for (let i = start; i < Math.min(start + count, data.hourly.time.length); i++) {
    out.push({
      index: i,
      time: data.hourly.time[i],
      temp: data.hourly.temperature_2m[i],
      code: data.hourly.weather_code[i],
      rain: data.hourly.precipitation_probability[i],
      isDay: data.hourly.is_day ? data.hourly.is_day[i] === 1 : true,
    });
  }
  return out;
}

function weekTempRange(data) {
  if (!data || !data.daily) return { min: 20, max: 34 };
  const min = Math.min(...data.daily.temperature_2m_min);
  const max = Math.max(...data.daily.temperature_2m_max);
  return { min, max: Math.max(max, min + 1) };
}

function compass(deg) {
  const dirs = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  return dirs[Math.round((Number(deg) || 0) / 45) % 8];
}

function rainNow(data) {
  if (!data || !data.hourly) return 0;
  const idx = currentHourIndex(data);
  return data.hourly.precipitation_probability[idx] ?? data.daily?.precipitation_probability_max?.[0] ?? 0;
}

function buildAdvice(data) {
  if (!data) return [];
  const daily = data.daily || {};
  const cur = data.current || {};
  const tips = [];
  const rain = daily.precipitation_probability_max?.[0] ?? 0;
  const uv = daily.uv_index_max?.[0] ?? 0;
  const wind = cur.wind_speed_10m ?? 0;
  const cat = wmoInfo(cur.weather_code).cat;

  if (rain >= 55) {
    tips.push({ icon: 'umbrella', title: 'Siapkan jas hujan / payung', text: `Peluang hujan ${rain}% hari ini. Simpan jas hujan di tas, terutama kalau pulang sekolah sore.` });
  } else if (rain >= 30) {
    tips.push({ icon: 'umbrella', title: 'Bawa payung lipat', text: `Ada peluang hujan ${rain}% — lebih aman tetap sedia payung.` });
  }
  if (cat === 'thunder') {
    tips.push({ icon: 'bolt', title: 'Waspada badai petir', text: 'Hindari berada di area terbuka saat petir, dan cabut perangkat yang tidak dipakai.' });
  }
  if (uv >= 8) {
    tips.push({ icon: 'sun', title: `UV tinggi (${Math.round(uv)})`, text: 'Pakai sunscreen dan topi saat keluar siang hari. Cari tempat teduh saat jam 11–15.' });
  }
  if (wind >= 25) {
    tips.push({ icon: 'wind', title: 'Angin cukup kencang', text: `Kecepatan angin ${Math.round(wind)} km/j. Hati-hati kalau naik motor dan saat membawa barang ringan.` });
  }
  if (!tips.length) {
    tips.push({ icon: 'check-circle', title: 'Cuaca bersahabat', text: 'Kondisi cukup aman untuk aktivitas luar. Tetap cek langit sebelum berangkat jauh.' });
    tips.push({ icon: 'droplets', title: 'Jaga hidrasi', text: 'Cuaca cukup hangat — bawa botol minum dan minum teratur.' });
  }
  return tips.slice(0, 3);
}

function weatherErrorHtml() {
  return `<div class="mini-empty">
    Gagal memuat cuaca.<br>${esc(state.weather.error || 'Periksa koneksi internet.')}
    <div style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-wx-retry>${ico('refresh')} Coba lagi</button></div>
  </div>`;
}

/* ============================================================
   Agenda / calendar helpers (dipakai beberapa view)
   ============================================================ */
function competitionDeadlineEvent(comp) {
  const day = (comp.deadline || '').slice(0, 10);
  if (!day) return null;
  const time = comp.deadline.length > 10 ? comp.deadline.slice(11, 16) : '';
  return {
    pseudo: true, id: `comp-${comp.id}`, title: comp.title, date: day, time,
    category: 'lomba', notes: 'Deadline lomba', compId: comp.id,
  };
}

function eventsForDay(day) {
  const list = state.events.filter((e) => e.date === day).map((e) => ({ ...e, pseudo: false }));
  state.competitions.forEach((c) => {
    const ev = competitionDeadlineEvent(c);
    if (ev && ev.date === day) list.push(ev);
  });
  return list.sort((a, b) => String(a.time || '99:99').localeCompare(String(b.time || '99:99')));
}

function agendaItemsFor(day) {
  const items = [];
  eventsForDay(day).forEach((e) => {
    items.push({
      kind: 'event', cat: e.category || 'pribadi', time: e.time || '', end: e.end_time || '',
      title: e.title, sub: CATEGORY_LABEL[e.category] || 'Agenda', pseudo: !!e.pseudo,
    });
  });
  state.schedule.filter((s) => Number(s.weekday) === dayOfWeek(day)).forEach((s) => {
    items.push({
      kind: 'schedule', cat: 'sekolah', time: s.start_time || '', end: s.end_time || '',
      title: s.subject, sub: s.room ? `Ruang ${s.room}` : 'Jadwal sekolah',
    });
  });
  return items.sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

function isNowItem(item) {
  if (!item.time) return false;
  const now = hhmmNow();
  const start = String(item.time).slice(0, 5);
  if (start > now) return false;
  if (item.end) return now <= String(item.end).slice(0, 5);
  const [h, m] = start.split(':').map(Number);
  const endMin = h * 60 + m + 60;
  const [nh, nm] = now.split(':').map(Number);
  return nh * 60 + nm <= endMin;
}

function buildCalendarCells(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - offset));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    cells.push({
      key: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
      inMonth: d.getUTCMonth() === month,
    });
  }
  return cells;
}

function shiftMonth(obj, delta) {
  const d = new Date(Date.UTC(obj.year, obj.month + delta, 1));
  obj.year = d.getUTCFullYear();
  obj.month = d.getUTCMonth();
}

/* ============================================================
   Countdown rendering
   ============================================================ */
function cdInner(mode, value) {
  const c = countdownParts(value);
  if (c.invalid) return '<strong>—</strong>';
  if (c.past) {
    return mode === 'mini'
      ? '<strong style="font-size:22px;background:none;-webkit-text-fill-color:var(--danger);color:var(--danger)">Lewat</strong>'
      : '<div><div class="cd-num" style="color:var(--danger)">Lewat</div><div class="cd-sub">deadline sudah terlewat</div></div><div class="cd-sub">Segera evaluasi</div>';
  }
  if (mode === 'mini') {
    if (c.days > 0) return `<strong>${c.days}</strong><span>hari</span>`;
    if (c.hours > 0) return `<strong>${c.hours}</strong><span>jam</span>`;
    return `<strong>${c.mins}</strong><span>menit</span>`;
  }
  return `<div><div class="cd-num">${c.days}<small>hari</small></div><div class="cd-sub">${c.hours} jam ${c.mins} menit lagi</div></div>
    <div class="cd-sub" style="text-align:right">Deadline<br><strong style="color:var(--muted);font-weight:550">${esc(fmtDeadline(value))}</strong></div>`;
}

function tickCountdowns() {
  $$('[data-cd]').forEach((node) => {
    node.innerHTML = cdInner(node.dataset.cdMode || 'mini', node.dataset.cd);
  });
}
