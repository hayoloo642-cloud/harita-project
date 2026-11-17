/* ============================================================
   i18n — Indonesian (default) + English chrome
   Dynamic view strings are translated via STATIC_EN where the
   Indonesian text matches exactly. Language changes reload the app.
   ============================================================ */
const I18N = {
  id: {
    'nav.group.daily': 'Harian',
    'nav.group.study': 'Belajar',
    'nav.group.other': 'Lainnya',
    'nav.group.pinned': 'Semat',
    'nav.home': 'Beranda',
    'nav.tasks': 'Tugas',
    'nav.calendar': 'Kalender',
    'nav.focus': 'Fokus',
    'nav.competitions': 'Lomba',
    'nav.schedule': 'Jadwal',
    'nav.grades': 'Nilai',
    'nav.flashcards': 'Flashcard',
    'nav.notes': 'Catatan',
    'nav.streak': 'Streak',
    'nav.music': 'Musik',
    'nav.weather': 'Cuaca',
    'top.refresh': 'Segarkan',
    'top.settings': 'Pengaturan',
    'settings.title': 'Pengaturan',
    'settings.profile': 'Profil',
    'settings.name': 'Nama kamu',
    'settings.location': 'Lokasi cuaca utama',
    'settings.appearance': 'Tampilan',
    'settings.theme': 'Tema',
    'settings.theme.dark': 'Gelap',
    'settings.theme.light': 'Terang',
    'settings.theme.system': 'Sistem',
    'settings.accent': 'Aksen warna',
    'settings.fontSize': 'Ukuran teks',
    'settings.size.small': 'Kecil',
    'settings.size.normal': 'Normal',
    'settings.size.large': 'Besar',
    'settings.contrast': 'Kontras tampilan',
    'settings.contrast.normal': 'Normal',
    'settings.contrast.high': 'Tinggi',
    'settings.language': 'Bahasa antarmuka',
    'settings.defaultView': 'Halaman utama saat dibuka',
    'settings.navManage': 'Atur item sidebar',
    'settings.pin': 'Semat',
    'settings.hide': 'Sembunyi',
    'settings.tasks': 'Tugas',
    'settings.notifications': 'Notifikasi',
    'settings.security': 'Keamanan',
    'settings.data': 'Data',
    'settings.save': 'Simpan pengaturan',
    'settings.backup': 'Unduh backup JSON',
    'settings.demo': 'Isi data contoh',
    'settings.clearCache': 'Bersihkan cache file',
    'settings.diagnostics': 'Salin info sistem',
    'settings.reset': 'Hapus semua data',
    'settings.restore': 'Pulihkan backup terbaru',
    'settings.downloadCorrupt': 'Unduh file rusak',
    'settings.reminderLead': 'Ingatkan berapa menit sebelumnya',
    'settings.sound': 'Suara timer',
    'settings.notifyBrowser': 'Notifikasi browser',
    'settings.pinLock': 'Kunci aplikasi dengan PIN (opsional)',
    'common.cancel': 'Batal',
    'common.save': 'Simpan',
    'common.delete': 'Hapus',
    'common.close': 'Tutup',
    'common.search': 'Cari…',
    'page.beranda.eyebrow': 'Ringkasan hari ini',
    'page.beranda.title': 'Beranda',
    'page.cuaca.eyebrow': 'Realtime · Lokal',
    'page.cuaca.title': 'Cuaca',
    'page.tugas.eyebrow': 'Checklist harian',
    'page.tugas.title': 'Tugas',
    'page.kalender.eyebrow': 'Agenda & jadwal',
    'page.kalender.title': 'Kalender',
    'page.lomba.eyebrow': 'Deadline & persiapan',
    'page.lomba.title': 'Lomba',
    'page.fokus.eyebrow': 'Pomodoro & produktivitas',
    'page.fokus.title': 'Fokus',
    'page.catatan.eyebrow': 'Ide & materi',
    'page.catatan.title': 'Catatan',
    'page.jadwal.eyebrow': 'Jadwal pelajaran',
    'page.jadwal.title': 'Jadwal',
    'page.nilai.eyebrow': 'Nilai & KKM',
    'page.nilai.title': 'Nilai',
    'page.flashcard.eyebrow': 'Flashcard · SM-2',
    'page.flashcard.title': 'Flashcard',
    'page.device.eyebrow': 'Performa laptop',
    'page.device.title': 'Device',
    'page.music.eyebrow': 'Music player',
    'page.music.title': 'Musik',
    'page.streak.eyebrow': 'Streak konsistensi',
    'page.streak.title': 'Streak',
  },
  en: {
    'nav.group.daily': 'Daily',
    'nav.group.study': 'Study',
    'nav.group.other': 'More',
    'nav.group.pinned': 'Pinned',
    'nav.home': 'Home',
    'nav.tasks': 'Tasks',
    'nav.calendar': 'Calendar',
    'nav.focus': 'Focus',
    'nav.competitions': 'Competitions',
    'nav.schedule': 'Schedule',
    'nav.grades': 'Grades',
    'nav.flashcards': 'Flashcards',
    'nav.notes': 'Notes',
    'nav.streak': 'Streak',
    'nav.music': 'Music',
    'nav.weather': 'Weather',
    'top.refresh': 'Refresh',
    'top.settings': 'Settings',
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
    'settings.name': 'Your name',
    'settings.location': 'Primary weather location',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.theme.dark': 'Dark',
    'settings.theme.light': 'Light',
    'settings.theme.system': 'System',
    'settings.accent': 'Accent colour',
    'settings.fontSize': 'Text size',
    'settings.size.small': 'Small',
    'settings.size.normal': 'Normal',
    'settings.size.large': 'Large',
    'settings.contrast': 'Display contrast',
    'settings.contrast.normal': 'Normal',
    'settings.contrast.high': 'High',
    'settings.language': 'Interface language',
    'settings.defaultView': 'Start page',
    'settings.navManage': 'Manage sidebar items',
    'settings.pin': 'Pin',
    'settings.hide': 'Hide',
    'settings.tasks': 'Tasks',
    'settings.notifications': 'Notifications',
    'settings.security': 'Security',
    'settings.data': 'Data',
    'settings.save': 'Save settings',
    'settings.backup': 'Download JSON backup',
    'settings.demo': 'Fill demo data',
    'settings.clearCache': 'Clear file cache',
    'settings.diagnostics': 'Copy system info',
    'settings.reset': 'Erase all data',
    'settings.restore': 'Restore latest backup',
    'settings.downloadCorrupt': 'Download corrupt file',
    'settings.reminderLead': 'Remind me this many minutes before',
    'settings.sound': 'Timer sound',
    'settings.notifyBrowser': 'Browser notifications',
    'settings.pinLock': 'Lock with a PIN (optional)',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.search': 'Search…',
    'page.beranda.eyebrow': "Today's summary",
    'page.beranda.title': 'Home',
    'page.cuaca.eyebrow': 'Realtime · Local',
    'page.cuaca.title': 'Weather',
    'page.tugas.eyebrow': 'Daily checklist',
    'page.tugas.title': 'Tasks',
    'page.kalender.eyebrow': 'Events & schedule',
    'page.kalender.title': 'Calendar',
    'page.lomba.eyebrow': 'Deadlines & prep',
    'page.lomba.title': 'Competitions',
    'page.fokus.eyebrow': 'Pomodoro & productivity',
    'page.fokus.title': 'Focus',
    'page.catatan.eyebrow': 'Ideas & material',
    'page.catatan.title': 'Notes',
    'page.jadwal.eyebrow': 'Class schedule',
    'page.jadwal.title': 'Schedule',
    'page.nilai.eyebrow': 'Grades & pass mark',
    'page.nilai.title': 'Grades',
    'page.flashcard.eyebrow': 'Flashcards · SM-2',
    'page.flashcard.title': 'Flashcards',
    'page.device.eyebrow': 'Laptop performance',
    'page.device.title': 'Device',
    'page.music.eyebrow': 'Music player',
    'page.music.title': 'Music',
    'page.streak.eyebrow': 'Consistency streak',
    'page.streak.title': 'Streak',
  },
};

