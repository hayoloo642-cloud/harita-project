/* ============================================================
   Dashboard + weather views
   ============================================================ */
const PAGE_META = {
  beranda: ['Ringkasan hari ini', 'Beranda'],
  cuaca: ['Realtime · Lokal', 'Cuaca'],
  tugas: ['Checklist harian', 'Tugas'],
  kalender: ['Agenda & jadwal', 'Kalender'],
  lomba: ['Deadline & persiapan', 'Lomba'],
  fokus: ['Pomodoro & produktivitas', 'Fokus'],
  catatan: ['Ide & materi', 'Catatan'],
  jadwal: ['Jadwal pelajaran', 'Jadwal'],
  nilai: ['Nilai & KKM', 'Nilai'],
  flashcard: ['Flashcard · SM-2', 'Flashcard'],
  device: ['Performa laptop', 'Device'],
  music: ['Music player', 'Musik'],
  streak: ['Streak konsistensi', 'Streak'],
};

function renderChrome() {
  const theme = state.settings.theme || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-accent", state.settings.accent || "terracotta");
  document.documentElement.setAttribute("data-font-size", state.settings.font_size || "normal");
  document.documentElement.setAttribute("data-contrast", state.settings.contrast || "normal");
  document.documentElement.setAttribute("data-sidebar", state.settings.sidebar === "collapsed" ? "collapsed" : "expanded");
  const tBtn = $('#topTheme');
  if (tBtn) {
    tBtn.querySelector(".ico").innerHTML = iconSvg(theme === "dark" ? "sun" : "moon");
    tBtn.title = theme === "dark" ? "Ganti ke terang" : "Ganti ke gelap";
  }
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === state.view));
  const meta = PAGE_META[state.view] || PAGE_META.beranda;
  $('#pageEyebrow').textContent = meta[0];
  $('#pageTitle').textContent = meta[1];
  const name = state.settings.name || 'Kamu';
  $('#greetName').textContent = name;
  const avatar = $('#topAvatar');
  if (avatar) avatar.textContent = name.trim().charAt(0).toUpperCase() || 'B';
  renderTopWeather();
  updateNavBadge();
}

function renderTopWeather() {
  const node = $('#topWeather');
  if (!node) return;
  const data = wx();
  if (!data) {
    node.innerHTML = `<span class="weather-chip-ico">${iconSvg('cloud-sun')}</span>
      <span class="weather-chip-temp">—</span>
      <span class="weather-chip-meta"><strong>${esc(state.locations[state.weather.key] || 'Lokal')}</strong><span>memuat…</span></span>`;
    return;
  }
  const cur = data.current;
  node.innerHTML = `<span class="weather-chip-ico">${weatherSvg(cur.weather_code, cur.is_day === 1)}</span>
    <span class="weather-chip-temp">${Math.round(cur.temperature_2m)}°</span>
    <span class="weather-chip-meta"><strong>${esc(state.locations[state.weather.key] || data.location_name || 'Lokal')}</strong><span>${esc(wmoInfo(cur.weather_code).label)}</span></span>`;
}

function renderHeroWeather() {
  const node = $('#heroWeather');
  if (!node) return;
  const data = wx();
  if (!data) {
    node.innerHTML = state.weather.error && !state.weather.loading
      ? weatherErrorHtml()
      : `<div class="skeleton-wx"></div>`;
    return;
  }
  const cur = data.current;
  const locName = state.locations[state.weather.key] || data.location_name || 'Lokal';
  const options = Object.entries(state.locations)
    .map(([key, name]) => `<option value="${key}" ${key === state.weather.key ? 'selected' : ''}>${esc(name)}</option>`)
    .join('');
  node.innerHTML = `
    <div class="hw-icon">${weatherSvg(cur.weather_code, cur.is_day === 1)}</div>
    <div class="hw-info">
      <div class="hero-temp">${Math.round(cur.temperature_2m)}<sup>°C</sup></div>
      <div class="hero-cond">${esc(wmoInfo(cur.weather_code).label)}</div>
      <label class="hero-loc" title="Ganti lokasi cuaca">
        ${ico('map-pin')}
        <select id="heroLocSelect" aria-label="Lokasi cuaca">${options}</select>
      </label>
      <div class="hw-meta">
        <span>${ico('thermometer')} ${Math.round(cur.apparent_temperature)}°</span>
        <span>${ico('droplets')} ${Math.round(cur.relative_humidity_2m)}%</span>
        <span>${ico('wind')} ${Math.round(cur.wind_speed_10m)} km/j</span>
      </div>
    </div>`;
}

