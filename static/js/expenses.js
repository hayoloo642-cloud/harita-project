/* ============================================================
   Expenses — pencatatan pengeluaran harian
   ============================================================ */
const EXPENSE_CATEGORIES = {
  makan: { label: 'Makan & minum', icon: 'coffee' },
  transport: { label: 'Transport', icon: 'bolt' },
  belajar: { label: 'Belajar', icon: 'book' },
  hiburan: { label: 'Hiburan', icon: 'play' },
  kesehatan: { label: 'Kesehatan', icon: 'heart' },
  belanja: { label: 'Belanja', icon: 'wallet' },
  tagihan: { label: 'Tagihan', icon: 'note' },
  lainnya: { label: 'Lainnya', icon: 'circle' },
};

const EXPENSE_METHODS = {
  tunai: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  kartu: 'Kartu',
  lainnya: 'Lainnya',
};

function expenseCategory(key) {
  return EXPENSE_CATEGORIES[key] || EXPENSE_CATEGORIES.lainnya;
}

function expenseMonthLabel(month) {
  const [y, m] = String(month || '').split('-').map(Number);
  if (!y || !m) return '—';
  return fmtMonth(y, m - 1);
}

function daysInMonth(month) {
  const [y, m] = String(month).split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function renderExpensesView() {
  const stats = $('#expenseStats');
  if (!stats) return;
  const monthInput = $('#expenseMonth');
  if (monthInput && state.expenseMonth) monthInput.value = state.expenseMonth;

  const list = state.expenses || [];
  const total = Number(state.expenseSummary.total) || list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const count = Number(state.expenseSummary.count) || list.length;
  const today = state.today || todayStr();
  const month = state.expenseMonth || today.slice(0, 7);
  const dayCount = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonth(month);
  const perDay = dayCount ? Math.round(total / dayCount) : 0;
  const budget = Number(state.settings.expense_budget) || 0;
  const ratio = budget > 0 ? Math.round((total / budget) * 100) : 0;
  const budgetTone = ratio >= 100 ? 'danger' : ratio >= 80 ? 'warn' : 'ok';

  stats.innerHTML = `
    <div class="expense-stat primary"><div class="es-ico">${iconSvg('wallet')}</div><div><span>Total ${esc(expenseMonthLabel(month))}</span><strong>${formatRupiah(total)}</strong><small>${count} transaksi</small></div></div>
    <div class="expense-stat"><div class="es-ico">${iconSvg('chart')}</div><div><span>Rata-rata / hari</span><strong>${formatRupiah(perDay)}</strong><small>dari ${dayCount} hari</small></div></div>
    <div class="expense-stat ${budget > 0 ? 'budget ' + budgetTone : ''}"><div class="es-ico">${iconSvg('target')}</div><div><span>Anggaran bulanan</span><strong>${budget > 0 ? formatRupiah(budget) : 'Belum diatur'}</strong>
      ${budget > 0 ? `<div class="budget-bar"><span style="width:${Math.min(100, ratio)}%"></span></div><small>${ratio}% terpakai${budget - total < 0 ? ` · lewat ${formatRupiah(Math.abs(budget - total))}` : ` · sisa ${formatRupiah(budget - total)}`}</small>` : `<small>Atur di Pengaturan → Uang</small>`}
    </div></div>`;

  $('#expenseListTitle').textContent = expenseMonthLabel(month);
  $('#expenseCount').textContent = count ? `${count} transaksi` : '';

  const q = (state.expenseQuery || '').trim().toLowerCase();
  const filtered = list.filter((item) => {
    if (!q) return true;
    const cat = expenseCategory(item.category).label;
    const method = EXPENSE_METHODS[item.method] || item.method || '';
    return `${item.note || ''} ${cat} ${method} ${item.amount}`.toLowerCase().includes(q);
  });

  const container = $('#expenseList');
  if (state.loading.expenses && !list.length) {
    container.innerHTML = `<div class="skeleton-stack">${skeletonRows(5, 'skeleton-row')}</div>`;
    return;
  }
  if (!filtered.length) {
    container.innerHTML = `<div class="expense-empty">
      <div class="empty-state-ico" style="margin:0 auto 10px"><span class="ico">${iconSvg(q ? 'search' : 'wallet')}</span></div>
      <strong>${q ? 'Tidak ada pengeluaran yang cocok' : 'Belum ada pengeluaran bulan ini'}</strong>
      <p>${q ? `Coba kata kunci lain dari “${esc(state.expenseQuery)}”.` : 'Catat pengeluaran pertama supaya kamu tahu ke mana uang pergi.'}</p>
      ${q ? '' : `<button class="btn btn-primary btn-sm" data-expense-new>${iconSvg('plus')} Catat pengeluaran</button>`}
    </div>`;
    renderExpenseBreakdown(list, total);
    return;
  }

  const groups = {};
  for (const item of filtered) {
    const key = String(item.date || '').slice(0, 10);
    (groups[key] = groups[key] || []).push(item);
  }
  const dates = Object.keys(groups).sort().reverse();
  container.innerHTML = dates.map((day) => {
    const items = groups[day];
    const dayTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return `<div class="expense-day">
      <div class="expense-day-head"><span>${esc(fmtLong(day))}</span><strong>${formatRupiah(dayTotal)}</strong></div>
      ${items.map((item) => {
        const cat = expenseCategory(item.category);
        const method = EXPENSE_METHODS[item.method] || item.method || '—';
        return `<div class="expense-row" data-expense-id="${item.id}">
          <span class="expense-ico cat-${esc(item.category || 'lainnya')}">${iconSvg(cat.icon)}</span>
          <div class="expense-info">
            <strong>${esc(item.note || cat.label)}</strong>
            <span>${esc(cat.label)} · ${esc(method)}</span>
          </div>
          <span class="expense-amount">−${formatRupiah(item.amount)}</span>
          <div class="expense-actions">
            <button class="icon-btn" data-expense-edit="${item.id}" title="Edit" aria-label="Edit pengeluaran">${iconSvg('edit')}</button>
            <button class="icon-btn" data-expense-del="${item.id}" title="Hapus" aria-label="Hapus pengeluaran">${iconSvg('trash')}</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  renderExpenseBreakdown(filtered, total);
}

function renderExpenseBreakdown(items, total) {
  const box = $('#expenseBreakdown');
  if (!box) return;
  const sums = {};
  for (const item of items) {
    const key = expenseCategory(item.category).label;
    sums[key] = (sums[key] || 0) + Number(item.amount || 0);
  }
  const rows = Object.entries(sums).sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    box.innerHTML = `<div class="side-empty"><strong>Belum ada data</strong><p>Rincian kategori muncul setelah kamu mencatat pengeluaran.</p></div>`;
    return;
  }
  const base = total || rows.reduce((sum, row) => sum + row[1], 0) || 1;
  box.innerHTML = rows.map(([label, amount]) => {
    const pct = Math.round((amount / base) * 100);
    return `<div class="expense-cat">
      <div class="expense-cat-head"><span>${esc(label)}</span><strong>${formatRupiah(amount)}</strong></div>
      <div class="expense-cat-bar"><span style="width:${Math.max(2, pct)}%"></span></div>
      <small>${pct}% dari total</small>
    </div>`;
  }).join('');
}

function openExpenseModal(expense = null) {
  const isEdit = !!expense;
  const today = state.today || todayStr();
  const day = expense ? expense.date : (state.expenseMonth && state.expenseMonth === today.slice(0, 7) ? today : `${state.expenseMonth || today.slice(0, 7)}-01`);
  const body = `
    <div class="form-grid">
      <div class="field">
        <label>Nominal (Rp)</label>
        <input name="amount" type="number" min="1" step="1" inputmode="numeric" required value="${expense ? Number(expense.amount) : ''}" placeholder="15000" />
      </div>
      <div class="field">
        <label>Tanggal</label>
        <input type="date" name="date" required value="${esc(day)}" />
      </div>
      <div class="field">
        <label>Kategori</label>
        <select name="category">
          ${Object.entries(EXPENSE_CATEGORIES).map(([value, item]) => `<option value="${value}" ${(expense ? expense.category : 'makan') === value ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Metode bayar</label>
        <select name="method">
          ${Object.entries(EXPENSE_METHODS).map(([value, label]) => `<option value="${value}" ${(expense ? expense.method : 'tunai') === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}
        </select>
      </div>
      <div class="field full">
        <label>Catatan (opsional)</label>
        <input name="note" maxlength="200" value="${esc(expense ? expense.note || '' : '')}" placeholder="Contoh: nasi goreng kantin" />
      </div>
    </div>`;
  openModal({
    title: isEdit ? 'Edit pengeluaran' : 'Catat pengeluaran',
    eyebrow: 'Uang keluar',
    body,
    submitLabel: isEdit ? 'Simpan perubahan' : 'Simpan pengeluaran',
    onDelete: isEdit ? () => confirmExpenseDelete(expense) : null,
    onSubmit: async (form) => {
      const payload = {
        amount: Number(formValue(form, 'amount')) || 0,
        date: formValue(form, 'date'),
        category: formValue(form, 'category') || 'lainnya',
        method: formValue(form, 'method') || 'tunai',
        note: formValue(form, 'note'),
      };
      if (!payload.amount || payload.amount < 1) throw new Error('Nominal harus lebih dari 0');
      if (isEdit) {
        await api(`/api/expenses/${expense.id}`, { method: 'PATCH', body: payload });
        toast('Pengeluaran diperbarui');
      } else {
        await api('/api/expenses', { method: 'POST', body: payload });
        toast('Pengeluaran dicatat');
      }
      await loadExpenses(state.expenseMonth);
    },
  });
}

function confirmExpenseDelete(expense) {
  confirmDialog({
    title: 'Hapus pengeluaran?',
    message: `<strong>${formatRupiah(expense.amount)}</strong> — ${esc(expense.note || expenseCategory(expense.category).label)} akan dipindahkan ke sampah.`,
    confirmLabel: 'Hapus pengeluaran',
    onConfirm: async () => {
      await api(`/api/expenses/${expense.id}`, { method: 'DELETE' });
      await loadExpenses(state.expenseMonth);
      toastUndo('Pengeluaran dihapus', async () => {
        await api('/api/restore', { method: 'POST', body: { kind: 'expense', id: expense.id } });
        await loadExpenses(state.expenseMonth);
      });
    },
  });
}

function bindExpenseActions() {
  const add = $('#expenseAdd');
  if (add) add.addEventListener('click', () => openExpenseModal());
  const month = $('#expenseMonth');
  if (month) month.addEventListener('change', (e) => {
    if (e.target.value) loadExpenses(e.target.value);
  });
  const search = $('#expenseSearch');
  if (search) {
    search.addEventListener('input', (e) => { state.expenseQuery = e.target.value; renderExpensesView(); });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.target.value = ''; state.expenseQuery = ''; renderExpensesView(); }
    });
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-expense-new]')) { openExpenseModal(); return; }
    const edit = e.target.closest('[data-expense-edit]');
    if (edit) {
      const found = (state.expenses || []).find((item) => item.id === Number(edit.dataset.expenseEdit));
      if (found) openExpenseModal(found);
      return;
    }
    const del = e.target.closest('[data-expense-del]');
    if (del) {
      const found = (state.expenses || []).find((item) => item.id === Number(del.dataset.expenseDel));
      if (found) confirmExpenseDelete(found);
    }
  });
}
