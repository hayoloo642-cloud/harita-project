/* ============================================================
   Calendar view
   ============================================================ */
function renderCalendarView() {
  const grid = $('#calGrid');
  if (!grid) return;
  const { year, month, selected } = state.cal;
  $('#calTitle').textContent = fmtMonth(year, month);

  const cells = buildCalendarCells(year, month);
  grid.innerHTML = cells.map((cell) => {
    const evs = eventsForDay(cell.key);
    const chips = evs.slice(0, 3).map((ev) => `
      <span class="cal-ev cat-${esc(ev.category || 'lain')}" title="${esc(ev.title)}">${esc(ev.title)}</span>`).join('');
    const more = evs.length > 3 ? `<span class="cal-more">+${evs.length - 3} lagi</span>` : '';
    return `<button class="cal-cell ${cell.inMonth ? '' : 'out'} ${cell.key === state.today ? 'today' : ''} ${cell.key === selected ? 'sel' : ''}" data-cal-day="${cell.key}">
      <span class="cal-date">${cell.day}</span>
      ${chips}${more}
    </button>`;
  }).join('');

  const query = (state.eventQuery || '').trim().toLowerCase();
  const selectedDate = parseYMD(selected);
  let events;
  if (query) {
    const seen = new Set();
    events = state.events
      .filter((ev) => `${ev.title} ${ev.notes || ''} ${CATEGORY_LABEL[ev.category] || ''}`.toLowerCase().includes(query))
      .filter((ev) => { const key = `${ev.title}|${ev.date}`; if (seen.has(key)) return false; seen.add(key); return true; })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 40);
    $('#calSideTitle').textContent = `Hasil pencarian · ${events.length}`;
  } else {
    $('#calSideTitle').textContent = `${DAYS[selectedDate.getUTCDay()]}, ${selectedDate.getUTCDate()} ${MONTHS_SHORT[selectedDate.getUTCMonth()]}`;
    events = eventsForDay(selected);
  }
  const sideList = $('#calSideList');
  sideList.innerHTML = events.length ? events.map((ev) => `
    <div class="side-ev cat-${esc(ev.category || 'lain')}">
      <div class="side-ev-top">
        <div>
          <strong>${esc(ev.title)}</strong>
          <span class="sev-time">${iconSvg('clock')} ${query ? `${esc(fmtShort(ev.date))} · ` : ''}${ev.pseudo ? 'Deadline lomba' : (CATEGORY_LABEL[ev.category] || 'Agenda')}${ev.time ? ` · ${esc(String(ev.time).slice(0, 5))}` : ' · sepanjang hari'}${ev.end_time ? `–${esc(String(ev.end_time).slice(0, 5))}` : ''}</span>
        </div>
        ${ev.pseudo
          ? `<button class="icon-btn" data-goto="lomba" title="Buka lomba">${iconSvg('arrow-up-right')}</button>`
          : `<div class="sev-actions">
              <button class="icon-btn" data-ev-edit="${ev.id}" title="Edit agenda">${iconSvg('edit')}</button>
              <button class="icon-btn" data-ev-del="${ev.id}" title="Hapus agenda">${iconSvg('trash')}</button>
            </div>`}
      </div>
      ${ev.notes ? `<p>${esc(ev.notes)}</p>` : ''}
      ${ev.pseudo ? '<p>Lihat detail persiapan di menu Lomba.</p>' : ''}
    </div>`).join('')
    : `<div class="side-empty">
        <div class="empty-state-ico" style="margin:0 auto 10px"><span class="ico">${iconSvg('search')}</span></div>
        <strong>${query ? 'Tidak ada yang cocok' : 'Tidak ada agenda'}</strong>
        <span style="font-size:10px;color:var(--faint)">Tambahkan agenda atau batas waktu lomba kamu.</span>
        <button class="btn btn-primary btn-sm" style="margin-top:10px" data-ev-add>${iconSvg('plus')} Agenda baru</button>
      </div>`;

  const addBtn = $('#calSideAdd');
  addBtn.onclick = () => openEventModal(null, selected);
}