function hourLabel(time, first) {
  if (first) return 'Kini';
  return String(time).slice(11, 16);
}

function renderHeroHourly() {
  const node = $('#heroHourly');
  if (!node) return;
  const data = wx();
  if (!data) {
    node.innerHTML = `<div class="hourly-empty">${state.weather.error ? 'Cuaca belum tersedia.' : 'Memuat prakiraan jam-jaman…'}</div>`;
    return;
  }
  const hours = hoursFromNow(data, 8);
  node.innerHTML = hours.map((h, i) => `
    <div class="hour-chip">
      <span class="hc-time">${hourLabel(h.time, i === 0)}</span>
      ${weatherSvg(h.code, h.isDay)}
      <span class="hc-temp">${Math.round(h.temp)}°</span>
      <span class="hc-rain">${h.rain != null ? `${Math.round(h.rain)}%` : ''}</span>
    </div>`).join('');
}

async function renderBerandaFocusSubjects() {
  const node = $('#berandaFocusSubjects');
  if (!node) return;
  try {
    const d = await api('/api/focus/stats');
    const rows = (d.subjects || []).slice(0, 3);
    if (!rows.length) {
      node.innerHTML = '<span class="hint" style="margin:0">Belum ada sesi fokus minggu ini — mulai dengan 25 menit, pilih mapelnya.</span>';
      return;
    }
    const max = Math.max(...rows.map((r) => r.minutes_7d), 1);
    let trend = '';
    try {
      const hist = await api('/api/focus/history?days=7');
      const days = hist.days || [];
      const peak = Math.max(...days.map((d) => d.minutes), 1);
      if (days.length) {
        trend = `<div class="focus-spark" aria-label="Tren fokus 7 hari">${days.map((d) => `
          <div class="fs-bar" title="${esc(fmtShort(d.date))}: ${d.minutes} menit"><span style="height:${Math.max(6, Math.round((d.minutes / peak) * 100))}%"></span></div>`).join('')}</div>`;
      }
    } catch { /* ignore */ }
    node.innerHTML = trend + rows.map((r) => `<div class="focus-subject-row"><strong>${esc(r.subject)}</strong><div class="fsr-bar"><div class="fsr-fill" style="width:${Math.round((r.minutes_7d / max) * 100)}%"></div></div><span>${r.minutes_7d}m</span></div>`).join('');
  } catch { node.innerHTML = ''; }
}

