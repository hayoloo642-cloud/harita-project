/* ============================================================
   Inbox cepat — tangkap tugas / catatan / agenda / uang
   ============================================================ */
const INBOX_TYPE_META = {
  task: { ico: 'check-square', label: 'Tugas' },
  note: { ico: 'note', label: 'Catatan' },
  expense: { ico: 'wallet', label: 'Pengeluaran' },
  event: { ico: 'calendar', label: 'Agenda' },
};

function inboxAmountToNumber(raw, suffix) {
  const normalized = String(raw || '').replace(/,/g, '.');
  let value = Number(normalized);
  if (!Number.isFinite(value)) return 0;
  const unit = String(suffix || '').toLowerCase();
  if (['rb', 'ribu', 'k'].includes(unit)) value *= 1_000;
  else if (['jt', 'juta'].includes(unit)) value *= 1_000_000;
  else if (unit === 'm' || unit === 'miliar') value *= 1_000_000_000;
  return Math.round(value);
}

function inboxDateFromText(text) {
  const day = todayStr();
  const tomorrow = todayStr(1);
  const dayAfter = todayStr(2);
  const lower = String(text || '').toLowerCase();
  if (/\bbesok\b/.test(lower)) return tomorrow;
  if (/\blusa\b/.test(lower)) return dayAfter;
  if (/\bhari ini\b|\btoday\b/.test(lower)) return day;
  const weekdays = {
    senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6, minggu: 0,
  };
  const match = lower.match(/\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)\b/);
  if (match) {
    const target = weekdays[match[1]];
    const now = new Date();
    let delta = (target - now.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return todayStr(delta);
  }
  return day;
}

function inboxGuessCategory(text) {
  const t = String(text || '').toLowerCase();
  if (/makan|nasi|kopi|ayam|minum|jajan|bakso|mie/.test(t)) return 'makan';
  if (/ojek|bensin|angkot|parkir|bus|kereta|krl|gojek|grab/.test(t)) return 'transport';
  if (/buku|kursus|kelas|les|belajar|soal/.test(t)) return 'belajar';
  if (/nonton|film|game|konser|spotify/.test(t)) return 'hiburan';
  if (/dokter|obat|vitamin|sakit/.test(t)) return 'kesehatan';
  if (/baju|celana|belanja|sepatu/.test(t)) return 'belanja';
  if (/pulsa|listrik|internet|tagihan|wifi/.test(t)) return 'tagihan';
  return 'lainnya';
}

function parseInbox(text) {
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const date = inboxDateFromText(lower);

  const noteMatch = raw.match(/^(?:catatan|note)\s*[:\-]\s*(.+)$/i);
  if (noteMatch) return { type: 'note', title: noteMatch[1].trim(), date };

  const expenseMatch = raw.match(/^(?:pengeluaran|uang|beli|bayar|belanja)\s*[:\-]?\s*(.*)$/i);
  const amountMatch = raw.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|jt|juta|miliar|m|k)?(?=\s|$)/i);
  if (expenseMatch || (amountMatch && /\b(pengeluaran|beli|bayar|belanja|makan|minum|kopi|nasi|ojek|bensin|pulsa|tagihan|jajan)\b/i.test(raw))) {
    const amount = amountMatch ? inboxAmountToNumber(amountMatch[1], amountMatch[2]) : 0;
    const note = raw
      .replace(/^(?:pengeluaran|uang|beli|bayar|belanja)\s*[:\-]?\s*/i, '')
      .replace(/(?:rp\.?\s*)?\d+(?:[.,]\d+)?\s*(?:rb|ribu|jt|juta|miliar|m|k)?/i, '')
      .replace(/\b(beo|besok|lusa|hari ini)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      type: 'expense',
      amount: amount || 0,
      category: inboxGuessCategory(raw),
      method: 'tunai',
      note: note || raw.replace(/^(?:pengeluaran|uang|beli|bayar|belanja)\s*[:\-]?\s*/i, '').trim() || 'Pengeluaran',
      date,
    };
  }

  const eventMatch = raw.match(/^(?:agenda|kalender|jadwal)\s*[:\-]\s*(.+)$/i);
  if (eventMatch) return { type: 'event', title: eventMatch[1].trim(), date };

  const taskMatch = raw.match(/^(?:[-*]\s*|\[\s*\]\s*)(.+)$/);
  return { type: 'task', title: (taskMatch ? taskMatch[1] : raw).replace(/\s+/g, ' ').trim(), date };
}

