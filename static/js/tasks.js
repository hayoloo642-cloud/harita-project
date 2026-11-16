/* ============================================================
   Tasks view
   ============================================================ */
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

  const taskItem = (t) => `
    <div class="task-item ${t.done ? 'done' : ''}" data-task-id="${t.id}">
      <button class="task-check ${t.done ? 'on' : ''}" data-task-toggle="${t.id}" data-done="${t.done}" aria-label="${t.done ? 'Tandai belum selesai' : 'Tandai selesai'}">${iconSvg('check')}</button>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.notes ? `<div class="task-note">${esc(t.notes)}</div>` : ''}
        <div class="task-meta">
          ${t.start_time ? `<span class="task-time-chip">${iconSvg('clock')} ${esc(String(t.start_time).slice(0, 5))}</span>` : ''}
          ${t.source === 'lanjutan' ? '<span class="tag lanjutan">lanjutan</span>' : ''}
          ${t.source === 'rutin' ? '<span class="tag rutin">rutin</span>' : ''}
          ${Number(t.priority) === 1 ? '<span class="tag p1">Penting</span>' : Number(t.priority) === 3 ? '<span class="tag p3">Santai</span>' : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-task-edit="${t.id}" title="Edit tugas" aria-label="Edit tugas">${iconSvg('edit')}</button>
        <button class="icon-btn" data-task-del="${t.id}" title="Hapus tugas" aria-label="Hapus tugas">${iconSvg('trash')}</button>
      </div>
    </div>`;

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
      : `<div class="task-empty">${iconSvg('check-square')}<span>${messages[state.taskFilter] || messages.all}</span></div>`;
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
    if (done) beep(1);
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

function bindTaskQuickActions() {
  $('#taskPrev').addEventListener('click', () => loadTasks(addDays(state.taskDate, -1)));
  $('#taskNext').addEventListener('click', () => loadTasks(addDays(state.taskDate, 1)));
  $('#taskTodayBtn').addEventListener('click', () => loadTasks(state.today));
  $('#taskAdd').addEventListener('click', () => openTaskModal());
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
          await api('/api/tasks/complete-all', { method: 'POST', body: { date: state.tasks.date || state.taskDate } });
          await loadTasks(state.taskDate);
          toast(`${openTasks.length} tugas diselesaikan`);
        },
      });
    });
  }
}