function renderDashboard() {
  if (!state.booted) return;
  renderHeroHourly();
  const name = esc(state.settings.name || 'Kamu');

  // header greeting + date
  const greetingNode = $('.greeting');
  if (greetingNode) greetingNode.innerHTML = `${greeting()}, <span id="greetName">${esc(name)}</span>`;
  const heroDay = $('#heroDay');
  const heroDate = $('#heroDate');
  if (heroDay) heroDay.textContent = DAYS[dayOfWeek(state.today)];
  if (heroDate) heroDate.textContent = `${parseYMD(state.today).getUTCDate()} ${MONTHS[parseYMD(state.today).getUTCMonth()]} ${parseYMD(state.today).getUTCFullYear()}`;

  const tasks = state.todayTasks.tasks || [];
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const open = total - done;
  const todayAgenda = agendaItemsFor(state.today);
  const activeComps = state.competitions.filter((c) => c.status !== 'selesai');
  const nextComp = activeComps
    .slice()
    .sort((a, b) => parseLocalDT(a.deadline) - parseLocalDT(b.deadline))
    .find((c) => !countdownParts(c.deadline).past) || activeComps[0];
  const rain = wx() ? rainNow(wx()) : null;

  // hero subtitle
  const bits = [];
  if (open) bits.push(`<b>${open} tugas</b> aktif`);
  if (todayAgenda.length) bits.push(`<b>${todayAgenda.length} agenda</b> hari ini`);
  if (rain != null && rain >= 40) bits.push(`peluang hujan <b>${Math.round(rain)}%</b>`);
  if (nextComp) bits.push(`lomba <b>${esc(countdownShort(nextComp.deadline))}</b> lagi`);
  const subNode = $('#heroSub');
  if (subNode) {
    subNode.innerHTML = bits.length
      ? `${bits.join(' · ')}. Semangat jalani harimu!`
      : 'Belum ada agenda hari ini. Waktu yang tepat untuk menyusun rencana dan istirahat cukup.';
  }

  renderBerandaFocusSubjects();
  // progress ring
  const pct = total ? Math.round((done / total) * 100) : 0;
  const ring = $('#ringFill');
  if (ring) ring.style.strokeDashoffset = String(339.3 * (1 - pct / 100));
  $('#statDone').textContent = done;
  $('#statTotal').textContent = total;

  // mini task list
  const miniNode = $('#heroTasks');
  const preview = tasks.slice(0, 4);
  miniNode.innerHTML = preview.length
    ? preview.map((t) => `
      <button class="task-mini ${t.done ? 'done' : ''}" data-task-toggle="${t.id}" data-done="${t.done}">
        <span class="tick">${iconSvg('check')}</span>
        <span class="t-title">${esc(t.title)}</span>
        ${t.start_time ? `<span class="t-time">${esc(String(t.start_time).slice(0, 5))}</span>` : ''}
      </button>`).join('')
    : `<div class="mini-empty">Belum ada tugas untuk hari ini.<br>Tambahkan satu hal kecil yang bisa kamu selesaikan.</div>`;

  // agenda
  const agendaNode = $('#heroAgenda');
  agendaNode.innerHTML = todayAgenda.length
    ? todayAgenda.slice(0, 7).map((item) => `
      <div class="agenda-item ${isNowItem(item) ? 'now' : ''}">
        <span class="agenda-time">${item.time ? esc(String(item.time).slice(0, 5)) : '—'}</span>
        <span class="agenda-dot" style="${item.kind === 'schedule' ? 'background:var(--cat-sekolah)' : item.cat === 'lomba' ? 'background:var(--cat-lomba)' : item.cat === 'ujian' ? 'background:var(--cat-ujian)' : ''}"></span>
        <div class="agenda-body">
          <strong title="${esc(item.title)}">${esc(item.title)}</strong>
          <span>${esc(item.sub)}${item.end ? ` · s/d ${esc(String(item.end).slice(0, 5))}` : ''}</span>
        </div>
      </div>`).join('')
    : `<div class="agenda-empty">${iconSvg('calendar')}<span>Belum ada agenda.<br>Tambahkan lewat menu Kalender.</span></div>`;

  // competitions mini
  const compBody = $('#compMiniBody');
  if (!nextComp) {
    compBody.innerHTML = `<div class="comp-empty">Belum ada lomba atau proyek.<br>Catat deadline-nya agar tidak terlewat.</div>
      <button class="btn btn-ghost btn-sm full" style="margin-top:auto" data-goto="lomba">${ico('plus')} Tambah lomba</button>`;
  } else {
    const c = countdownParts(nextComp.deadline);
    const totalChecks = (nextComp.tasks || []).length;
    const doneChecks = (nextComp.tasks || []).filter((t) => t.done).length;
    const checkPct = totalChecks ? Math.round((doneChecks / totalChecks) * 100) : 0;
    compBody.innerHTML = `
      <span class="comp-cat">${esc(nextComp.category || 'Lomba')}</span>
      <div class="comp-title">${esc(nextComp.title)}</div>
      <div class="countdown" data-cd="${esc(nextComp.deadline)}" data-cd-mode="mini">${cdInner('mini', nextComp.deadline)}</div>
      <div class="checklist" style="margin:2px 0 12px">
        ${(nextComp.tasks || []).slice(0, 3).map((t) => `<div class="check-row ${t.done ? 'done' : ''}"><span class="ico">${iconSvg(t.done ? 'check-circle' : 'circle')}</span>${esc(t.title)}</div>`).join('')}
      </div>
      <div class="comp-progress-mini">
        <div class="progress-meta"><span>Persiapan</span><span>${doneChecks}/${totalChecks}</span></div>
        <div class="progress-bar"><span style="width:${checkPct}%"></span></div>
      </div>
      ${c.past ? '<p class="hint" style="color:var(--danger)">Deadline terlewat — segera tandai selesai atau perbarui.</p>' : ''}`;
  }

  renderMiniCalendar();
  renderInsight(rain);
  renderNoteMini();
  renderTopWeather();
  updateNavBadge();
  renderDeviceQuickStats();
}

