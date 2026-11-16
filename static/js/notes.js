/* ============================================================
   Notes
   ============================================================ */
function renderNotesView() {
  const grid = $('#notesGrid');
  if (!grid) return;
  if (state.loading.notes && !state.notes.length) {
    grid.innerHTML = `<div class="skeleton-grid">${skeletonRows(6, 'skeleton-card')}</div>`;
    return;
  }
  const query = state.noteQuery.trim().toLowerCase();
  const notes = state.notes.filter((n) => !query || `${n.title} ${n.body || ''}`.toLowerCase().includes(query));
  if (!notes.length) {
    grid.innerHTML = `<div class="notes-empty">${query ? 'Tidak ada catatan yang cocok dengan pencarian.' : 'Belum ada catatan.<br>Klik “Catatan” untuk menyimpan ide pertamamu.'}</div>`;
    return;
  }
  grid.innerHTML = notes.map((note) => `
    <article class="note-card c-${esc(note.color || 'teal')}" data-note-edit="${note.id}" tabindex="0" role="button" aria-label="Buka catatan ${esc(note.title)}">
      <h4>${note.pinned ? `<span class="pin">${iconSvg('pin')}</span>` : ''}${esc(note.title)}</h4>
      <p>${esc(note.body || '')}</p>
      <span class="note-date">${note.pinned ? 'Disematkan · ' : ''}${timeAgo(note.updated_at)}</span>
    </article>`).join('');
}

function openNoteModal(note = null) {
  const isEdit = !!note;
  const body = `
    <div class="form-grid">
      <div class="field full">
        <label>Judul catatan</label>
        <input name="title" maxlength="160" required value="${esc(note ? note.title : '')}" placeholder="Contoh: Rumus & materi lomba" />
      </div>
      <div class="field full">
        <label>Isi catatan</label>
        <textarea name="body" rows="8" placeholder="Tulis bebas — ide, link, langkah, atau rangkuman materi…">${esc(note ? note.body || '' : '')}</textarea>
      </div>
      <div class="field">
        <label>Warna</label>
        <select name="color">
          ${Object.entries(COLOR_LABEL).map(([value, label]) => `<option value="${value}" ${(note ? note.color : 'teal') === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>&nbsp;</label>
        <label class="check-line"><input type="checkbox" name="pinned" ${note && note.pinned ? 'checked' : ''} />
          <span><strong>Sematkan</strong>Tampil di beranda.</span>
        </label>
      </div>
    </div>`;
  openModal({
    title: isEdit ? 'Edit catatan' : 'Catatan baru',
    eyebrow: 'Catatan cepat',
    body,
    wide: true,
    submitLabel: isEdit ? 'Simpan perubahan' : 'Simpan catatan',
    onDelete: isEdit ? async () => {
      confirmDialog({
        title: 'Hapus catatan?',
        message: `<strong>${esc(note.title)}</strong> akan dihapus permanen.`,
        confirmLabel: 'Hapus catatan',
        onConfirm: async () => {
          await api(`/api/notes/${note.id}`, { method: 'DELETE' });
          await loadNotes();
          toastUndo('Catatan dipindahkan ke sampah', async () => {
            await api('/api/restore', { method: 'POST', body: { kind: 'note', id: note.id } });
            await loadNotes();
          });
        },
      });
    } : null,
    onSubmit: async (form) => {
      const payload = {
        title: formValue(form, 'title') || 'Tanpa judul',
        body: formValue(form, 'body'),
        color: formValue(form, 'color') || 'teal',
        pinned: formValue(form, 'pinned') ? 1 : 0,
      };
      if (isEdit) {
        await api(`/api/notes/${note.id}`, { method: 'PATCH', body: payload });
        toast('Catatan diperbarui');
      } else {
        await api('/api/notes', { method: 'POST', body: payload });
        toast('Catatan disimpan');
      }
      await loadNotes();
    },
  });
}

function bindNoteActions() {
  $('#noteAdd').addEventListener('click', () => openNoteModal());
  $('#noteSearch').addEventListener('input', (e) => {
    state.noteQuery = e.target.value;
    renderNotesView();
  });
}
