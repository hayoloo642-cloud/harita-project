/* ============================================================
   Competitions & projects
   ============================================================ */
function activeCompetitions() {
  return state.competitions.filter((c) => c.status !== 'selesai');
}

function compProgress(comp) {
  const tasks = comp.tasks || [];
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

function renderCompetitionsView() {
  const stats = $('#compStats');
  if (!stats) return;
  const active = activeCompetitions();
  const nearest = active.slice().sort((a, b) => parseLocalDT(a.deadline) - parseLocalDT(b.deadline))[0];
  const allChecks = active.flatMap((c) => c.tasks || []);
  const doneChecks = allChecks.filter((t) => t.done).length;
  const readiness = allChecks.length ? Math.round((doneChecks / allChecks.length) * 100) : 0;
  const nearestCd = nearest ? countdownParts(nearest.deadline) : null;

  stats.innerHTML = `
    <div class="comp-stat"><div class="cs-ico">${iconSvg('trophy')}</div><div><strong>${active.length}</strong><span>lomba / proyek aktif</span></div></div>
    <div class="comp-stat"><div class="cs-ico" style="background:rgba(109,155,255,.1);color:var(--accent-2)">${iconSvg('clock')}</div><div><strong>${nearest ? (nearestCd.past ? 'Lewat' : nearestCd.days > 0 ? `${nearestCd.days} hari` : `${nearestCd.hours} jam`) : '—'}</strong><span>${nearest ? esc(nearest.title) : 'belum ada deadline'}</span></div></div>
    <div class="comp-stat"><div class="cs-ico" style="background:rgba(62,224,192,.1);color:var(--accent)">${iconSvg('check-circle')}</div><div><strong>${readiness}%</strong><span>checklist persiapan selesai</span></div></div>`;

  const grid = $('#compGrid');
  if (state.loading.competitions && !state.competitions.length) {
    grid.innerHTML = `<div class="skeleton-grid">${skeletonRows(4, 'skeleton-card')}</div>`;
    return;
  }
  const q = (state.compQuery || '').trim().toLowerCase();
  const list = state.competitions
    .filter((c) => !q || `${c.title} ${c.notes || ''} ${c.category || ''} ${c.location || ''}`.toLowerCase().includes(q))
    .slice().sort((a, b) => {
    const aDone = a.status === 'selesai' ? 1 : 0;
    const bDone = b.status === 'selesai' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return parseLocalDT(a.deadline) - parseLocalDT(b.deadline);
  });
  if (!list.length) {
    grid.innerHTML = q
      ? `<div class="comp-empty">${iconSvg('search')}Tidak ada lomba yang cocok dengan “${esc(state.compQuery)}”.</div>`
      : `<div class="comp-empty">${iconSvg('trophy')}Belum ada lomba atau proyek yang dicatat.<br>Tambahkan lomba, deadline, dan checklist persiapan supaya tidak panik di akhir.</div>`;
    return;
  }
  grid.innerHTML = list.map((comp) => {
    const cd = countdownParts(comp.deadline);
    const progress = compProgress(comp);
    const isDone = comp.status === 'selesai';
    const soon = !isDone && !cd.past && cd.days <= 3;
    const statusLabel = comp.status === 'selesai' ? 'Selesai' : comp.status === 'berjalan' ? 'Berjalan' : 'Persiapan';
    return `<article class="card comp-card ${soon ? 'deadline-soon' : ''}">
      <div class="comp-card-head">
        <div class="comp-badges">
          <span class="badge cat">${esc(comp.category || 'Lomba')}</span>
          <span class="badge status ${isDone ? 'done' : ''}">${statusLabel}</span>
        </div>
        <div class="comp-actions">
          <button class="icon-btn" data-comp-edit="${comp.id}" title="Edit" aria-label="Edit lomba">${iconSvg('edit')}</button>
          <button class="icon-btn" data-comp-del="${comp.id}" title="Hapus" aria-label="Hapus lomba">${iconSvg('trash')}</button>
        </div>
      </div>
      <h3>${esc(comp.title)}</h3>
      <div class="comp-meta">
        <span>${iconSvg('calendar')} ${esc(fmtMedium(comp.deadline.slice(0, 10)))}</span>
        ${comp.location ? `<span>${iconSvg('map-pin')} ${esc(comp.location)}</span>` : ''}
      </div>
      <div class="comp-countdown-row ${soon ? 'soon' : ''}" data-cd="${esc(comp.deadline)}" data-cd-mode="row">${cdInner('row', comp.deadline)}</div>
      ${comp.notes ? `<p class="comp-notes">${esc(comp.notes)}</p>` : ''}
      <div class="progress-meta"><span>Persiapan</span><span>${progress.done}/${progress.total} · ${progress.pct}%</span></div>
      <div class="progress-bar"><span style="width:${progress.pct}%"></span></div>
      <div class="comp-checklist">
        ${(comp.tasks || []).map((t) => `
          <div class="comp-check ${t.done ? 'done' : ''}">
            <button class="cc-box" data-ctoggle="${t.id}" data-cdone="${t.done}" aria-label="Centang checklist"><span class="ico">${iconSvg('check')}</span></button>
            <span class="cc-title">${esc(t.title)}</span>
            <button class="icon-btn" data-cdel="${t.id}" aria-label="Hapus checklist"><span class="ico">${iconSvg('x')}</span></button>
          </div>`).join('')}
        <form class="comp-add-check" data-comp="${comp.id}">
          <input name="title" maxlength="120" placeholder="Tambah item persiapan…" autocomplete="off" />
          <button class="btn btn-ghost btn-sm" type="submit" aria-label="Tambah checklist">${iconSvg('plus')}</button>
        </form>
      </div>
      <div class="comp-foot">
        <span class="meta">${progress.total ? `${progress.pct}% siap` : 'Belum ada checklist'}${cd.past && !isDone ? ' · deadline lewat' : ''}</span>
        <button class="btn btn-ghost btn-sm" data-cstatus="${comp.id}" data-current="${comp.status}">
          ${isDone ? `${ico('rotate')} Aktifkan` : `${ico('check')} Tandai selesai`}
        </button>
      </div>
    </article>`;
  }).join('');
}

function openCompModal(comp = null) {
  const isEdit = !!comp;
  const defaultDeadline = `${addDays(state.today, 7)}T08:00`;
  const body = `
    <div class="form-grid">
      <div class="field full">
        <label>Nama lomba / proyek</label>
        <input name="title" maxlength="160" required value="${esc(comp ? comp.title : '')}" placeholder="Contoh: LKS Web Technology 2027" />
      </div>
      <div class="field">
        <label>Kategori</label>
        <select name="category">
          ${['Lomba', 'Proyek', 'Ujian', 'Organisasi', 'Lainnya'].map((c) => `<option value="${c}" ${(comp ? (comp.category || 'Lomba') === c : c === 'Lomba') ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Status</label>
        <select name="status">
          <option value="persiapan" ${!comp || comp.status === 'persiapan' ? 'selected' : ''}>Persiapan</option>
          <option value="berjalan" ${comp && comp.status === 'berjalan' ? 'selected' : ''}>Berjalan</option>
          <option value="selesai" ${comp && comp.status === 'selesai' ? 'selected' : ''}>Selesai</option>
        </select>
      </div>
      <div class="field">
        <label>Deadline</label>
        <input type="datetime-local" name="deadline" required value="${esc(comp ? String(comp.deadline).slice(0, 16) : defaultDeadline)}" />
      </div>
      <div class="field">
        <label>Lokasi (opsional)</label>
        <input name="location" maxlength="120" value="${esc(comp ? comp.location || '' : '')}" placeholder="Contoh: sekolah di sekitar" />
      </div>
      <div class="field full">
        <label>Catatan (opsional)</label>
        <textarea name="notes" placeholder="Ketentuan lomba, link pendaftaran, hal yang perlu disiapkan…">${esc(comp ? comp.notes || '' : '')}</textarea>
      </div>
      ${!isEdit ? `<div class="field full">
        <label>Checklist persiapan (satu per baris)</label>
        <textarea name="checks" placeholder="Baca ketentuan lomba&#10;Buat draft desain&#10;Latihan presentasi&#10;Siapkan berkas"></textarea>
        <span class="help">Bisa ditambah atau dicentang langsung dari kartu nanti.</span>
      </div>` : `<div class="field full"><div class="modal-info">Checklist persiapan bisa dicentang, ditambah, atau dihapus langsung dari kartu lomba.</div></div>`}
    </div>`;
  openModal({
    title: isEdit ? 'Edit lomba' : 'Lomba / proyek baru',
    eyebrow: 'Deadline & persiapan',
    body,
    wide: true,
    submitLabel: isEdit ? 'Simpan perubahan' : 'Tambah lomba',
    onDelete: isEdit ? async () => {
      confirmDialog({
        title: 'Hapus lomba?',
        message: `<strong>${esc(comp.title)}</strong> beserta checklist persiapannya akan dihapus permanen.`,
        confirmLabel: 'Hapus lomba',
        onConfirm: async () => {
          await api(`/api/competitions/${comp.id}`, { method: 'DELETE' });
          await loadCompetitions();
          toastUndo('Lomba dipindahkan ke sampah', async () => {
            await api('/api/restore', { method: 'POST', body: { kind: 'competition', id: comp.id } });
            await loadCompetitions();
          });
        },
      });
    } : null,
    onSubmit: async (form) => {
      const payload = {
        title: formValue(form, 'title'),
        category: formValue(form, 'category') || 'Lomba',
        status: formValue(form, 'status') || 'persiapan',
        deadline: formValue(form, 'deadline'),
        location: formValue(form, 'location'),
        notes: formValue(form, 'notes'),
      };
      if (!payload.title) throw new Error('Nama lomba wajib diisi');
      if (!payload.deadline) throw new Error('Deadline wajib diisi');
      if (isEdit) {
        await api(`/api/competitions/${comp.id}`, { method: 'PATCH', body: payload });
        toast('Lomba diperbarui');
      } else {
        payload.tasks = formValue(form, 'checks').split('\n').map((s) => s.trim()).filter(Boolean);
        await api('/api/competitions', { method: 'POST', body: payload });
        toast('Lomba ditambahkan');
      }
      await loadCompetitions();
    },
  });
}

async function toggleCompCheck(id, done) {
  try {
    await api(`/api/competition-tasks/${id}`, { method: 'PATCH', body: { done } });
    await loadCompetitions();
  } catch (err) { toast(err.message, 'error'); }
}

function bindCompetitionActions() {
  $('#compAdd').addEventListener('click', () => openCompModal());
  $('#compGrid').addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-ctoggle]');
    if (toggle) { toggleCompCheck(Number(toggle.dataset.ctoggle), toggle.dataset.cdone !== '1'); return; }
    const del = e.target.closest('[data-cdel]');
    if (del) {
      const row = del.closest('.comp-check');
      const title = row ? row.querySelector('.cc-title') : null;
      confirmDialog({
        title: 'Hapus item checklist?',
        message: `${title ? `<strong>${esc(title.textContent)}</strong>` : 'Item ini'} akan dihapus dari checklist.`,
        confirmLabel: 'Hapus item',
        onConfirm: async () => {
          await api(`/api/competition-tasks/${del.dataset.cdel}`, { method: 'DELETE' });
          await loadCompetitions();
          toast('Item checklist dihapus');
        },
      });
      return;
    }
    const edit = e.target.closest('[data-comp-edit]');
    if (edit) {
      const comp = state.competitions.find((c) => c.id === Number(edit.dataset.compEdit));
      if (comp) openCompModal(comp);
      return;
    }
    const remove = e.target.closest('[data-comp-del]');
    if (remove) {
      const comp = state.competitions.find((c) => c.id === Number(remove.dataset.compDel));
      if (!comp) return;
      confirmDialog({
        title: 'Hapus lomba?',
        message: `<strong>${esc(comp.title)}</strong> beserta checklist persiapannya akan dihapus permanen.`,
        confirmLabel: 'Hapus lomba',
        onConfirm: async () => {
          await api(`/api/competitions/${comp.id}`, { method: 'DELETE' });
          await loadCompetitions();
          toastUndo('Lomba dipindahkan ke sampah', async () => {
            await api('/api/restore', { method: 'POST', body: { kind: 'competition', id: comp.id } });
            await loadCompetitions();
          });
        },
      });
      return;
    }
    const status = e.target.closest('[data-cstatus]');
    if (status) {
      const comp = state.competitions.find((c) => c.id === Number(status.dataset.cstatus));
      if (!comp) return;
      const next = comp.status === 'selesai' ? 'persiapan' : 'selesai';
      api(`/api/competitions/${comp.id}`, { method: 'PATCH', body: { status: next } })
        .then(loadCompetitions)
        .then(() => toast(next === 'selesai' ? 'Lomba ditandai selesai' : 'Lomba diaktifkan kembali'))
        .catch((err) => toast(err.message, 'error'));
    }
  });
  $('#compGrid').addEventListener('submit', async (e) => {
    const form = e.target.closest('.comp-add-check');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('input[name=title]');
    const title = input.value.trim();
    if (!title) return;
    try {
      await api(`/api/competitions/${form.dataset.comp}/tasks`, { method: 'POST', body: { title } });
      input.value = '';
      await loadCompetitions();
    } catch (err) { toast(err.message, 'error'); }
  });
}