async function renderDeviceQuickStats() {
  try {
    const d = await api("/api/device");
    if (d.ok) {
      const dv = d.device;
      $('#dqsCpu').textContent = dv.cpu_percent + "%";
      $('#dqsRam').textContent = dv.memory.percent + "%";
      $('#dqsDisk').textContent = dv.disk.percent + "%";
      $('#dqsBatt').textContent = (dv.battery && dv.battery.percent != null ? dv.battery.percent + "%" : "—");
    }
  } catch (e) {
    // silent - device stats are optional on dashboard
  }
}

function renderMiniCalendar() {
  const node = $('#miniCalendar');
  if (!node) return;
  const { year, month } = state.mini;
  $('#miniCalTitle').textContent = fmtMonth(year, month);
  const heads = ['S', 'S', 'R', 'K', 'J', 'S', 'M'];
  const cells = buildCalendarCells(year, month);
  let html = heads.map((d) => `<span class="mc-head">${d}</span>`).join('');
  cells.forEach((cell) => {
    const evs = eventsForDay(cell.key);
    const cats = [...new Set(evs.map((e) => e.category || 'lain'))].slice(0, 3);
    html += `<button class="mc-day ${cell.inMonth ? '' : 'out'} ${cell.key === state.today ? 'today' : ''}" data-mini-day="${cell.key}" title="${esc(fmtLong(cell.key))}">
      <span>${cell.day}</span>
      <span class="mc-dots">${cats.map((cat) => `<span class="mc-dot" style="background:var(--cat-${cat})"></span>`).join('')}</span>
    </button>`;
  });
  node.innerHTML = html;
  const monthEvents = state.events.filter((e) => monthKey(e.date) === `${year}-${pad2(month + 1)}`);
  const nextEv = eventsForDay(state.today).length;
  $('#miniCalFoot').innerHTML = `<span>${monthEvents.length} agenda bulan ini</span><strong>${nextEv ? `${nextEv} hari ini` : 'Kosong'}</strong>`;
}

function renderInsight(rain) {
  const node = $('#insightGrid');
  if (!node) return;
  if (!wx()) {
    node.innerHTML = `<div class="insight-item wide"><div class="ii-ico">${iconSvg('cloud-sun')}</div><strong>Cuaca sedang dimuat</strong><span>Saran perjalanan dan aktivitas akan muncul setelah data cuaca tersedia.</span></div>`;
    return;
  }
  const data = wx();
  const daily = data.daily || {};
  const cur = data.current || {};
  const uv = daily.uv_index_max?.[0] ?? 0;
  const rainMax = daily.precipitation_probability_max?.[0] ?? rain ?? 0;
  const advice = buildAdvice(data)[0] || { icon: 'info', title: 'Cek cuaca berkala', text: 'Kondisi bisa berubah cepat.' };
  const highRainHour = (() => {
    if (!data.hourly) return null;
    const start = currentHourIndex(data);
    let best = -1, bestVal = -1;
    for (let i = start; i < Math.min(start + 12, data.hourly.time.length); i++) {
      const v = data.hourly.precipitation_probability[i] ?? -1;
      if (v > bestVal) { bestVal = v; best = i; }
    }
    return best >= 0 ? String(data.hourly.time[best]).slice(11, 16) : null;
  })();
  node.innerHTML = `
    <div class="insight-item">
      <div class="ii-ico">${iconSvg('umbrella')}</div>
      <strong>Hujan ${Math.round(rainMax)}%</strong>
      <span>${highRainHour ? `Puncaknya sekitar ${highRainHour} WITA.` : 'Pantau langit sebelum berangkat.'}</span>
    </div>
    <div class="insight-item">
      <div class="ii-ico" style="background:rgba(255,207,122,.1);color:var(--warm)">${iconSvg('sun')}</div>
      <strong>UV ${Math.round(uv)}</strong>
      <span>${uv >= 8 ? 'Tinggi — pakai sunscreen & topi.' : uv >= 5 ? 'Sedang — tetap jaga kulit.' : 'Aman untuk aktivitas luar.'}</span>
    </div>
    <div class="insight-item">
      <div class="ii-ico" style="background:rgba(109,155,255,.12);color:var(--accent-2)">${iconSvg('wind')}</div>
      <strong>${Math.round(cur.wind_speed_10m || 0)} km/j</strong>
      <span>Angin dari arah ${compass(cur.wind_direction_10m)} · ${cur.wind_gusts_10m ? `hembusan ${Math.round(cur.wind_gusts_10m)} km/j` : 'normal'}.</span>
    </div>
    <div class="insight-item advice wide">
      <div class="ii-ico">${iconSvg(advice.icon)}</div>
      <strong>${esc(advice.title)}</strong>
      <span>${esc(advice.text)}</span>
    </div>`;
}

