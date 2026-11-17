/* ============================================================
   Nilai (grade tracker + KKM + print report)
   ============================================================ */
state.grades = { grades: [], kkm: 75 };

function gradeSummary() {
  const g = state.grades.grades || [];
  if (!g.length) return { avg: 0, count: 0 };
  const bySubject = {};
  for (const it of g) {
    (bySubject[it.subject] = bySubject[it.subject] || []).push(Number(it.score));
  }
  const subjectAvgs = Object.values(bySubject).map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
  const avg = subjectAvgs.reduce((a, b) => a + b, 0) / subjectAvgs.length;
  return { avg, count: g.length, bySubject };
}

async function loadGrades() {
  state.loading.grades = true;
  renderGradesView();
  try {
    const d = await api('/api/grades');
    state.grades = { grades: d.grades || [], kkm: Number(d.kkm) || 75 };
    state.loading.grades = false;
    renderGradesView();
  } catch (err) {
    state.loading.grades = false;
    toast(err.message, 'error');
  }
}

function renderGradesView() {
  const avgEl = $('#gradeAvg');
  if (!avgEl) return;
  if (state.loading.grades && !state.grades.grades.length) {
    $('#gradeList').innerHTML = `<div class="skeleton-stack">${skeletonRows(4, 'skeleton-row')}</div>`;
    return;
  }
  const { avg, count } = gradeSummary();
  const kkm = state.grades.kkm;
  avgEl.textContent = count ? avg.toFixed(1) : '—';
  avgEl.style.color = count >= kkm ? 'var(--success)' : (count >= kkm - 10 ? 'var(--warm)' : 'var(--danger)');
  $('#gradeKkm').textContent = kkm;
  $('#gradeKkmInput').value = kkm;
  const pct = count ? Math.min(100, Math.round((avg / kkm) * 100)) : 0;
  $('#gradeKkmFill').style.width = `${pct}%`;
  $('#gradeHint').textContent = count
    ? (avg >= kkm ? `Mantap — rata-rata kamu ${avg >= 85 ? 'sangat' : ''}memenuhi KKM.` : `Rata-rata ${avg.toFixed(1)} — masih di bawah KKM ${kkm}. Fokus ke mapel terlemahnya dulu.`)
    : 'Belum ada nilai tercatat. Tambah nilai pertama di bawah.';

  // per subject
  const q = (state.gradeQuery || '').trim().toLowerCase();
  const g = (state.grades.grades || []).filter((it) => !q || `${it.subject} ${it.label}`.toLowerCase().includes(q));
  const bySubject = {};
  for (const it of g) (bySubject[it.subject] = bySubject[it.subject] || []).push(Number(it.score));
  const subjectRows = Object.entries(bySubject)
    .map(([subject, arr]) => ({ subject, avg: arr.reduce((a, b) => a + b, 0) / arr.length, count: arr.length }))
    .sort((a, b) => a.avg - b.avg);
  $('#gradeSubjects').innerHTML = subjectRows.length
    ? subjectRows.map((s) => {
        const cls = s.avg >= kkm ? 'ok' : s.avg >= kkm - 10 ? 'warn' : 'bad';
        const w = Math.min(100, Math.round((s.avg / 100) * 100));
        return `<div class="focus-subject-row"><strong>${esc(s.subject)}</strong><div class="fsr-bar"><div class="fsr-fill" style="width:${w}%"></div></div><span class="grade-chip ${cls}">${s.avg.toFixed(1)}</span></div>`;
      }).join('')
    : '<div class="empty-state"><div class="empty-state-ico"><span class="ico" data-icon="star"></span></div><strong>Belum ada nilai</strong><span>Tambah nilai untuk melihat progress per mapel.</span></div>';

  // history
  $('#gradeList').innerHTML = g.length
    ? g.slice(0, 30).map((it) => {
        const cls = it.score >= kkm ? 'ok' : it.score >= kkm - 10 ? 'warn' : 'bad';
        return `<div class="grade-row"><div><strong>${esc(it.subject)}</strong><span>${esc(it.label)} · ${esc(String(it.created_at || '').slice(0, 10))}</span></div><div class="grade-chip ${cls}">${Number(it.score).toFixed(1)}</div><button class="icon-btn xs" data-grade-del="${it.id}" aria-label="Hapus nilai"><span class="ico">${iconSvg('trash')}</span></button></div>`;
      }).join('')
    : '<p class="hint">Belum ada riwayat nilai.</p>';
}

