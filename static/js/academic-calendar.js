/* Kalender akademik 2026/2027 + hari libur nasional Indonesia (perkiraan SKB).
   Data dimuat langsung — tidak berubah saat offline. Sumber resmi: kemdikbud.go.id / SKB 3 Menteri. */
'use strict';

const ACADEMIC_YEAR = '2026/2027';

const ACADEMIC_DATES = [
  // Semester ganjil 2026/2027
  { date: '2026-07-13', end_date: '2026-07-18', name: 'Awal tahun ajaran / Masa Pengenalan Lingkungan Sekolah (MPLS)', type: 'akademik' },
  { date: '2026-07-20', end_date: '2026-08-08', name: 'Masa Pengenalan Lingkungan Sekolah (MPLS)', type: 'akademik' },
  { date: '2026-12-21', end_date: '2027-01-03', name: 'Libur Semester Ganjil', type: 'akademik' },
  // Semester genap 2026/2027
  { date: '2027-01-04', end_date: '2027-01-09', name: 'Awal semester genap', type: 'akademik' },
  { date: '2027-03-23', end_date: '2027-04-04', name: 'Libur Hari Raya Idul Fitri', type: 'akademik' },
  { date: '2027-06-15', end_date: '2027-06-26', name: 'Libur akhir tahun ajaran', type: 'akademik' },
  // UTBK / SNBT
  { date: '2027-04-19', end_date: '2027-04-23', name: 'Perkiraan pelaksanaan UTBK-SNBT', type: 'snbt' },
  { date: '2027-05-28', name: 'Perkiraan pengumuman UTBK-SNBT', type: 'snbt' },
];

const NATIONAL_HOLIDAYS = [
  { date: '2026-01-01', name: 'Tahun Baru Masehi' },
  { date: '2026-01-16', name: 'Isra Mikraj' },
  { date: '2026-02-17', name: 'Tahun Baru Imlek 2577' },
  { date: '2026-03-19', name: 'Hari Suci Nyepi' },
  { date: '2026-03-20', name: 'Hari Suci Nyepi (cuti bersama)' },
  { date: '2026-03-21', end_date: '2026-03-22', name: 'Hari Raya Idul Fitri 1447 H' },
  { date: '2026-03-18', end_date: '2026-03-24', name: 'Cuti bersama Idul Fitri 1447 H' },
  { date: '2026-04-03', name: 'Wafat Isa Al Masih' },
  { date: '2026-04-05', name: 'Kebangkitan Isa Al Masih' },
  { date: '2026-05-01', name: 'Hari Buruh Internasional' },
  { date: '2026-05-14', name: 'Kenaikan Isa Al Masih' },
  { date: '2026-05-27', name: 'Hari Raya Waisak 2570 BE' },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila' },
  { date: '2026-06-27', name: 'Hari Raya Idul Adha 1447 H' },
  { date: '2026-07-16', name: 'Tahun Baru Islam 1448 H' },
  { date: '2026-08-17', name: 'Hari Proklamasi Kemerdekaan' },
  { date: '2026-08-26', name: 'Maulid Nabi Muhammad SAW' },
  { date: '2026-12-25', name: 'Hari Raya Natal' },
  { date: '2026-12-24', name: 'Cuti bersama Natal' },
  { date: '2027-01-01', name: 'Tahun Baru Masehi' },
  { date: '2027-01-15', name: 'Isra Mikraj 1448 H' },
  { date: '2027-02-06', name: 'Tahun Baru Imlek 2578' },
  { date: '2027-03-10', name: 'Hari Suci Nyepi' },
  { date: '2027-03-11', end_date: '2027-03-12', name: 'Cuti bersama Nyepi' },
  { date: '2027-03-12', end_date: '2027-03-13', name: 'Hari Raya Idul Fitri 1448 H' },
  { date: '2027-03-09', end_date: '2027-03-15', name: 'Cuti bersama Idul Fitri' },
  { date: '2027-03-25', name: 'Wafat Isa Al Masih' },
  { date: '2027-04-27', name: 'Kenaikan Isa Al Masih' },
  { date: '2027-05-16', name: 'Hari Raya Waisak 2571 BE' },
  { date: '2027-06-01', name: 'Hari Lahir Pancasila' },
  { date: '2027-05-18', name: 'Hari Raya Idul Adha 1448 H' },
  { date: '2027-06-06', name: 'Tahun Baru Islam 1449 H' },
  { date: '2027-08-16', name: 'Isra Miraj Nabi Muhammad SAW' },
  { date: '2027-08-17', name: 'Hari Proklamasi Kemerdekaan' },
  { date: '2027-08-25', name: 'Maulid Nabi Muhammad SAW' },
  { date: '2027-12-25', name: 'Hari Raya Natal' },
  { date: '2027-12-24', name: 'Cuti bersama Natal' },
];

