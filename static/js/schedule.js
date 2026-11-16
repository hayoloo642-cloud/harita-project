/* ============================================================
   School schedule
   ============================================================ */
function renderScheduleView() {
  const tabs = $('#weekdayTabs');
  if (!tabs) return;
  const todayDow = dayOfWeek(state.today);
  tabs.innerHTML = WEEK_ORDER.map((day) => `
    <button class="weekday-tab ${day === state.scheduleDay ? 'active' : ''} ${day === todayDow ? 'today' : ''}" data-weekday="${day}">
      ${DAYS[day]}
    </button>`).join('');

  const rows = state.schedule
    .filter((s) => Number(s.weekday) === Number(state.scheduleDay))
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

  const list = $('#scheduleList');
  list.innerHTML = rows.length ? rows.map((item) => `
    <div class="schedule-row">
      <div class="sch-time">${iconSvg('clock')} ${esc(String(item.start_time).slice(0, 5))}${item.end_time ? `–${esc(String(item.end_time).slice(0, 5))}` : ''}</div>
      <div class="sch-subject">${esc(item.subject)}${item.note ? `<span>${esc(item.note)}</span>` : ''}</div>
      <div class="sch-room">${item.room ? `Ruang ${esc(item.room)}` : '—'}</div>
      <div class="sch-actions">
        <button class="icon-btn" data-sch-edit="${item.id}" title="Edit" aria-label="Edit jadwal">${iconSvg('edit')}</button>
        <button class="icon-btn" data-sch-del="${item.id}" title="Hapus" aria-label="Hapus jadwal">${iconSvg('trash')}</button>
      </div>
    </div>`).join('')
    : `<div class="schedule-empty">${iconSvg('book')}Belum ada jadwal untuk hari ${DAYS[state.scheduleDay]}.<br>Tambahkan mata pelajaran, jam, dan ruangannya.</div>`;
}

