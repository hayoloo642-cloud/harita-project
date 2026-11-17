/* ============================================================
   Tasks view
   ============================================================ */
function parseSubtasks(task) {
  if (!task || !task.subtasks) return [];
  if (Array.isArray(task.subtasks)) return task.subtasks;
  try {
    const parsed = JSON.parse(task.subtasks);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function renderTasksView() {
  const listNode = $('#taskList');
  if (!listNode) return;
  const day = state.tasks.date || state.taskDate;
  const allTasks = state.tasks.tasks || [];
  const query = (state.taskQuery || '').trim().toLowerCase();
  const tasks = query
    ? allTasks.filter((t) => `${t.title} ${t.notes || ''}`.toLowerCase().includes(query))
    : allTasks;
  const done = tasks.filter((t) => t.done);
  const open = tasks.filter((t) => !t.done);
  const total = allTasks.length;
  const allDone = allTasks.filter((t) => t.done).length;
  const pct = total ? Math.round((allDone / total) * 100) : 0;

  $('#taskDateLabel').textContent = relDayLabel(day);
  $('#taskDateFull').textContent = fmtLong(day);
  $('#taskProgressTxt').textContent = `${allDone}/${total} selesai`;
  $('#taskProgressPct').textContent = `${pct}%`;
  $('#taskProgressBar').style.width = `${pct}%`;
  const headSub = $('#taskHeadSub');
  if (headSub) {
    headSub.textContent = day === state.today
      ? 'Checklist otomatis direset setiap hari — yang belum selesai bisa dibawa ke hari berikutnya.'
      : `Melihat tugas untuk ${fmtLong(day)}.`;
  }

  $$('#taskFilters .filter-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === state.taskFilter);
  });
  const searchInput = $('#taskSearch');
  if (searchInput && searchInput.value !== (state.taskQuery || '')) searchInput.value = state.taskQuery || '';
  const completeAll = $('#taskCompleteAll');
  if (completeAll) completeAll.hidden = !(allTasks.length - allDone > 0);

  if (state.tasks.loading && !allTasks.length) {
    listNode.innerHTML = `<div class="task-loading">${skeletonRows(5, 'skeleton-task')}</div>`;
    return;
  }

  const taskItem = (t) => {
    const subs = parseSubtasks(t);
    const subsDone = subs.filter((x) => Number(x.done) === 1).length;
    const selected = state.selectedTasks.has(t.id);
    return `
    <div class="task-item ${t.done ? 'done' : ''} ${state.bulkMode ? 'bulk-mode' : ''} ${selected ? 'selected' : ''}" data-task-id="${t.id}" draggable="${state.bulkMode ? 'false' : 'true'}">
      ${state.bulkMode ? `<input type="checkbox" class="task-select" data-task-select="${t.id}" ${selected ? 'checked' : ''} aria-label="Pilih tugas" />` : '<span class="drag-handle" title="Geser untuk mengurutkan" aria-hidden="true">⋮⋮</span>'}
      <button class="task-check ${t.done ? 'on' : ''}" data-task-toggle="${t.id}" data-done="${t.done}" aria-label="${t.done ? 'Tandai belum selesai' : 'Tandai selesai'}">${iconSvg('check')}</button>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.notes ? `<div class="task-note">${esc(t.notes)}</div>` : ''}
        <div class="task-meta">
          ${t.start_time ? `<span class="task-time-chip">${iconSvg('clock')} ${esc(String(t.start_time).slice(0, 5))}</span>` : ''}
          ${t.source === 'lanjutan' ? '<span class="tag lanjutan">lanjutan</span>' : ''}
          ${t.source === 'rutin' ? '<span class="tag rutin">rutin</span>' : ''}
          ${Number(t.priority) === 1 ? `<span class="tag p1">${iconSvg('alert')} Penting</span>` : Number(t.priority) === 3 ? `<span class="tag p3">${iconSvg('clock')} Santai</span>` : ''}
          ${subs.length ? `<span class="tag subtask-chip" title="Sub-tugas">${iconSvg('list')} ${subsDone}/${subs.length}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-task-edit="${t.id}" title="Edit tugas" aria-label="Edit tugas">${iconSvg('edit')}</button>
        <button class="icon-btn" data-task-del="${t.id}" title="Hapus tugas" aria-label="Hapus tugas">${iconSvg('trash')}</button>
      </div>
    </div>`;
  };

  let html = '';
  if (state.taskFilter !== 'done' && open.length) {
    html += `<div class="task-group-label">Aktif · ${open.length}</div>${open.map(taskItem).join('')}`;
  }
  if (state.taskFilter !== 'open' && done.length) {
    html += `<div class="task-group-label">Selesai · ${done.length}</div>${done.map(taskItem).join('')}`;
  }
  if (!html) {
    const messages = {
      all: `<b>Belum ada tugas di hari ini.</b><br>Mulai dari satu hal kecil — tambahkan lewat kolom di atas.`,
      open: `<b>Semua tugas sudah selesai.</b><br>Kerja bagus! Waktunya istirahat atau kerjakan hal lain.`,
      done: `<b>Belum ada tugas yang selesai.</b><br>Centang tugas pertamamu hari ini.`,
    };
    html = query
      ? `<div class="task-empty">${iconSvg('search')}<span><b>Tidak ada tugas yang cocok.</b><br>Coba kata kunci lain atau hapus pencarian.</span></div>`
      : `<div class="task-empty">${iconSvg('check-square')}<span>${messages[state.taskFilter] || messages.all}</span>${state.taskFilter === 'all' ? '<button class="btn btn-primary btn-sm" data-focus-quickadd>Tambah tugas pertama</button>' : ''}</div>`;
  }
  listNode.innerHTML = html;

  // routines
  const routines = state.tasks.templates || [];
  const routineNode = $('#routineList');
  const freqLabel = (tpl) => {
    const f = tpl.frequency || 'daily';
    if (f === 'daily') return 'setiap hari';
    if (f === 'weekday') return 'Sen–Jum';
    if (f === 'weekly') return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][tpl.weekday ?? 0] || 'mingguan';
    if (f === 'monthly') return `tgl ${tpl.day_of_month ?? 1}`;
    return f;
  };
  const bulkBar = $('#taskBulkBar');
  if (bulkBar) {
    bulkBar.hidden = !state.bulkMode;
    const bulkCount = $('#bulkCount');
    if (bulkCount) bulkCount.textContent = `${state.selectedTasks.size} dipilih`;
  }
  const bulkBtn = $('#taskBulk');
  if (bulkBtn) {
    bulkBtn.classList.toggle('btn-primary', state.bulkMode);
    bulkBtn.classList.toggle('btn-ghost', !state.bulkMode);
  }
  routineNode.innerHTML = routines.length
    ? routines.map((tpl) => `
      <div class="routine-item" title="${esc(freqLabel(tpl))}">
        ${ico('rotate')}<span>${esc(tpl.title)}${tpl.start_time ? ` · ${esc(String(tpl.start_time).slice(0, 5))}` : ''} <em style="font-size:8.5px;color:var(--faint);font-style:normal">${esc(freqLabel(tpl))}</em></span>
        <button class="icon-btn" data-template-del="${tpl.id}" title="Hapus rutinitas" aria-label="Hapus rutinitas">${iconSvg('trash')}</button>
      </div>`).join('')
    : `<p class="hint" style="margin-top:0">Belum ada rutinitas. Saat menambah tugas, pilih “Ulangi”.</p>`;
}

function syncTaskLocal(task) {
  const replace = (arr) => {
    if (!Array.isArray(arr)) return;
    const idx = arr.findIndex((t) => t.id === task.id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...task };
  };
  replace(state.tasks.tasks);
  replace(state.todayTasks.tasks);
}

async function toggleTask(id, done) {
  const task = (state.tasks.tasks || []).find((t) => t.id === id) || (state.todayTasks.tasks || []).find((t) => t.id === id);
  if (!task) return;
  const previous = task.done;
  task.done = done ? 1 : 0;
  syncTaskLocal({ id, done: task.done });
  renderTasksView();
  renderDashboard();
  updateNavBadge();
  try {
    await api(`/api/tasks/${id}`, { method: 'PATCH', body: { done: task.done } });
    if (done) {
      beep(1);
      toastUndo(`"${task.title}" selesai`, async () => {
        await api(`/api/tasks/${id}`, { method: 'PATCH', body: { done: 0 } });
        await loadTasks(state.taskDate);
        toast('Tugas dikembalikan');
      });
    }
  } catch (err) {
    task.done = previous;
    syncTaskLocal({ id, done: previous });
    renderTasksView();
    renderDashboard();
    updateNavBadge();
    toast(err.message, 'error');
  }
}

function openTaskModal(task = null, presetDate = null) {
  const isEdit = !!task;
  const day = task ? task.date : (presetDate || state.taskDate);
  const body = `
    <div class="form-grid">
      <div class="field full">
        <label>Judul tugas</label>
        <input name="title" maxlength="140" required value="${esc(task ? task.title : '')}" placeholder="Contoh: Latihan soal matematika" />
      </div>
      <div class="field">
        <label>Tanggal</label>
        <input type="date" name="date" required value="${esc(day)}" />
      </div>
      <div class="field">
        <label>Jam (opsional)</label>
        <input type="time" name="start_time" value="${esc(task && task.start_time ? String(task.start_time).slice(0, 5) : '')}" />
      </div>
      <div class="field">
        <label>Prioritas</label>
        <select name="priority">
          <option value="2" ${!task || Number(task.priority) === 2 ? 'selected' : ''}>Normal</option>
          <option value="1" ${task && Number(task.priority) === 1 ? 'selected' : ''}>Penting</option>
          <option value="3" ${task && Number(task.priority) === 3 ? 'selected' : ''}>Santai</option>
        </select>
      </div>
      ${!isEdit ? `<div class="field">
        <label>Ulangi</label>
        <select name="frequency" class="select-inline">
          <option value="none">Tidak diulang</option>
          <option value="daily">Setiap hari</option>
          <option value="weekday">Setiap hari kerja (Sen–Jum)</option>
          <option value="weekly">Setiap minggu (hari ini)</option>
          <option value="monthly">Setiap bulan (tanggal ini)</option>
        </select>
      </div>` : ''}
      <div class="field full">
        <label>Catatan (opsional)</label>
        <textarea name="notes" placeholder="Detail kecil, link materi, atau langkah pertama…">${esc(task ? task.notes || '' : '')}</textarea>
      </div>
      <div class="field full">
        <label>Sub-tugas (opsional)</label>
        <div class="subtask-editor" id="subtaskEditor">
          ${parseSubtasks(task).map((sub) => `<div class="subtask-row"><input type="checkbox" class="subtask-done" ${Number(sub.done) === 1 ? 'checked' : ''} aria-label="Selesai" /><input type="text" class="subtask-title" maxlength="140" value="${esc(sub.title)}" placeholder="Langkah kecil…" /><button type="button" class="icon-btn subtask-remove" aria-label="Hapus sub-tugas">${iconSvg('x')}</button></div>`).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-sm subtask-add" id="subtaskAdd">${iconSvg('plus')} Tambah sub-tugas</button>
        <span class="help">Pecah tugas besar menjadi langkah kecil yang bisa dicentang.</span>
      </div>
    </div>`;
  openModal({
    title: isEdit ? 'Edit tugas' : 'Tugas baru',
    eyebrow: isEdit ? fmtMedium(day) : 'Checklist harian',
    body,
    submitLabel: isEdit ? 'Simpan perubahan' : 'Tambah tugas',
    onDelete: isEdit ? async () => {
      confirmDialog({
        title: 'Hapus tugas?',
        message: `<strong>${esc(task.title)}</strong> akan dihapus permanen dari daftar.`,
        confirmLabel: 'Hapus tugas',
        onConfirm: async () => {
          await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
          await loadTasks(state.taskDate);
          toastUndo('Tugas dipindahkan ke sampah', async () => {
            await api('/api/restore', { method: 'POST', body: { kind: 'task', id: task.id } });
            await loadTasks(state.taskDate);
          });
        },
      });
    } : null,
    onSubmit: async (form) => {
      const payload = {
        title: formValue(form, 'title'),
        date: formValue(form, 'date'),
        start_time: formValue(form, 'start_time'),
        priority: Number(formValue(form, 'priority')) || 2,
        notes: formValue(form, 'notes'),
        subtasks: Array.from(form.querySelectorAll('#subtaskEditor .subtask-row')).map((row) => ({
          title: row.querySelector('.subtask-title').value.trim(),
          done: row.querySelector('.subtask-done').checked ? 1 : 0,
        })).filter((x) => x.title),
      };
      if (!payload.title) throw new Error('Judul tugas wajib diisi');
      if (isEdit) {
        await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: payload });
        toast('Tugas diperbarui');
        if (payload.date !== state.taskDate) {
          state.taskDate = payload.date;
          await loadTasks(payload.date);
        } else {
          await loadTasks(state.taskDate);
        }
      } else {
        const frequency = formValue(form, 'frequency');
        if (frequency && frequency !== 'none') {
          const dow = dayOfWeek(payload.date);   // JS getDay 0..6
          payload.frequency = frequency;
          payload.weekday = frequency === 'weekly' ? dow : null;
          payload.day_of_month = frequency === 'monthly' ? new Date(payload.date).getDate() : null;
          // create the routine template too, linked to this task
          await api('/api/templates', { method: 'POST', body: { title: payload.title, priority: payload.priority, start_time: payload.start_time, frequency, weekday: payload.weekday, day_of_month: payload.day_of_month } });
        }
        await api('/api/tasks', { method: 'POST', body: payload });
        toast(frequency && frequency !== 'none' ? 'Tugas & rutinitas ditambahkan' : 'Tugas ditambahkan');
        state.taskDate = payload.date;
        await loadTasks(payload.date);
      }
    },
  });
}

async function addQuickTask(rawTitle, priority) {
  const title = rawTitle.trim();
  if (!title) return false;
  await api('/api/tasks', {
    method: 'POST',
    body: { title, date: state.taskDate, priority: Number(priority) || 2, repeat: false },
  });
  if (state.taskDate === state.today) toast('Tugas ditambahkan');
  else toast(`Tugas ditambahkan untuk ${fmtShort(state.taskDate)}`);
  await loadTasks(state.taskDate);
  return true;
}

async function carryTasks() {
  const data = await api('/api/tasks/carry', { method: 'POST', body: { to: state.taskDate } });
  await loadTasks(state.taskDate);
  toast(data.copied > 0 ? `${data.copied} tugas dibawa ke tanggal ini` : 'Tidak ada tugas belum selesai dari hari sebelumnya');
}


const ROUTINE_PRESETS = [
  {
    id: 'exam', name: 'Persiapan ujian 14 hari', desc: 'Latihan soal harian + review catatan + simulasi mingguan',
    templates: [
      { title: 'Latihan soal 20 menit', priority: 1, frequency: 'daily' },
      { title: 'Review catatan 15 menit', priority: 2, frequency: 'daily' },
      { title: 'Simulasi ujian 60 menit', priority: 1, frequency: 'weekly', weekday: 0 },
    ],
    oneOff: ['Petakan materi ujian dan target nilai'],
  },
  {
    id: 'kti', name: 'Lomba karya tulis ilmiah', desc: 'Tulis 300 kata setiap hari, cari sumber, revisi bertahap',
    templates: [
      { title: 'Tulis 300 kata KTI', priority: 1, frequency: 'daily' },
      { title: 'Cari 2 sumber ilmiah', priority: 2, frequency: 'weekday' },
      { title: 'Revisi & rapikan daftar pustaka', priority: 2, frequency: 'weekly', weekday: 0 },
    ],
    oneOff: ['Susun outline KTI', 'Daftar lomba dan catat deadline'],
  },
  {
    id: 'reading', name: 'Baca buku harian', desc: 'Bangun kebiasaan membaca tanpa target muluk',
    templates: [
      { title: 'Baca 20 halaman', priority: 2, frequency: 'daily' },
      { title: 'Rangkum 1 bab', priority: 2, frequency: 'weekly', weekday: 0 },
    ],
    oneOff: ['Pilih buku yang ingin dibaca'],
  },
  {
    id: 'focus', name: 'Fokus & kebiasaan', desc: 'Sesi fokus pendek dan review minggu',
    templates: [
      { title: 'Fokus 25 menit tanpa HP', priority: 1, frequency: 'daily' },
      { title: 'Review progres minggu ini', priority: 2, frequency: 'weekly', weekday: 0 },
    ],
    oneOff: ['Tentukan 3 prioritas minggu ini'],
  },
];

function openRoutinePresets() {
  const body = `<div class="preset-list">${ROUTINE_PRESETS.map((preset) => `
    <button class="preset-card" type="button" data-preset-apply="${esc(preset.id)}">
      <span><strong>${esc(preset.name)}</strong><small>${esc(preset.desc)}</small></span>
      <span class="preset-action">Pakai</span>
    </button>`).join('')}</div>`;
  openModal({ title: 'Template rutin belajar', eyebrow: 'Buat sekali, muncul otomatis', body, hideSubmit: true });
  setTimeout(() => {
    document.querySelectorAll('[data-preset-apply]').forEach((button) => button.addEventListener('click', () => {
      const preset = ROUTINE_PRESETS.find((item) => item.id === button.dataset.presetApply);
      if (!preset) return;
      closeModal();
      confirmDialog({
        title: `Pakai template?`,
        message: `<strong>${esc(preset.name)}</strong> akan menambahkan rutinitas otomatis dan tugas contoh. Kamu bisa menghapusnya kapan saja.`,
        confirmLabel: 'Terapkan template',
        onConfirm: async () => {
          for (const tpl of preset.templates) await api('/api/templates', { method: 'POST', body: tpl });
          for (const title of preset.oneOff) await api('/api/tasks', { method: 'POST', body: { date: state.today, title, priority: 2 } });
          await loadTasks(state.taskDate || state.today);
          toast('Template rutin diterapkan');
        },
      });
    }));
  }, 50);
}

function bindTaskQuickActions() {
  $('#taskPrev').addEventListener('click', () => loadTasks(addDays(state.taskDate, -1)));
  $('#taskNext').addEventListener('click', () => loadTasks(addDays(state.taskDate, 1)));
  $('#taskTodayBtn').addEventListener('click', () => loadTasks(state.today));
  $('#taskAdd').addEventListener('click', () => openTaskModal());
  const presetsButton = $('#taskPresets');
  if (presetsButton) presetsButton.addEventListener('click', openRoutinePresets);
  $('#taskCarry').addEventListener('click', () => {
    confirmDialog({
      title: 'Bawa tugas dari kemarin?',
      message: 'Semua tugas yang <strong>belum selesai</strong> pada hari terakhir yang memiliki tugas akan disalin ke tanggal ini.',
      confirmLabel: 'Bawa tugas',
      danger: false,
      onConfirm: async () => { await carryTasks(); },
    });
  });
  $('#taskResetDay').addEventListener('click', () => {
    confirmDialog({
      title: 'Reset tugas hari ini?',
      message: `Semua tugas pada <strong>${esc(fmtLong(state.taskDate))}</strong> akan dihapus. Rutinitas harian akan dibuat ulang otomatis saat halaman dimuat.`,
      confirmLabel: 'Reset hari ini',
      onConfirm: async () => {
        await api('/api/tasks/reset', { method: 'POST', body: { date: state.taskDate } });
        await loadTasks(state.taskDate);
        toast('Tugas hari ini direset');
      },
    });
  });
  $('#quickAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-focus-quickadd]')) $('#quickAddInput')?.focus();
    });
    const input = $('#quickAddInput');
    try {
      const added = await addQuickTask(input.value, $('#quickAddPriority').value);
      if (added) input.value = '';
    } catch (err) { toast(err.message, 'error'); }
  });
  $('#quickAddMore').addEventListener('click', () => openTaskModal(null, state.taskDate));
  $('#quickAddInput').addEventListener('input', (e) => {
    if (e.target.value.trim()) {
      // keep detail button close to title as a shortcut
    }
  });
  $('#taskFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-pill');
    if (!btn) return;
    state.taskFilter = btn.dataset.filter;
    renderTasksView();
  });
  const subtaskEditor = () => $('#subtaskEditor');
  document.addEventListener('click', (e) => {
    if (e.target.closest('#subtaskAdd')) {
      const editor = subtaskEditor();
      if (!editor) return;
      const row = document.createElement('div');
      row.className = 'subtask-row';
      row.innerHTML = `<input type="checkbox" class="subtask-done" aria-label="Selesai" /><input type="text" class="subtask-title" maxlength="140" placeholder="Langkah kecil…" /><button type="button" class="icon-btn subtask-remove" aria-label="Hapus sub-tugas">${iconSvg('x')}</button>`;
      editor.appendChild(row);
      row.querySelector('.subtask-title').focus();
      return;
    }
    const remove = e.target.closest('.subtask-remove');
    if (remove) { remove.closest('.subtask-row').remove(); return; }

    const bulkBtn = e.target.closest('#taskBulk');
    if (bulkBtn) {
      state.bulkMode = !state.bulkMode;
      if (!state.bulkMode) state.selectedTasks.clear();
      renderTasksView();
      return;
    }
    if (e.target.closest('#bulkCancel')) {
      state.bulkMode = false;
      state.selectedTasks.clear();
      renderTasksView();
      return;
    }
    if (e.target.closest('#bulkDone')) {
      const ids = Array.from(state.selectedTasks);
      if (!ids.length) return;
      Promise.all(ids.map((id) => api(`/api/tasks/${id}`, { method: 'PATCH', body: { done: 1 } })))
        .then(() => { toastUndo(`${ids.length} tugas diselesaikan`, async () => {
          await Promise.all(ids.map((id) => api(`/api/tasks/${id}`, { method: 'PATCH', body: { done: 0 } })));
          await loadTasks(state.taskDate);
        }); state.selectedTasks.clear(); state.bulkMode = false; return loadTasks(state.taskDate); })
        .catch((err) => toast(err.message, 'error'));
      return;
    }
    if (e.target.closest('#bulkDelete')) {
      const ids = Array.from(state.selectedTasks);
      if (!ids.length) return;
      confirmDialog({
        title: `Hapus ${ids.length} tugas?`,
        message: 'Tugas yang dipilih akan dipindahkan ke sampah dan bisa dikembalikan lewat Undo.',
        confirmLabel: 'Hapus terpilih',
        danger: true,
        onConfirm: async () => {
          await Promise.all(ids.map((id) => api(`/api/tasks/${id}`, { method: 'DELETE' })));
          toastUndo(`${ids.length} tugas dihapus`, async () => {
            await Promise.all(ids.map((id) => api('/api/restore', { method: 'POST', body: { kind: 'task', id } })));
            await loadTasks(state.taskDate);
          });
          state.selectedTasks.clear();
          state.bulkMode = false;
          await loadTasks(state.taskDate);
        },
      });
      return;
    }
    if (e.target.closest('#bulkMove')) {
      const ids = Array.from(state.selectedTasks);
      if (!ids.length) return;
      const value = window.prompt('Pindahkan ke tanggal (YYYY-MM-DD):', state.taskDate);
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
      Promise.all(ids.map((id) => api(`/api/tasks/${id}`, { method: 'PATCH', body: { date: value } })))
        .then(async () => { toast(`${ids.length} tugas dipindah ke ${fmtShort(value)}`); state.selectedTasks.clear(); state.bulkMode = false; await loadTasks(state.taskDate); })
        .catch((err) => toast(err.message, 'error'));
      return;
    }
  });

  document.addEventListener('change', (e) => {
    const box = e.target.closest('[data-task-select]');
    if (!box) return;
    const id = Number(box.dataset.taskSelect);
    if (box.checked) state.selectedTasks.add(id); else state.selectedTasks.delete(id);
    const count = $('#bulkCount');
    if (count) count.textContent = `${state.selectedTasks.size} dipilih`;
  });

  const taskList = $('#taskList');
  if (taskList) {
    let dragId = 0;
    taskList.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.task-item');
      if (!item || state.bulkMode) return;
      dragId = Number(item.dataset.taskId);
      item.classList.add('dragging');
      try { e.dataTransfer.setData('text/plain', String(dragId)); e.dataTransfer.effectAllowed = 'move'; } catch {}
    });
    taskList.addEventListener('dragend', (e) => {
      const item = e.target.closest('.task-item');
      if (item) item.classList.remove('dragging');
      taskList.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
    });
    taskList.addEventListener('dragover', (e) => {
      if (!dragId) return;
      const item = e.target.closest('.task-item');
      if (!item || Number(item.dataset.taskId) === dragId) return;
      e.preventDefault();
      taskList.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
      item.classList.add('drop-target');
    });
    taskList.addEventListener('drop', async (e) => {
      if (!dragId) return;
      e.preventDefault();
      const item = e.target.closest('.task-item');
      if (!item) return;
      const targetId = Number(item.dataset.taskId);
      if (!targetId || targetId === dragId) return;
      const list = state.tasks.tasks || [];
      const from = list.findIndex((t) => t.id === dragId);
      const to = list.findIndex((t) => t.id === targetId);
      if (from < 0 || to < 0) return;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      dragId = 0;
      renderTasksView();
      try {
        await api('/api/tasks/reorder', { method: 'POST', body: { ids: list.map((t) => t.id) } });
      } catch (err) { toast(err.message, 'error'); }
    });
    taskList.addEventListener('dblclick', (e) => {
      const titleNode = e.target.closest('.task-title');
      if (!titleNode || titleNode.querySelector('input')) return;
      const item = titleNode.closest('.task-item');
      const id = Number(item && item.dataset.taskId);
      const task = (state.tasks.tasks || []).find((t) => t.id === id);
      if (!task) return;
      const input = document.createElement('input');
      input.className = 'inline-edit';
      input.maxLength = 140;
      input.value = task.title;
      titleNode.textContent = '';
      titleNode.appendChild(input);
      input.focus();
      input.select();
      let done = false;
      const finish = async (save) => {
        if (done) return;
        done = true;
        const value = input.value.trim();
        if (save && value && value !== task.title) {
          try {
            await api(`/api/tasks/${id}`, { method: 'PATCH', body: { title: value } });
            task.title = value;
            toast('Judul tugas diperbarui');
          } catch (err) { toast(err.message, 'error'); }
        }
        renderTasksView();
        renderDashboard();
      };
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
        if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
    });
  }
  const taskSearch = $('#taskSearch');
  if (taskSearch) {
    taskSearch.addEventListener('input', (e) => {
      state.taskQuery = e.target.value;
      renderTasksView();
    });
    taskSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.target.value = ''; state.taskQuery = ''; renderTasksView(); }
    });
  }
  const completeAll = $('#taskCompleteAll');
  if (completeAll) {
    completeAll.addEventListener('click', () => {
      const openTasks = (state.tasks.tasks || []).filter((t) => !t.done);
      if (!openTasks.length) return;
      confirmDialog({
        title: 'Selesaikan semua tugas?',
        message: `${openTasks.length} tugas aktif pada <strong>${esc(fmtLong(state.tasks.date || state.taskDate))}</strong> akan ditandai selesai.`,
        confirmLabel: 'Selesaikan semua',
        onConfirm: async () => {
          const date = state.tasks.date || state.taskDate;
          const res = await api('/api/tasks/complete-all', { method: 'POST', body: { date } });
          const ids = res.ids || [];
          await loadTasks(state.taskDate);
          toastUndo(`${ids.length} tugas diselesaikan`, async () => {
            await Promise.all(ids.map((id) => api(`/api/tasks/${id}`, { method: 'PATCH', body: { done: 0 } })));
            await loadTasks(state.taskDate);
            toast('Tugas dikembalikan');
          }, 8000);
        },
      });
    });
  }
}