function renderNoteMini() {
  const body = $('#noteMiniBody');
  if (!body) return;
  const note = state.notes.find((n) => n.pinned) || state.notes[0];
  if (!note) {
    body.innerHTML = `<p class="hint">Belum ada catatan. Simpan ide, rumus, atau materi lomba di sini.</p>
      <button class="btn btn-ghost btn-sm full" data-note-new>${ico('plus')} Tulis catatan</button>`;
    return;
  }
  body.innerHTML = `
    <span class="note-pin-tag">${ico('pin')} ${note.pinned ? 'Disematkan' : 'Terbaru'}</span>
    <div class="note-preview" style="margin-top:8px"><strong style="color:var(--text);display:block;font-size:12.5px;margin-bottom:3px">${esc(note.title)}</strong>${esc(note.body || '')}</div>
    <button class="link-btn" style="margin-top:10px;padding:0" data-note-edit="${note.id}">Buka catatan ${iconSvg('arrow-up-right')}</button>`;
}

function updateNavBadge() {
  const badge = $('#navTaskBadge');
  if (!badge) return;
  const open = (state.todayTasks.tasks || []).filter((t) => !t.done).length;
  badge.hidden = open === 0;
  badge.textContent = open > 99 ? '99+' : String(open);
}

/* ============================================================
   Weather view
   ============================================================ */