function openScheduleModal(item = null) {
  const isEdit = !!item;
  const body = `
    <div class="form-grid">
      <div class="field">
        <label>Hari</label>
        <select name="weekday">
          ${WEEK_ORDER.map((day) => `<option value="${day}" ${Number(isEdit ? item.weekday : state.scheduleDay) === day ? 'selected' : ''}>${DAYS[day]}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Ruang (opsional)</label>
        <input name="room" maxlength="40" value="${esc(item ? item.room || '' : '')}" placeholder="Contoh: RPL 2" />
      </div>
      <div class="field full">
        <label>Mata pelajaran / kegiatan</label>
        <input name="subject" maxlength="120" required value="${esc(item ? item.subject : '')}" placeholder="Contoh: Pemrograman Web" />
      </div>
      <div class="field">
        <label>Jam mulai</label>
        <input type="time" name="start_time" required value="${esc(item ? String(item.start_time).slice(0, 5) : '07:00')}" />
      </div>
      <div class="field">
        <label>Jam selesai (opsional)</label>
        <input type="time" name="end_time" value="${esc(item && item.end_time ? String(item.end_time).slice(0, 5) : '')}" />
      </div>
      <div class="field full">
        <label>Catatan (opsional)</label>
        <input name="note" maxlength="160" value="${esc(item ? item.note || '' : '')}" placeholder="Contoh: bawa laptop, ulangan bab 3…" />
      </div>
    </div>`;
  openModal({
    title: isEdit ? 'Edit jadwal' : 'Tambah jadwal',
    eyebrow: 'Jadwal sekolah',
    body,
    submitLabel: isEdit ? 'Simpan perubahan' : 'Tambah jadwal',
    onDelete: isEdit ? async () => {
      confirmDialog({
        title: 'Hapus jadwal?',
        message: `<strong>${esc(item.subject)}</strong> pada hari ${DAYS[Number(item.weekday)]} akan dihapus.`,
        confirmLabel: 'Hapus jadwal',
        onConfirm: async () => {
          await api(`/api/schedule/${item.id}`, { method: 'DELETE' });
          await loadSchedule();
          toast('Jadwal dihapus');
        },
      });
    } : null,
    onSubmit: async (form) => {
      const payload = {
        weekday: Number(formValue(form, 'weekday')),
        subject: formValue(form, 'subject'),
        start_time: formValue(form, 'start_time'),
        end_time: formValue(form, 'end_time'),
        room: formValue(form, 'room'),
        note: formValue(form, 'note'),
      };
      if (!payload.subject) throw new Error('Mata pelajaran wajib diisi');
      if (!payload.start_time) throw new Error('Jam mulai wajib diisi');
      state.scheduleDay = payload.weekday;
      if (isEdit) {
        await api(`/api/schedule/${item.id}`, { method: 'PATCH', body: payload });
        toast('Jadwal diperbarui');
      } else {
        await api('/api/schedule', { method: 'POST', body: payload });
        toast('Jadwal ditambahkan');
      }
      await loadSchedule();
    },
  });
}

function bindScheduleActions() {
  $('#scheduleAdd').addEventListener('click', () => openScheduleModal());
  $('#weekdayTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-weekday]');
    if (!btn) return;
    state.scheduleDay = Number(btn.dataset.weekday);
    renderScheduleView();
  });
  $('#scheduleList').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-sch-edit]');
    if (edit) {
      const item = state.schedule.find((s) => s.id === Number(edit.dataset.schEdit));
      if (item) openScheduleModal(item);
      return;
    }
    const del = e.target.closest('[data-sch-del]');
    if (del) {
      const item = state.schedule.find((s) => s.id === Number(del.dataset.schDel));
      if (!item) return;
      confirmDialog({
        title: 'Hapus jadwal?',
        message: `<strong>${esc(item.subject)}</strong> pada hari ${DAYS[Number(item.weekday)]} akan dihapus.`,
        confirmLabel: 'Hapus jadwal',
        onConfirm: async () => {
          await api(`/api/schedule/${item.id}`, { method: 'DELETE' });
          await loadSchedule();
          toast('Jadwal dihapus');
        },
      });
    }
  });
}

/* ---------- CSV import ---------- */
function parseCsv(text) {
  const rows = [];
  let cur = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (field || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ''; }
      } else field += c;
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

function parseScheduleDay(v) {
  const s = String(v || '').trim().toLowerCase();
  const map = { senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6, minggu: 0, ahad: 0 };
  if (map[s] !== undefined) return map[s];
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0 && n <= 7) return n === 7 ? 0 : n;
  return null;
}

async function importScheduleCsv(file) {
  const text = await file.text();
  const raw = parseCsv(text.replace(/^﻿/, '')).filter((r) => r.length >= 3);
  const items = [];
  const skipped = [];
  for (const row of raw) {
    const signature = String(row[0] || '').trim().toLowerCase();
    if (signature === 'hari' || signature === 'day') continue;
    const day = parseScheduleDay(row[0]);
    const start = String(row[1] || '').trim();
    const subject = String(row[2] || '').trim();
    const room = String(row[3] || '').trim();
    const note = String(row[4] || '').trim();
    if (day === null || !start || !subject) { skipped.push(row.join(',')); continue; }
    const startNorm = start.slice(0, 5);
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(startNorm)) { skipped.push(row.join(',')); continue; }
    items.push({ weekday: day, start_time: startNorm, end_time: '', subject, room, note });
  }
  let ok = 0, fail = 0;
  for (const it of items) {
    try {
      await api('/api/schedule', { method: 'POST', body: it });
      ok++;
    } catch { fail++; }
  }
  await loadSchedule();
  if (!items.length) {
    toast('CSV tidak punya baris yang valid. Format: hari,jam,mapel,ruang,guru', 'error');
    return;
  }
  toast(`Import selesai: ${ok} ditambahkan${fail ? `, ${fail} gagal` : ''}${skipped.length ? `, ${skipped.length} baris dilewati` : ''}`, fail || skipped.length ? 'error' : 'ok');
}

(function bindScheduleCsvImport() {
  const btn = $('#scheduleImport');
  const input = $('#scheduleCsvFile');
  if (!btn || !input) return;
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try { await importScheduleCsv(file); } catch (err) { toast(err.message, 'error'); }
    input.value = '';
  });
})();
