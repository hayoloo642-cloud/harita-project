/* ============================================================
   Music player (lokal, tanpa API eksternal)
   ============================================================ */
const musicState = {
  tracks: [],
  filtered: [],
  currentId: null,
  playing: false,
  volume: 70,
  audio: null,
  progressTimer: null,
  seekDragging: false,
};

function initMusic() {
  const audio = new Audio();
  audio.preload = "metadata";
  musicState.audio = audio;
  audio.addEventListener("loadedmetadata", () => {
    $("#mpDur").textContent = fmtTime(audio.duration);
    $("#npbProgress").style.width = "0%";
    $("#mpProgress").style.width = "0%";
  });
  audio.addEventListener("timeupdate", () => {
    if (musicState.seekDragging) return;
    const now = Date.now();
    if (now - (musicState._lastUi || 0) < 400) return;
    musicState._lastUi = now;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    $("#mpProgress").style.width = `${pct}%`;
    $("#npbProgress").style.width = `${pct}%`;
    $("#mpCur").textContent = fmtTime(audio.currentTime);
  });
  audio.addEventListener("ended", () => {
    musicNext();
  });
  audio.addEventListener("error", (e) => {
    console.error("Audio error", e);
    toast("Gagal memutar musik", "error");
  });
}

function fmtTime(s) {
  if (!s || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

async function loadMusic() {
  try {
    const [lib, state] = await Promise.all([
      api("/api/music/library"),
      api("/api/music/state"),
    ]);
    musicState.tracks = lib.tracks || [];
    musicState.filtered = [...musicState.tracks];
    musicState.currentId = state.now_playing ? Number(state.now_playing) : null;
    musicState.playing = state.paused === false;
    musicState.volume = state.volume || 70;
    if (musicState.audio) musicState.audio.volume = musicState.volume / 100;
    renderMusicList();
    updateMusicPlayerUI();
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderMusicList() {
  const list = $("#musicTrackList");
  const count = $("#musicCount");
  if (!list) return;
  const q = $("#musicSearch").value.trim().toLowerCase();
  const items = q
    ? musicState.tracks.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q))
    : musicState.tracks;
  musicState.filtered = items;
  if (count) count.textContent = `${items.length} lagu`;
  if (!items.length) {
    list.innerHTML = `<div class="hint" style="padding:30px 12px;text-align:center">Tidak ada lagu yang cocok.</div>`;
    return;
  }
  list.innerHTML = items.map((t, idx) => {
    const active = musicState.currentId === t.id ? "active" : "";
    const art = `/api/music/file/${encodeURIComponent(t.path)}`;
    return `<div class="music-track-row ${active}" data-track-id="${t.id}">
      <span class="mt-num">${idx + 1}</span>
      <div class="mt-art" style="background:url('${art}') center/cover no-repeat,var(--panel-solid)"></div>
      <div class="mt-info">
        <div class="mt-title">${esc(t.title)}</div>
        <div class="mt-artist">${esc(t.artist || "Artis tidak diketahui")}</div>
      </div>
      <span class="mt-dur">${fmtTime(t.duration)}</span>
      <button class="mt-play" data-track-play="${t.id}" aria-label="Putar">${iconSvg("play")}</button>
    </div>`;
  }).join("");
}

function updateMusicPlayerUI() {
  const now = $("#musicPlayerNow");
  const empty = $("#musicPlayerEmpty");
  const bar = $("#nowPlayingBar");
  const track = musicState.tracks.find((t) => t.id === musicState.currentId);
  const playBtn = $("#musicPlayPause");
  const npbBtn = $("#npbPlayPause");

  if (!track) {
    if (now) now.style.display = "none";
    if (empty) empty.style.display = "flex";
    if (bar) bar.hidden = true;
    if (playBtn) { playBtn.querySelector(".ico").innerHTML = iconSvg("play"); }
    if (npbBtn) { npbBtn.querySelector(".ico").innerHTML = iconSvg("play"); }
    return;
  }
  if (now) now.style.display = "flex";
  if (empty) empty.style.display = "none";
  if (bar) bar.hidden = false;

  const art = `/api/music/file/${encodeURIComponent(track.path)}`;
  $("#mpArt").innerHTML = `<img src="${art}" alt="">`;
  $("#npbArt").innerHTML = `<img src="${art}" alt="">`;
  $("#mpTitle").textContent = esc(track.title);
  $("#mpArtist").textContent = esc(track.artist || "Artis tidak diketahui");
  $("#npbTitle").textContent = esc(track.title);
  $("#npbArtist").textContent = esc(track.artist || "—");

  if (playBtn) { playBtn.querySelector(".ico").innerHTML = iconSvg(musicState.playing ? "pause" : "play"); }
  if (npbBtn) { npbBtn.querySelector(".ico").innerHTML = iconSvg(musicState.playing ? "pause" : "play"); }

  $$(".music-track-row").forEach((row) => {
    const id = Number(row.dataset.trackId);
    row.classList.toggle("active", id === musicState.currentId);
  });
}

async function playTrack(id) {
  const track = musicState.tracks.find((t) => t.id === id);
  if (!track) return;
  musicState.currentId = id;
  musicState.playing = true;
  const audio = musicState.audio;
  audio.src = `/api/music/file/${encodeURIComponent(track.path)}`;
  audio.volume = musicState.volume / 100;
  try {
    await audio.play();
  } catch (err) {
    toast("Gagal memutar musik", "error");
    musicState.playing = false;
  }
  await api("/api/music/state", { method: "POST", body: { now_playing: String(id), music_paused: "0", music_volume: String(musicState.volume) } });
  renderMusicList();
  updateMusicPlayerUI();
}

function togglePlay() {
  const audio = musicState.audio;
  if (!musicState.currentId) {
    const first = musicState.tracks[0];
    if (first) { playTrack(first.id); return; }
    toast("Library musik kosong", "error");
    return;
  }
  if (musicState.playing) {
    audio.pause();
    musicState.playing = false;
  } else {
    try { audio.play(); } catch (err) { toast("Gagal memutar musik", "error"); return; }
    musicState.playing = true;
  }
  api("/api/music/state", { method: "POST", body: { now_playing: String(musicState.currentId), music_paused: String(musicState.playing ? "0" : "1"), music_volume: String(musicState.volume) } }).catch(() => {});
  updateMusicPlayerUI();
}

function musicPrev() {
  if (!musicState.tracks.length) return;
  const idx = musicState.tracks.findIndex((t) => t.id === musicState.currentId);
  const next = idx <= 0 ? musicState.tracks[musicState.tracks.length - 1] : musicState.tracks[idx - 1];
  playTrack(next.id);
}

function musicNext() {
  if (!musicState.tracks.length) return;
  const idx = musicState.tracks.findIndex((t) => t.id === musicState.currentId);
  const next = idx >= musicState.tracks.length - 1 ? musicState.tracks[0] : musicState.tracks[idx + 1];
  playTrack(next.id);
}

function setVolume(v) {
  musicState.volume = Math.max(0, Math.min(100, v));
  if (musicState.audio) musicState.audio.volume = musicState.volume / 100;
  const fill = $("#mpVolume");
  if (fill) fill.style.width = `${musicState.volume}%`;
  api("/api/music/state", { method: "POST", body: { now_playing: musicState.currentId ? String(musicState.currentId) : "", music_paused: String(musicState.playing ? "0" : "1"), music_volume: String(musicState.volume) } }).catch(() => {});
}

function bindMusicActions() {
  $("#musicRescan").addEventListener("click", loadMusic);
  $("#musicSearch").addEventListener("input", renderMusicList);

  $("#musicTrackList").addEventListener("click", (e) => {
    const row = e.target.closest(".music-track-row");
    if (!row) return;
    const id = Number(row.dataset.trackId);
    if (e.target.closest("[data-track-play]")) {
      playTrack(id);
    } else {
      playTrack(id);
    }
  });

  $("#musicPlayPause").addEventListener("click", togglePlay);
  $("#musicPrev").addEventListener("click", musicPrev);
  $("#musicNext").addEventListener("click", musicNext);

  // progress click seek
  const prog = $("#mpProgress").parentElement;
  prog.addEventListener("click", (e) => {
    const audio = musicState.audio;
    if (!audio.duration || !musicState.currentId) return;
    const rect = prog.getBoundingClientRect();
    const x = e.clientX - rect.left;
    audio.currentTime = (x / rect.width) * audio.duration;
  });

  // volume click
  const vol = $("#mpVolume").parentElement;
  vol.addEventListener("click", (e) => {
    const rect = vol.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    setVolume(Math.round((x / rect.width) * 100));
  });

  // now playing bar controls
  $("#npbPlayPause").addEventListener("click", togglePlay);
  $("#npbPrev").addEventListener("click", musicPrev);
  $("#npbNext").addEventListener("click", musicNext);
  $("#npbProgress").addEventListener("click", (e) => {
    const audio = musicState.audio;
    if (!audio.duration || !musicState.currentId) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    audio.currentTime = (x / rect.width) * audio.duration;
  });

  // keyboard space
  document.addEventListener("keydown", (e) => {
    if (e.key === " " && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      togglePlay();
    }
  });
}