async function saveGradeKkm(value) {
  const v = Math.max(0, Math.min(100, Number(value) || 75));
  try {
    await api('/api/settings', { method: 'POST', body: { kkm: String(v) } });
    state.grades.kkm = v;
    state.settings.kkm = String(v);
  } catch (err) { toast(err.message, 'error'); }
}

function bindGradesActions() {
  $('#gradeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errBox = $('#gradeError');
    errBox.classList.remove('show');
    const payload = { subject: formValue(form, 'subject'), label: formValue(form, 'label'), score: Number(formValue(form, 'score')) };
    if (!payload.subject) { errBox.textContent = 'Mata pelajaran wajib diisi'; errBox.classList.add('show'); return; }
    if (!Number.isFinite(payload.score)) { errBox.textContent = 'Nilai harus angka'; errBox.classList.add('show'); return; }
    const kkmChanged = Number(formValue(form, 'kkm')) !== state.grades.kkm;
    try {
      await api('/api/grades', { method: 'POST', body: payload });
      if (kkmChanged) await saveGradeKkm(formValue(form, 'kkm'));
      form.querySelector('#gradeSubject').value = '';
      form.querySelector('#gradeScore').value = '';
      await loadGrades();
      toast('Nilai tersimpan');
    } catch (err) { errBox.textContent = err.message; errBox.classList.add('show'); }
  });
  $('#gradeKkmInput').addEventListener('change', (e) => saveGradeKkm(e.target.value));
  $('#gradeList').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-grade-del]');
    if (!del) return;
    const id = Number(del.dataset.gradeDel);
    const item = (state.grades.grades || []).find((g) => g.id === id);
    confirmDialog({
      title: 'Hapus nilai?',
      message: `<strong>${esc(item?.subject || '')}</strong> · ${esc(item?.label || '')} akan dihapus.`,
      confirmLabel: 'Hapus nilai',
      onConfirm: async () => {
        await api(`/api/grades/${id}`, { method: 'DELETE' });
        await loadGrades();
        toastUndo('Nilai dipindahkan ke sampah', async () => {
          await api('/api/restore', { method: 'POST', body: { kind: 'grade', id } });
          await loadGrades();
        });
      },
    });
  });
  $('#gradeCsvExport').addEventListener('click', () => {
    const rows = state.grades.grades || [];
    if (!rows.length) { toast('Belum ada nilai untuk diekspor', 'error'); return; }
    const csv = ['Mata Pelajaran,Jenis,Nilai,Tanggal'];
    for (const it of rows) csv.push(`"${String(it.subject).replace(/"/g, '""')}","${String(it.label).replace(/"/g, '""')}",${Number(it.score).toFixed(1)},${String(it.created_at || '').slice(0, 10)}`);
    const blob = new Blob([csv.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'harita-nilai.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Nilai diunduh sebagai CSV');
  });

  $('#gradePrint').addEventListener('click', () => {
    buildGradePrintBlock();
    window.print();
  });

  const semesterBtn = $('#semesterReportBtn');
  if (semesterBtn) {
    semesterBtn.addEventListener('click', async () => {
      try {
        semesterBtn.disabled = true;
        await buildSemesterPrintBlock();
        window.print();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        semesterBtn.disabled = false;
      }
    });
  }
}