function currentLang() {
  return (typeof state !== 'undefined' && state.settings && state.settings.language) || 'id';
}

function t(key, fallback) {
  const lang = currentLang();
  const dict = I18N[lang] || I18N.id;
  if (dict[key] !== undefined) return dict[key];
  if (I18N.id[key] !== undefined) return I18N.id[key];
  return fallback !== undefined ? fallback : key;
}

function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n, el.textContent);
  });
  scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria, el.getAttribute('aria-label') || ''));
  });
  scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.dataset.i18nTitle, el.getAttribute('title') || ''));
  });
  scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder, el.getAttribute('placeholder') || ''));
  });
}

/* Exact Indonesian → English map for static and freshly rendered markup. */
const STATIC_EN = {
  'Harian': 'Daily', 'Belajar': 'Study', 'Lainnya': 'More', 'Semat': 'Pinned',
  'Beranda': 'Home', 'Tugas': 'Tasks', 'Kalender': 'Calendar', 'Fokus': 'Focus',
  'Lomba': 'Competitions', 'Jadwal': 'Schedule', 'Nilai': 'Grades', 'Flashcard': 'Flashcards',
  'Catatan': 'Notes', 'Streak': 'Streak', 'Musik': 'Music', 'Cuaca': 'Weather', 'Pengaturan': 'Settings',
  'Segarkan': 'Refresh', 'Muat ulang…': 'Reloading…', 'Segarkan aplikasi — muat file terbaru': 'Refresh app — load latest files',
  'Ganti tema gelap/terang': 'Toggle dark/light theme', 'Lihat cuaca lengkap': 'See full weather',
  'Shortcut keyboard (Ctrl+/)': 'Keyboard shortcuts (Ctrl+/)',
  'Tugas harian': 'Daily tasks',
  'Checklist otomatis direset setiap hari — yang belum selesai bisa dibawa.': 'The checklist resets daily — unfinished tasks can be carried over.',
  'Pilih': 'Select', 'Bawa dari kemarin': 'Carry from yesterday', 'Tugas baru': 'New task',
  'Hari ini': 'Today', 'Penting': 'Important', 'Normal': 'Normal', 'Santai': 'Relaxed', 'Detail': 'Details',
  'Selesai': 'Done', 'Pindah tanggal': 'Move date', 'Hapus': 'Delete', 'Batal': 'Cancel',
  'Semua': 'All', 'Aktif': 'Active', 'Selesaikan semua': 'Complete all',
  'Rutinitas harian': 'Daily routines', 'Rutinitas muncul otomatis di setiap hari baru.': 'Routines appear automatically each new day.',
  'Cadangan': 'Backup', 'Data': 'Data',
  'Tugas, agenda, catatan, dan progres tersimpan di SQLite lokal. Unduh salinan kapan saja.': 'Tasks, events, notes, and progress live in local SQLite. Download a copy anytime.',
  'Unduh backup JSON': 'Download JSON backup', 'Reset tugas hari ini': 'Reset today\'s tasks',
  'Agenda sekolah, lomba, tugas, dan kegiatan pribadi dalam satu tempat.': 'School events, competitions, tasks, and personal plans in one place.',
  'Lomba & proyek': 'Competitions & projects',
  'Pantau deadline, progres persiapan, dan checklist kebutuhanmu.': 'Track deadlines, preparation progress, and your checklist.',
  'Tambah lomba': 'Add competition', 'Cari lomba…': 'Search competitions…',
  'Ruang fokus': 'Focus room',
  'Pomodoro sederhana supaya belajar dan mengerjakan proyek lebih terarah.': 'A simple Pomodoro to keep study and project work on track.',
  'Catatan cepat': 'Quick notes', 'Ide, materi lomba, rumus, atau hal yang tidak boleh lupa.': 'Ideas, competition material, formulas, or things you must not forget.',
  'Jadwal sekolah': 'School schedule',
  'Atur jadwal pelajaran tetap. Hari ini otomatis tampil di beranda dan agenda.': 'Set your regular class schedule. Today appears automatically on Home and Calendar.',
  'Performa Device': 'Device performance',
  'Monitor CPU, RAM, penyimpanan, baterai, dan jaringan laptop secara realtime.': 'Monitor CPU, RAM, storage, battery, and network in realtime.',
  'Music Player': 'Music Player',
  'Putar musik lokal di laptop. Taruh file audio di folder music/ di dalam folder MyAct.': 'Play local music. Put audio files in the music/ folder inside MyAct.',
  'Streak & Kebiasaan': 'Streak & Habits',
  'Catat kebiasaan harian kamu — lihat berapa hari berturut-turut tetap terjaga.': 'Log your daily habits and see how many days in a row you stay consistent.',
  'Nilai & KKM': 'Grades & Pass Mark',
  'Catat nilai tiap mapel — lihat posisimu terhadap KKM dan cetak laporan.': 'Record each subject score, compare it with the pass mark, and print a report.',
  'Cari mapel / jenis…': 'Search subject / type…',
  'Kartu pintar dengan SM-2 spaced repetition — ulangi tepat waktu sebelum kamu lupa.': 'Smart cards with SM-2 spaced repetition — review on time before you forget.',
  'Pertanyaan': 'Question', 'Lihat jawaban': 'Show answer', 'Jawaban': 'Answer',
  'Lupa': 'Again', 'Sulit': 'Hard', 'Bagus': 'Good', 'Mudah': 'Easy',
  'Selamat datang di MyAct': 'Welcome to MyAct',
  'Dashboard harian kamu — cuaca, tugas, jadwal, lomba, fokus belajar. Semuanya di laptop ini, tanpa akun.': 'Your daily dashboard — weather, tasks, schedule, competitions, focus. All on this laptop, no account.',
  'Simpan catatan': 'Save note', 'Catatan baru': 'New note', 'Edit catatan': 'Edit note',
  'Cari catatan…': 'Search notes…', 'Cari tugas…': 'Search tasks…', 'Cari agenda…': 'Search events…',
  'Profil': 'Profile', 'Tampilan': 'Appearance', 'Tema': 'Theme', 'Gelap': 'Dark', 'Terang': 'Light', 'Sistem': 'System',
  'Aksen warna': 'Accent colour', 'Ukuran teks': 'Text size', 'Kecil': 'Small', 'Besar': 'Large',
  'Kontras tampilan': 'Display contrast', 'Tinggi': 'High', 'Halaman utama saat dibuka': 'Start page',
  'Atur item sidebar': 'Manage sidebar items', 'Sembunyi': 'Hide', 'Notifikasi': 'Notifications',
  'Keamanan': 'Security', 'Simpan pengaturan': 'Save settings',
  'Isi data contoh': 'Fill demo data', 'Bersihkan cache file': 'Clear file cache',
  'Salin info sistem': 'Copy system info', 'Hapus semua data': 'Erase all data',
  'Pulihkan backup terbaru': 'Restore latest backup', 'Unduh file rusak': 'Download corrupt file',
  'Memeriksa status database…': 'Checking database status…',
  'Database lama terdeteksi rusak': 'Old database detected as corrupt',
  'Abaikan': 'Ignore', 'Pulihkan dari backup': 'Restore from backup',
  'Tugas baru — dari halaman mana pun': 'New task — from any page',
  'Centang tugas yang terakhir disentuh / difokuskan': 'Toggle the last focused task',
  'Hapus tugas yang terakhir difokuskan': 'Delete the last focused task',
  'Shortcut keyboard': 'Keyboard shortcuts',
};

function localizeStatic() {
  if (currentLang() !== 'en') return;
  const skip = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE']);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || skip.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-no-i18n]')) return NodeFilter.FILTER_REJECT;
      const text = node.nodeValue.trim();
      return text && STATIC_EN[text] !== undefined ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const raw = node.nodeValue;
    const trimmed = raw.trim();
    const translated = STATIC_EN[trimmed];
    if (translated === undefined) return;
    node.nodeValue = raw.replace(trimmed, translated);
  });
  document.querySelectorAll('input[placeholder]').forEach((el) => {
    const translated = STATIC_EN[el.placeholder.trim()];
    if (translated) el.placeholder = translated;
  });
}