function openEventModal(event = null, presetDate = null) {
  const isEdit = !!event;
  const day = event ? event.date : (presetDate || state.cal.selected || state.today);
  const body = `
    <div class="form-grid">
      <div class="field full">
        <label>Nama agenda</label>
        <input name="title" maxlength="160" required value="${esc(event ? event.title : '')}" placeholder="Contoh: Latihan lomba web design" />
      </div>
      <div class="field">
        <label>Tanggal</label>
        <input type="date" name="date" required value="${esc(day)}" />
      </div>
      <div class="field">
        <label>Kategori</label>
        <select name="category">
          ${Object.entries(CATEGORY_LABEL).map(([value, label]) => `<option value="${value}" ${(event ? event.category === value : value === 'pribadi') ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Mulai (opsional)</label>
        <input type="time" name="time" value="${esc(event && event.time ? String(event.time).slice(0, 5) : '')}" />
      </div>
      <div class="field">
        <label>Selesai (opsional)</label>
        <input type="time" name="end_time" value="${esc(event && event.end_time ? String(event.end_time).slice(0, 5) : '')}" />
      </div>
      <div class="field">
        <label>Ulangi</label>
        <select name="repeat">
          <option value="" ${!event || !event.repeat ? 'selected' : ''}>Tidak diulang</option>
          <option value="weekly" ${event && event.repeat === 'weekly' ? 'selected' : ''}>Setiap minggu</option>
          <option value="monthly" ${event && event.repeat === 'monthly' ? 'selected' : ''}>Setiap bulan</option>
        </select>
      </div>
      <div class="field full">
        <label>Catatan (opsional)</label>
        <textarea name="notes" placeholder="Lokasi, orang yang diajak, hal yang perlu dibawa…">${esc(event ? event.notes || '' : '')}</textarea>
      </div>
    </div>`;
  openModal({
    title: isEdit ? 'Edit agenda' : 'Agenda baru',
    eyebrow: isEdit ? fmtMedium(day) : 'Kalender',
    body,
    submitLabel: isEdit ? 'Simpan perubahan' : 'Tambah agenda',
    onDelete: isEdit ? async () => {
      confirmDialog({
        title: 'Hapus agenda?',
        message: `<strong>${esc(event.title)}</strong> pada ${esc(fmtLong(event.date))} akan dihapus.`,
        confirmLabel: 'Hapus agenda',
        onConfirm: async () => {
          await api(`/api/events/${event.id}`, { method: 'DELETE' });
          await loadEvents();
          renderCalendarView();
          toastUndo('Agenda dipindahkan ke sampah', async () => {
            await api('/api/restore', { method: 'POST', body: { kind: 'event', id: event.id } });
            await loadEvents();
            renderCalendarView();
          });
        },
      });
    } : null,
    onSubmit: async (form) => {
      const payload = {
        title: formValue(form, 'title'),
        date: formValue(form, 'date'),
        time: formValue(form, 'time'),
        end_time: formValue(form, 'end_time'),
        category: formValue(form, 'category') || 'pribadi',
        repeat: formValue(form, 'repeat') || '',
        notes: formValue(form, 'notes'),
      };
      if (!payload.title) throw new Error('Nama agenda wajib diisi');
      if (isEdit) {
        await api(`/api/events/${event.id}`, { method: 'PATCH', body: payload });
        toast('Agenda diperbarui');
      } else {
        await api('/api/events', { method: 'POST', body: payload });
        toast('Agenda ditambahkan');
      }
      state.cal.selected = payload.date;
      state.cal.year = +payload.date.slice(0, 4);
      state.cal.month = +payload.date.slice(5, 7) - 1;
      await loadEvents();
      renderCalendarView();
    },
  });
}

function shiftCalendar(delta) {
  shiftMonth(state.cal, delta);
  const key = `${state.cal.year}-${pad2(state.cal.month + 1)}-01`;
  state.cal.selected = monthKey(state.today) === monthKey(key) ? state.today : key;
  renderCalendarView();
}

function parseIcsDate(dt) {
  const v = String(dt || '').trim();
  if (!v) return { date: '', time: '' };
  const d = v.slice(0, 8);
  const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const time = v.length >= 13 ? `${v.slice(9, 11)}:${v.slice(11, 13)}` : '';
  return { date, time };
}

async function importIcsFile(file) {
  const text = await file.text();
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1);
  const events = [];
  for (const block of blocks) {
    const get = (key) => {
      const m = block.match(new RegExp('(?:^|\\n)' + key + '(?:;[^:]*)?:(.*)', 'i'));
      return m ? m[1].trim() : '';
    };
    const title = get('SUMMARY');
    if (!title) continue;
    const dtstart = get('DTSTART').replace(/VALUE=DATE[^:]*:/, '');
    const { date, time } = parseIcsDate(dtstart);
    if (!date) continue;
    events.push({ title, date, time, notes: get('DESCRIPTION').replace(/\\n/g, '\n'), category: 'sekolah' });
  }
  let ok = 0, fail = 0;
  for (const ev of events) {
    try {
      await api('/api/events', { method: 'POST', body: ev });
      ok++;
    } catch { fail++; }
  }
  await loadEvents();
  renderCalendarView();
  toast(`ICS diimpor: ${ok} agenda${fail ? `, ${fail} gagal` : ''}`);
}

function bindCalendarActions() {
  $('#calPrev').addEventListener('click', () => shiftCalendar(-1));
  $('#calNext').addEventListener('click', () => shiftCalendar(1));
  $('#calToday').addEventListener('click', () => {
    state.cal.year = +state.today.slice(0, 4);
    state.cal.month = +state.today.slice(5, 7) - 1;
    state.cal.selected = state.today;
    renderCalendarView();
  });
  $('#calAdd').addEventListener('click', () => openEventModal(null, state.cal.selected));
  const icsBtn = $('#calImportIcs');
  const icsFile = $('#calIcsFile');
  if (icsBtn && icsFile) {
    icsBtn.addEventListener('click', () => icsFile.click());
    icsFile.addEventListener('change', async () => {
      const file = icsFile.files[0];
      if (!file) return;
      try { await importIcsFile(file); } catch (err) { toast(err.message || 'Gagal membaca .ics', 'error'); }
      icsFile.value = '';
    });
  }
  $('#miniPrev').addEventListener('click', () => { shiftMonth(state.mini, -1); renderMiniCalendar(); });
  $('#miniNext').addEventListener('click', () => { shiftMonth(state.mini, 1); renderMiniCalendar(); });
}