function inboxPreview(parsed) {
  if (!parsed) return 'Tulis sesuatu…';
  if (parsed.type === 'task') return `Tugas: ${parsed.title || 'Tanpa judul'}`;
  if (parsed.type === 'note') return `Catatan: ${parsed.title || 'Tanpa judul'}`;
  if (parsed.type === 'event') return `Agenda ${parsed.date ? fmtLong(parsed.date) : ''}: ${parsed.title || 'Tanpa judul'}`;
  if (parsed.type === 'expense') {
    const amount = parsed.amount ? formatRupiah(parsed.amount) : 'nominal belum terdeteksi';
    return `Pengeluaran ${amount}: ${parsed.note || 'Tanpa catatan'}`;
  }
  return '';
}

function openInboxModal() {
  const body = `
    <div class="inbox-modal">
      <textarea id="inboxInput" class="inbox-input" rows="4" maxlength="500" autofocus placeholder="Tulis apa saja…"></textarea>
      <p class="inbox-preview" id="inboxPreview">Akan disimpan sebagai: —</p>
      <div class="inbox-chips" aria-label="Contoh">
        <button type="button" class="chip" data-inbox-example="- Baca 10 halaman buku bio">- Baca 10 halaman buku bio</button>
        <button type="button" class="chip" data-inbox-example="Beli kopi 18rb">Beli kopi 18rb</button>
        <button type="button" class="chip" data-inbox-example="Catatan: rumus limit">Catatan: rumus limit</button>
        <button type="button" class="chip" data-inbox-example="Agenda: lomba fisika besok">Agenda: lomba fisika besok</button>
      </div>
      <p class="help">Prefix: <code>-</code> tugas, <code>Catatan:</code> catatan, <code>Agenda:</code> agenda, angka + rb/jt untuk pengeluaran.</p>
    </div>`;
  openModal({
    title: 'Inbox cepat',
    eyebrow: 'Tangkap dulu, rapikan nanti',
    body,
    submitLabel: 'Simpan ke Harita',
    onSubmit: async (form) => {
      const input = form.querySelector('#inboxInput');
      const parsed = parseInbox(input ? input.value : '');
      if (!parsed) throw new Error('Tulis sesuatu dulu');
      if (parsed.type === 'task') {
        if (!parsed.title) throw new Error('Isi tugas tidak boleh kosong');
        await api('/api/tasks', { method: 'POST', body: { date: parsed.date, title: parsed.title, priority: 2, source: 'quick' } });
        await loadTasks(state.taskDate, { silent: true });
        toast('Tugas masuk inbox');
      } else if (parsed.type === 'note') {
        if (!parsed.title) throw new Error('Isi catatan tidak boleh kosong');
        await api('/api/notes', { method: 'POST', body: { title: parsed.title, body: '' } });
        await loadNotes();
        toast('Catatan disimpan');
      } else if (parsed.type === 'expense') {
        if (!parsed.amount || parsed.amount < 1) throw new Error('Nominal tidak terdeteksi — contoh: beli kopi 18rb');
        await api('/api/expenses', { method: 'POST', body: { date: parsed.date, amount: parsed.amount, category: parsed.category, method: parsed.method, note: parsed.note } });
        await loadExpenses(state.expenseMonth);
        toast('Pengeluaran dicatat');
      } else if (parsed.type === 'event') {
        if (!parsed.title) throw new Error('Isi agenda tidak boleh kosong');
        await api('/api/events', { method: 'POST', body: { date: parsed.date, title: parsed.title, category: 'pribadi' } });
        await loadEvents();
        toast('Agenda disimpan');
      }
      if (state.view === 'beranda') renderDashboard();
    },
  });
  setTimeout(() => {
    const input = $('#inboxInput');
    const preview = $('#inboxPreview');
    if (!input || !preview) return;
    const update = () => { preview.innerHTML = `Akan disimpan sebagai: <strong>${esc(inboxPreview(parseInbox(input.value)))}</strong>`; };
    update();
    input.addEventListener('input', update);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#modalSubmit')?.click(); }
    });
    document.querySelectorAll('[data-inbox-example]').forEach((chip) => chip.addEventListener('click', () => {
      input.value = chip.dataset.inboxExample || '';
      update();
      input.focus();
    }));
  }, 60);
}

function bindInbox() {
  const button = $('#inboxAdd');
  if (button) button.addEventListener('click', openInboxModal);
  document.addEventListener('keydown', (e) => {
    const isMac = /Mac/i.test(navigator.platform || '');
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.altKey && (e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      openInboxModal();
    }
  });
}
