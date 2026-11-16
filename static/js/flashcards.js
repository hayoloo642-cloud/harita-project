/* ============================================================
   Flashcards — SM-2 spaced repetition (F3)
   ============================================================ */
state.flashcards = { cards: [], due: [], subject: '', showAnswer: false, session: [] };

async function loadFlashcards() {
  try {
    const [all, due] = await Promise.all([
      api('/api/flashcards'),
      api('/api/flashcards?mode=due'),
    ]);
    state.flashcards.cards = all.cards || [];
    state.flashcards.due = due.cards || [];
    renderFlashcardsView();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderFlashcardsView() {
  const count = $('#flashcardCount');
  if (!count) return;
  const subjects = [...new Set(state.flashcards.cards.map((c) => c.subject))];
  count.textContent = `${state.flashcards.cards.length} kartu · ${subjects.length} mapel · ${state.flashcards.due.length} menunggu`;

  // subject filter pills
  const pillWrap = $('#flashcardSubjects');
  pillWrap.innerHTML = `<button class="loc-pill ${state.flashcards.subject === '' ? 'active' : ''}" data-fc-subject="">Semua</button>` +
    subjects.sort().map((s) => `<button class="loc-pill ${state.flashcards.subject === s ? 'active' : ''}" data-fc-subject="${esc(s)}">${esc(s)}</button>`).join('');

  // due list
  const dueWrap = $('#flashcardDueList');
  dueWrap.innerHTML = state.flashcards.due.length
    ? state.flashcards.due.map((c) => `
      <div class="fc-row"><div><strong>${esc(c.front)}</strong><span>${esc(c.subject)}</span></div>
        <button class="btn btn-primary btn-sm" data-fc-review="${c.id}">Pelajari</button></div>`).join('')
    : `<div class="empty-state"><div class="empty-state-ico"><span class="ico" data-icon="check-circle"></span></div><strong>Semua kartu sudah dipelajari</strong><span>Biling kartu kamu hari ini selesai. Kartu yang perlu diulang akan kembali saat jatuh tempo SM-2.</span></div>`;

  // library
  const lib = $('#flashcardLibrary');
  const filtered = state.flashcards.subject ? state.flashcards.cards.filter((c) => c.subject === state.flashcards.subject) : state.flashcards.cards;
  lib.innerHTML = filtered.length
    ? filtered.map((c) => `
      <div class="fc-card" data-fc-card="${c.id}">
        <div class="fc-subject">${esc(c.subject)}</div>
        <div class="fc-front">${esc(c.front)}</div>
        <div class="fc-answer">${esc(c.back)}</div>
        <div class="fc-foot"><button class="icon-btn xs" data-fc-del="${c.id}" aria-label="Hapus kartu"><span class="ico">${iconSvg('trash')}</span></button></div>
      </div>`).join('')
    : '<div class="empty-state"><div class="empty-state-ico"><span class="ico" data-icon="book"></span></div><strong>Belum ada kartu</strong><span>Tambah kartu dari form di atas — cocok untuk rumus, definisi, kosakata.</span></div>';
}

async function gradeFlashcard(id, grade) {
  try {
    await api(`/api/flashcards/${id}/grade`, { method: 'POST', body: { grade } });
    state.flashcards.due = state.flashcards.due.filter((c) => c.id !== id);
    renderFlashcardsView();
    const overlay = $('#flashcardReview');
    if (state.flashcards.session.length) {
      showFlashcardReview(state.flashcards.session[0]);
    } else {
      overlay.hidden = true;
      toast('Sesi flashcard selesai');
    }
  } catch (err) { toast(err.message, 'error'); }
}

function showFlashcardReview(card) {
  const overlay = $('#flashcardReview');
  if (!overlay || !card) return;
  overlay.hidden = false;
  $('#fcReviewSubject').textContent = card.subject;
  $('#fcReviewFront').textContent = card.front;
  $('#fcReviewAnswer').textContent = card.back;
  $('#fcReviewAnswer').hidden = true;
  $('#fcReveal').hidden = false;
  $('#fcGradeButtons').hidden = true;
}

function bindFlashcardActions() {
  $('#flashcardAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const subject = formValue(form, 'subject');
    const front = formValue(form, 'front');
    const back = formValue(form, 'back');
    const err = $('#flashcardError');
    err.classList.remove('show');
    if (!subject || !front || !back) { err.textContent = 'Semua kolom wajib diisi'; err.classList.add('show'); return; }
    try {
      await api('/api/flashcards', { method: 'POST', body: { subject, front, back } });
      form.querySelector('#fcFront').value = '';
      form.querySelector('#fcBack').value = '';
      await loadFlashcards();
      toast('Kartu ditambahkan');
    } catch (e2) { err.textContent = e2.message; err.classList.add('show'); }
  });
  $('#flashcardSubjects').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fc-subject]');
    if (!btn) return;
    state.flashcards.subject = btn.dataset.fcSubject;
    renderFlashcardsView();
  });
  $('#flashcardLibrary').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-fc-del]');
    if (del) {
      const id = Number(del.dataset.fcDel);
      const card = state.flashcards.cards.find((c) => c.id === id);
      confirmDialog({
        title: 'Hapus kartu?',
        message: `<strong>${esc(card?.front || '')}</strong> akan dihapus permanen.`,
        confirmLabel: 'Hapus kartu',
        onConfirm: async () => { await api(`/api/flashcards/${id}`, { method: 'DELETE' }); await loadFlashcards(); toast('Kartu dihapus'); },
      });
      return;
    }
    const card = e.target.closest('[data-fc-card]');
    if (card) {
      const id = Number(card.dataset.fcCard);
      const found = state.flashcards.cards.find((c) => c.id === id);
      if (found) { state.flashcards.subject = found.subject; renderFlashcardsView(); }
    }
  });
  $('#flashcardDueList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fc-review]');
    if (!btn) return;
    const id = Number(btn.dataset.fcReview);
    const due = state.flashcards.due;
    const idx = due.findIndex((c) => c.id === id);
    state.flashcards.session = due.slice(idx);
    showFlashcardReview(due[idx]);
  });
  $('#fcReveal').addEventListener('click', () => {
    $('#fcReviewAnswer').hidden = false;
    $('#fcReveal').hidden = true;
    $('#fcGradeButtons').hidden = false;
  });
  $('#fcGradeButtons').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fc-grade]');
    if (!btn) return;
    const card = state.flashcards.session.shift();
    if (card) gradeFlashcard(card.id, Number(btn.dataset.fcGrade));
  });
  $('#fcReviewClose').addEventListener('click', () => {
    $('#flashcardReview').hidden = true;
    loadFlashcards();
  });
}