function renderWeatherView() {
  const pills = $('#locationPills');
  if (!pills) return;
  pills.innerHTML = Object.entries(state.locations).map(([key, name]) =>
    `<button class="loc-pill ${key === state.weather.key ? 'active' : ''}" data-loc="${key}">${esc(name)}</button>`).join('');

  const data = wx();
  const updated = $('#weatherUpdated');
  if (updated) {
    if (data) {
      const stamp = String(data.fetched_at || '').slice(11, 16);
      updated.textContent = `Diperbarui ${stamp} WITA${state.weather.stale ? ' · cache' : ''}`;
    } else updated.textContent = '—';
  }

  const curNode = $('#wxCurrent');
  const detailNode = $('#wxDetails');
  const adviceNode = $('#wxAdvice');
  const hourlyNode = $('#wxHourly');
  const dailyNode = $('#wxDaily');

  if (!data) {
    const msg = state.weather.loading
      ? `<div style="display:flex;align-items:center;gap:9px;color:var(--faint);font-size:12px">${iconSvg('spinner', 'spin')} Memuat data cuaca…</div>`
      : weatherErrorHtml();
    curNode.innerHTML = msg;
    detailNode.innerHTML = '';
    adviceNode.innerHTML = '';
    hourlyNode.innerHTML = '';
    dailyNode.innerHTML = '';
    return;
  }

  const cur = data.current;
  const daily = data.daily;
  const locName = state.locations[state.weather.key] || data.location_name;
  const info = wmoInfo(cur.weather_code);
  curNode.innerHTML = `
    <div class="wx-current-top">
      <div>
        <p class="eyebrow">Saat ini · ${esc(locName)}</p>
        <div class="wx-big">
          ${weatherSvg(cur.weather_code, cur.is_day === 1)}
          <div class="wx-big-temp">${Math.round(cur.temperature_2m)}<sup>°C</sup></div>
        </div>
        <div class="wx-cond">${esc(info.label)}</div>
        <div class="wx-feels">Terasa seperti ${Math.round(cur.apparent_temperature)}°C</div>
        <div class="wx-locline">${ico('map-pin')} ${esc(locName)} <span style="color:var(--faint)">· ${cur.is_day === 1 ? 'Siang' : 'Malam'} · ${Math.round(cur.cloud_cover)}% awan</span></div>
      </div>
      <div class="wx-daynight">${ico(cur.is_day === 1 ? 'sun' : 'moon')} ${cur.is_day === 1 ? 'Siang' : 'Malam'}</div>
    </div>
    <div class="hw-meta" style="justify-content:flex-start;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07);gap:18px">
      <span>${ico('droplets')} ${Math.round(cur.relative_humidity_2m)}%</span>
      <span>${ico('wind')} ${Math.round(cur.wind_speed_10m)} km/j ${compass(cur.wind_direction_10m)}</span>
      <span>${ico('umbrella')} ${Math.round(rainNow(data))}% hujan</span>
    </div>`;

  detailNode.innerHTML = `
    <div class="card-head"><div><p class="eyebrow">Rincian</p><h3>Kondisi saat ini</h3></div></div>
    <div class="detail-grid">
      <div class="detail-tile"><div class="dt-label">${iconSvg('droplets')} Kelembapan</div><strong>${Math.round(cur.relative_humidity_2m)}%</strong><span>udara</span></div>
      <div class="detail-tile"><div class="dt-label">${iconSvg('gauge')} Tekanan</div><strong>${Math.round(cur.pressure_msl)}</strong><span>hPa</span></div>
      <div class="detail-tile"><div class="dt-label">${iconSvg('wind')} Angin</div><strong>${Math.round(cur.wind_speed_10m)} <small style="font-size:9px;color:var(--faint)">km/j</small></strong><span>dari ${compass(cur.wind_direction_10m)}</span></div>
      <div class="detail-tile"><div class="dt-label">${iconSvg('sun')} UV maks</div><strong>${Math.round(daily.uv_index_max?.[0] ?? 0)}</strong><span>${(daily.uv_index_max?.[0] ?? 0) >= 8 ? 'sangat tinggi' : (daily.uv_index_max?.[0] ?? 0) >= 5 ? 'sedang' : 'rendah'}</span></div>
      <div class="detail-tile"><div class="dt-label">${iconSvg('umbrella')} Peluang hujan</div><strong>${Math.round(daily.precipitation_probability_max?.[0] ?? 0)}%</strong><span>hari ini</span></div>
      <div class="detail-tile"><div class="dt-label">${iconSvg('cloud-sun')} Tutup awan</div><strong>${Math.round(cur.cloud_cover)}%</strong><span>langit</span></div>
    </div>`;

  const advice = buildAdvice(data);
  adviceNode.innerHTML = `
    <div class="card-head"><div><p class="eyebrow">Rekomendasi</p><h3>Siapkan harimu</h3></div></div>
    <div class="advice-list">
      ${advice.map((a) => `<div class="advice-row"><span class="ai">${iconSvg(a.icon)}</span><div><strong>${esc(a.title)}</strong><span>${esc(a.text)}</span></div></div>`).join('')}
    </div>
    <div class="sun-row">
      <div class="sun-item">${iconSvg('sunrise')}<div><span>Terbit</span><strong>${esc(String(daily.sunrise?.[0] || '').slice(11, 16))}</strong></div></div>
      <div class="sun-item">${iconSvg('sunset')}<div><span>Terbenam</span><strong>${esc(String(daily.sunset?.[0] || '').slice(11, 16))}</strong></div></div>
    </div>`;

  const hours = hoursFromNow(data, 24);
  hourlyNode.innerHTML = hours.map((h, i) => `
    <div class="hour-chip">
      <span class="hc-time">${i === 0 ? 'Kini' : h.time.slice(11, 16)}</span>
      ${weatherSvg(h.code, h.isDay)}
      <span class="hc-temp">${Math.round(h.temp)}°</span>
      <span class="hc-rain">${Math.round(h.rain)}% hujan</span>
    </div>`).join('');

  const range = weekTempRange(data);
  dailyNode.innerHTML = daily.time.map((day, i) => {
    const lo = daily.temperature_2m_min[i];
    const hi = daily.temperature_2m_max[i];
    const left = ((lo - range.min) / (range.max - range.min)) * 100;
    const width = Math.max(8, ((hi - lo) / (range.max - range.min)) * 100);
    return `<div class="daily-row">
      <div class="daily-day">${i === 0 ? 'Hari ini' : DAYS[dayOfWeek(day)]}<span>${parseYMD(day).getUTCDate()} ${MONTHS_SHORT[parseYMD(day).getUTCMonth()]}</span></div>
      ${weatherSvg(daily.weather_code[i], true)}
      <div class="daily-rain">${iconSvg('umbrella')} ${Math.round(daily.precipitation_probability_max?.[i] ?? 0)}%</div>
      <div class="temp-track"><span class="temp-fill" style="left:${left}%;width:${width}%"></span></div>
      <div class="temp-labels"><span class="lo">${Math.round(lo)}°</span><span class="hi">${Math.round(hi)}°</span></div>
    </div>`;
  }).join('');
}