async function buildSemesterPrintBlock() {
  const block = $('#semesterPrintBlock');
  const g = state.grades.grades || [];
  const kkm = Number(state.grades.kkm) || 75;
  const bySubject = {};
  for (const it of g) {
    (bySubject[it.subject] = bySubject[it.subject] || []).push(Number(it.score) || 0);
  }
  const subjectRows = Object.entries(bySubject)
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([subject, scores]) => {
      const avgS = scores.reduce((a, b) => a + b, 0) / scores.length;
      const ok = avgS >= kkm;
      return `<tr><td>${esc(subject)}</td><td>${scores.length}</td><td>${avgS.toFixed(1)}</td><td>${ok ? '✔ KKM' : '✗ di bawah KKM'}</td></tr>`;
    }).join('');
  const avg = g.length ? g.reduce((a, it) => a + (Number(it.score) || 0), 0) / g.length : 0;

  let focus90 = { total: 0, days: [] };
  try {
    focus90 = await api('/api/focus/history?days=90');
  } catch (_) {}
  const focusTotal = (focus90.days || []).reduce((a, d) => a + (Number(d.minutes) || 0), 0);
  const focusDays = (focus90.days || []).length;

  let weekly = { tasks_done: 0, tasks_total: 0 };
  try {
    weekly = await api('/api/weekly-review');
  } catch (_) {}

  block.innerHTML = `
    <h1>Harita — Laporan Semester</h1>
    <p class="meta">Dicetak: ${esc(fmtLong(todayStr()))} · Tahun ajaran 2026/2027 · Periode: 90 hari terakhir</p>
    <h2>Nilai per mata pelajaran</h2>
    <table>
      <thead><tr><th>Mata pelajaran</th><th>Jumlah nilai</th><th>Rata-rata</th><th>Status</th></tr></thead>
      <tbody>${subjectRows || '<tr><td colspan="4">Belum ada nilai.</td></tr>'}</tbody>
    </table>
    <p class="meta">Rata-rata keseluruhan: <strong>${avg.toFixed(1)}</strong> · KKM: <strong>${kkm}</strong> · Total nilai tercatat: ${g.length}</p>
    <h2>Fokus &amp; belajar</h2>
    <table>
      <thead><tr><th>Metrik</th><th>Nilai</th></tr></thead>
      <tbody>
        <tr><td>Total menit fokus (90 hari)</td><td>${focusTotal} menit (~${Math.round(focusTotal / 60)} jam)</td></tr>
        <tr><td>Hari aktif (dengan sesi fokus)</td><td>${focusDays} hari</td></tr>
        <tr><td>Tugas selesai (minggu ini)</td><td>${weekly.tasks_done} / ${weekly.tasks_total}</td></tr>
      </tbody>
    </table>
    <p class="meta">Laporan otomatis oleh Harita — disimpan lokal, bisa dicetak atau disimpan sebagai PDF oleh browser.</p>
  `;
}

function buildGradePrintBlock() {
  const block = $('#gradePrintBlock');
  const { avg, count } = gradeSummary();
  const g = state.grades.grades || [];
  const rows = g.map((it) => `<tr><td>${esc(it.subject)}</td><td>${esc(it.label)}</td><td>${Number(it.score).toFixed(1)}</td><td>${esc(String(it.created_at || '').slice(0, 10))}</td></tr>`).join('');
  block.innerHTML = `
    <h1 style="font-family:inherit;font-size:22pt;margin:0 0 4px">Harita — Laporan Nilai</h1>
    <p style="margin:0 0 16px;color:#333">Tanggal cetak: ${esc(fmtLong(todayStr()))} · Rata-rata: <b>${count ? avg.toFixed(1) : '—'}</b> · KKM: <b>${state.grades.kkm}</b></p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:10pt">
      <thead><tr style="background:#f0f0f0"><th align="left">Mata pelajaran</th><th align="left">Jenis</th><th align="left">Nilai</th><th align="left">Tanggal</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">Belum ada data nilai.</td></tr>'}</tbody>
    </table>`;
}