function dateRangeIncludes(start, end, ymd) {
  return !end ? ymd >= start && ymd <= start : ymd >= start && ymd <= end;
}

function holidayOn(ymd) {
  return NATIONAL_HOLIDAYS.find((h) => dateRangeIncludes(h.date, h.end_date || h.date, ymd)) || null;
}

function academicEventOn(ymd) {
  return ACADEMIC_DATES.find((h) => dateRangeIncludes(h.date, h.end_date || h.date, ymd)) || null;
}

function formatAcademicRange(e) {
  if (!e) return '';
  const start = new Date(e.date + 'T00:00:00');
  const same = !e.end_date || e.end_date === e.date;
  const fmt = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return same ? fmt(start) : `${fmt(start)} – ${fmt(new Date(e.end_date + 'T00:00:00'))}`;
}

function renderAcademicCalendar() {
  const list = document.getElementById('academicList');
  if (!list) return;
  const items = ACADEMIC_DATES.map((e) => {
    const start = new Date(e.date + 'T00:00:00');
    const over = e.end_date ? new Date(e.end_date + 'T23:59:59') : new Date(e.date + 'T23:59:59');
    return { ...e, start, over, label: formatAcademicRange(e) };
  }).sort((a, b) => a.start - b.start);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = items.filter((i) => i.over >= today);
  const source = document.getElementById('academicSourceTag');
  if (source) source.textContent = ACADEMIC_YEAR;
  const yearTitle = document.getElementById('academicYearTitle');
  if (yearTitle) yearTitle.textContent = `Tahun ajaran ${ACADEMIC_YEAR}`;
  list.innerHTML = upcoming.slice(0, 8).map((e) => `
    <li>
      <span class="ac-date">${new Date(e.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
      <strong>${e.name}</strong>
      <small>${e.label}${e.type === 'snbt' ? ' · UTBK/SNBT' : ''}</small>
    </li>`).join('');
}

function markHolidayCells() {
  document.querySelectorAll('[data-cal-day]').forEach((cell) => {
    const ymd = cell.dataset.calDay;
    const holiday = holidayOn(ymd);
    if (holiday) {
      cell.classList.add('holiday');
      cell.title = holiday.name;
    } else {
      cell.classList.remove('holiday');
      cell.removeAttribute('title');
    }
  });
}

function updateHolidayHint(selected) {
  const hint = document.getElementById('calHolidayHint');
  if (!hint) return;
  const holiday = holidayOn(selected || new Date().toISOString().slice(0, 10));
  if (!holiday) {
    hint.hidden = true;
    return;
  }
  hint.hidden = false;
  const title = document.getElementById('calHolidayTitle');
  const desc = document.getElementById('calHolidayDesc');
  if (title) title.textContent = holiday.name;
  if (desc) desc.textContent = holiday.end_date && holiday.end_date !== holiday.date ? `${holiday.date} – ${holiday.end_date}` : holiday.date;
}
