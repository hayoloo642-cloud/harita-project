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
  source: "local",
  onlineSource: "audius",
  onlineTracks: [],
  onlineBusy: false,
  onlineSeq: 0,
  ytTracks: [],
  ytIndex: -1,
  spTracks: [],
  spIndex: -1,
  onlinePlayback: null,
  bound: false,
};

function currentTrack() {
  if (musicState.source === "online") {
    return musicState.onlineTracks.find((t) => t.id === musicState.currentId) || null;
  }
  return musicState.tracks.find((t) => t.id === musicState.currentId) || null;
}

function initMusic() {
  if (!musicState.bound) {
    musicState.bound = true;
    bindMusicActions();
  }
  const audio = new Audio();
  audio.preload = "metadata";
  musicState.audio = audio;
  audio.addEventListener("loadedmetadata", () => {
    $("#mpDur").textContent = fmtTime(audio.duration);
    updateSeekUI(0);
  });
  audio.addEventListener("timeupdate", () => {
    if (musicState.seekDragging) return;
    const now = Date.now();
    if (now - (musicState._lastUi || 0) < 150) return;
    musicState._lastUi = now;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    updateSeekUI(pct);
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

/* ---------- seek & volume sliders (drag, klik, keyboard, aria) ---------- */

function updateSeekUI(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const mpFill = $("#mpSeekFill");
  const mpKnob = $("#mpSeekKnob");
  const npbFill = $("#npbSeekFill");
  const npbKnob = $("#npbSeekKnob");
  const mpRail = $("#mpSeekRail");
  const npbRail = $("#npbSeekRail");
  if (mpFill) mpFill.style.width = `${p}%`;
  if (mpKnob) mpKnob.style.left = `${p}%`;
  if (npbFill) npbFill.style.width = `${p}%`;
  if (npbKnob) npbKnob.style.left = `${p}%`;
  if (mpRail) mpRail.setAttribute("aria-valuenow", String(Math.round(p)));
  if (npbRail) npbRail.setAttribute("aria-valuenow", String(Math.round(p)));
}

function updateVolumeUI(v) {
  const value = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  const fill = $("#mpVolumeFill");
  const knob = $("#mpVolumeKnob");
  const rail = $("#mpVolumeRail");
  if (fill) fill.style.width = `${value}%`;
  if (knob) knob.style.left = `${value}%`;
  if (rail) rail.setAttribute("aria-valuenow", String(value));
}

function pctFromPointerEvent(rail, event) {
  const rect = rail.getBoundingClientRect();
  const x = event.clientX - rect.left;
  return Math.max(0, Math.min(1, x / Math.max(1, rect.width)));
}

function wireSlider(rail, onInput) {
  if (!rail) return;
  const handle = (event) => onInput(pctFromPointerEvent(rail, event) * 100);
  rail.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    rail.setPointerCapture(event.pointerId);
    handle(event);
    const move = (e) => handle(e);
    const up = () => {
      rail.removeEventListener("pointermove", move);
      rail.removeEventListener("pointerup", up);
      rail.removeEventListener("pointercancel", up);
    };
    rail.addEventListener("pointermove", move);
    rail.addEventListener("pointerup", up);
    rail.addEventListener("pointercancel", up);
  });
  rail.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 5;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onInput(Math.min(100, Number(rail.getAttribute("aria-valuenow") || 0) + step));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onInput(Math.max(0, Number(rail.getAttribute("aria-valuenow") || 0) - step));
    } else if (event.key === "Home") {
      event.preventDefault();
      onInput(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onInput(100);
    }
  });
}

function wireSeekBars() {
  const seekTo = (pct) => {
    const audio = musicState.audio;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    musicState.seekDragging = true;
    audio.currentTime = (Math.max(0, Math.min(100, pct)) / 100) * audio.duration;
    updateSeekUI(pct);
    const t = setTimeout(() => { musicState.seekDragging = false; }, 300);
    t;
  };
  wireSlider($("#mpSeekRail"), seekTo);
  wireSlider($("#npbSeekRail"), seekTo);
  wireSlider($("#mpVolumeRail"), (v) => setVolume(v));
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
    updateVolumeUI(musicState.volume);
    renderMusicList();
    updateMusicPlayerUI();
  } catch (err) {
    toast(err.message, "error");
  }
}

/* ---------------- Jelajah — YouTube (via halaman hasil pencarian) & Spotify (embed resmi) ---------------- */

function stopOnlinePlayback() {
  const frame = document.getElementById("onlinePlayerFrame");
  if (frame) frame.src = "about:blank";
  const wrap = document.getElementById("onlinePlayer");
  if (wrap) wrap.hidden = true;
  musicState.onlinePlayback = null;
  musicState.ytIndex = -1;
  musicState.spIndex = -1;
}

function renderNpbOnline(instance, sourceLabel) {
  const bar = $("#nowPlayingBar");
  if (bar) bar.hidden = false;
  const npbArt = $("#npbArt");
  const art = instance.artwork || "";
  if (npbArt) npbArt.innerHTML = art ? `<img src="${esc(art)}" alt="">` : `<span class="mp-art-empty">♪</span>`;
  const t1 = $("#npbTitle"); const t2 = $("#npbArtist");
  if (t1) t1.textContent = esc(instance.title);
  if (t2) t2.textContent = `${esc(instance.artist)} · ${sourceLabel}`;
  ["#npbPlayPause .ico", "#musicPlayPause .ico"].forEach((sel) => {
    const node = document.querySelector(sel);
    if (node) node.innerHTML = iconSvg("pause");
  });
}

function startLocalPlayback() {
  stopOnlinePlayback();
}

function switchOnlineSource(src) {
  musicState.onlineSource = src;
  document.querySelectorAll("[data-source]").forEach((btn) => {
    const active = btn.dataset.source === src;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  ["audius", "youtube", "spotify"].forEach((name) => {
    const panel = document.getElementById("source" + name[0].toUpperCase() + name.slice(1));
    if (panel) panel.hidden = name !== src;
  });
  if (src === "spotify") refreshSpotifySetup();
}

function renderOnlineList(listId, statusId, countId, tracks, kind) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.innerHTML = tracks.map((t, idx) => {
    const active = (kind === "youtube" && musicState.onlineSource === "youtube" && musicState.ytIndex === idx)
      || (kind === "spotify" && musicState.onlineSource === "spotify" && musicState.spIndex === idx)
      ? "active" : "";
    const meta = kind === "youtube"
      ? `<span class="views-badge" title="${esc(t.views || '')}">${esc(t.views || "").split(" views")[0]}</span>`
      : (t.album ? `<span class="views-badge">${esc(t.album)}</span>` : "");
    const art = t.artwork
      ? `<div class="mt-art" style="background:url('${esc(t.artwork)}') center/cover no-repeat,var(--panel-solid)"></div>`
      : `<div class="mt-art mt-art-note"><span class="ico" data-icon="note"></span></div>`;
    const external = kind === "youtube" && t.watch_url
      ? `<a class="mt-play mt-external" href="${esc(t.watch_url)}" target="_blank" rel="noreferrer" aria-label="Buka di YouTube" title="Buka di YouTube">${iconSvg("external-link")}</a>`
      : "";
    return `<div class="music-track-row ${active}" data-online-kind="${kind}" data-online-index="${idx}">
      <span class="mt-num">${idx + 1}</span>
      ${art}
      <div class="mt-info">
        <div class="mt-title">${esc(t.title)}</div>
        <div class="mt-artist">${esc(t.artist)}${meta}</div>
      </div>
      <span class="mt-dur">${t.duration_text || fmtTime(t.duration)}</span>
      ${external}
      <button class="mt-play" data-online-play="${idx}" data-kind="${kind}" aria-label="Putar di aplikasi">${iconSvg("play")}</button>
    </div>`;
  }).join("");
  if (typeof hydrateIcons === "function") hydrateIcons(list);
  const count = document.getElementById(countId);
  if (count) count.textContent = tracks.length ? `${tracks.length} hasil` : "";
}

async function searchYouTube() {
  const input = document.getElementById("youtubeMusicSearch");
  const status = document.getElementById("youtubeMusicStatus");
  const q = input.value.trim();
  const list = document.getElementById("youtubeMusicTrackList");
  if (!q) { status.textContent = "Ketik kata kunci lalu tekan Enter."; list.innerHTML = ""; document.getElementById("youtubeMusicCount").textContent = ""; return; }
  const seq = ++musicState.onlineSeq;
  status.hidden = false;
  status.textContent = "Mencari di YouTube…";
  try {
    const res = await api("/api/music/youtube/search?q=" + encodeURIComponent(q));
    if (seq !== musicState.onlineSeq) return;
    if (res.error) { status.textContent = res.error; return; }
    musicState.ytTracks = res.tracks || [];
    status.hidden = musicState.ytTracks.length > 0;
    if (!musicState.ytTracks.length) status.textContent = "Tidak ada hasil untuk “" + q + "”.";
    renderOnlineList("youtubeMusicTrackList", "youtubeMusicStatus", "youtubeMusicCount", musicState.ytTracks, "youtube");
  } catch (err) {
    status.hidden = false;
    status.textContent = "Gagal mencari di YouTube — periksa koneksi kamu.";
  }
}

function playYouTubeTrack(index) {
  const track = musicState.ytTracks[index];
  if (!track) return;
  if (musicState.audio && !musicState.audio.paused) musicState.audio.pause();
  musicState.playing = false;
  musicState.ytIndex = index;
  musicState.onlinePlayback = "youtube";
  const frame = document.getElementById("onlinePlayerFrame");
  const wrap = document.getElementById("onlinePlayer");
  const title = document.getElementById("onlinePlayerTitle");
  const link = document.getElementById("onlinePlayerOpen");
  if (frame) frame.src = `${track.embed_url}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`;
  if (wrap) wrap.hidden = false;
  if (title) title.textContent = `${track.title} — ${track.artist}`;
  if (link) link.href = track.watch_url;
  renderNpbOnline(track, "YouTube");
  renderOnlineList("youtubeMusicTrackList", "youtubeMusicStatus", "youtubeMusicCount", musicState.ytTracks, "youtube");
}

function onlinePlayerStep(delta) {
  if (musicState.onlineSource === "youtube") {
    if (!musicState.ytTracks.length) return;
    const next = (musicState.ytIndex + delta + musicState.ytTracks.length) % musicState.ytTracks.length;
    playYouTubeTrack(next);
    return;
  }
  if (musicState.onlineSource === "spotify") {
    if (!musicState.spTracks.length) return;
    const next = (musicState.spIndex + delta + musicState.spTracks.length) % musicState.spTracks.length;
    playSpotifyTrack(next);
  }
}

async function refreshSpotifySetup() {
  try {
    const res = await api("/api/music/spotify/status");
    const configured = !!(res && res.configured);
    document.getElementById("spotifySetupHint").hidden = configured;
    document.getElementById("spotifySearchWrap").hidden = !configured;
    document.getElementById("spotifyLibraryWrap").hidden = !configured;
    if (configured) document.getElementById("spotifyMusicSearch")?.focus();
  } catch (_) { /* biarkan hint tampil */ }
}

async function searchSpotify() {
  const input = document.getElementById("spotifyMusicSearch");
  const list = document.getElementById("spotifyMusicTrackList");
  const count = document.getElementById("spotifyMusicCount");
  const q = input.value.trim();
  if (!q) { list.innerHTML = ""; count.textContent = ""; return; }
  const seq = ++musicState.onlineSeq;
  count.textContent = "Mencari…";
  try {
    const res = await api("/api/music/spotify/search?q=" + encodeURIComponent(q));
    if (seq !== musicState.onlineSeq) return;
    if (res.needs_setup) { document.getElementById("spotifySetupHint").hidden = false; document.getElementById("spotifySearchWrap").hidden = true; document.getElementById("spotifyLibraryWrap").hidden = true; count.textContent = ""; return; }
    if (res.error) { count.textContent = res.error; list.innerHTML = ""; return; }
    musicState.spTracks = res.tracks || [];
    count.textContent = musicState.spTracks.length ? `${musicState.spTracks.length} hasil` : "";
    renderOnlineList("spotifyMusicTrackList", "", "spotifyMusicCount", musicState.spTracks, "spotify");
  } catch (err) {
    count.textContent = "Gagal mencari — periksa koneksi.";
  }
}

function playSpotifyTrack(index) {
  const track = musicState.spTracks[index];
  if (!track) return;
  if (musicState.audio && !musicState.audio.paused) musicState.audio.pause();
  musicState.playing = false;
  musicState.spIndex = index;
  musicState.onlinePlayback = "spotify";
  const frame = document.getElementById("onlinePlayerFrame");
  const wrap = document.getElementById("onlinePlayer");
  const title = document.getElementById("onlinePlayerTitle");
  const link = document.getElementById("onlinePlayerOpen");
  if (frame) frame.src = `${track.embed_url}?utm_source=generator&theme=0`;
  if (wrap) wrap.hidden = false;
  if (title) title.textContent = `${track.title} — ${track.artist}`;
  if (link) link.href = track.open_url;
  renderNpbOnline(track, "Spotify");
  renderOnlineList("spotifyMusicTrackList", "", "spotifyMusicCount", musicState.spTracks, "spotify");
}

/* ---------------- Jelajah (Audius) ---------------- */

function switchMusicTab(tab) {
  const isOnline = tab === "online";
  document.querySelectorAll("[data-music-tab]").forEach((btn) => {
    const active = btn.dataset.musicTab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  const localPanel = $("#musicPanelLocal");
  const onlinePanel = $("#musicPanelOnline");
  if (localPanel) localPanel.hidden = isOnline;
  if (onlinePanel) onlinePanel.hidden = !isOnline;
  const rescan = $("#musicRescan");
  if (rescan) rescan.hidden = isOnline;
  if (isOnline) $("#onlineMusicSearch")?.focus();
}

async function searchOnlineMusic() {
  const input = $("#onlineMusicSearch");
  const status = $("#onlineMusicStatus");
  const list = $("#onlineMusicTrackList");
  const count = $("#onlineMusicCount");
  const q = input.value.trim();
  if (!q) {
    musicState.onlineTracks = [];
    list.innerHTML = "";
    status.hidden = false;
    status.textContent = "Ketik kata kunci lalu tekan Enter — misalnya “nadin amizah”, “tulus”, “lofi”.";
    count.textContent = "";
    return;
  }
  const seq = ++musicState.onlineSeq;
  musicState.onlineBusy = true;
  status.hidden = false;
  status.textContent = "Mencari “" + q + "”…";
  list.innerHTML = "";
  try {
    const res = await api("/api/music/online/search?q=" + encodeURIComponent(q));
    if (seq !== musicState.onlineSeq) return; // ada pencarian lebih baru
    if (res.error) {
      status.textContent = res.error;
      count.textContent = "";
      return;
    }
    musicState.onlineTracks = res.tracks || [];
    count.textContent = musicState.onlineTracks.length ? musicState.onlineTracks.length + " hasil" : "";
    status.hidden = musicState.onlineTracks.length > 0;
    if (!musicState.onlineTracks.length) status.textContent = "Tidak ada hasil untuk “" + q + "”.";
    renderOnlineMusicList();
  } catch (err) {
    if (seq !== musicState.onlineSeq) return;
    status.hidden = false;
    status.textContent = "Gagal mencari — periksa koneksi internet kamu.";
  } finally {
    musicState.onlineBusy = false;
  }
}

function renderOnlineMusicList() {
  const list = $("#onlineMusicTrackList");
  if (!list) return;
  list.innerHTML = musicState.onlineTracks.map((t, idx) => {
    const active = musicState.source === "online" && String(musicState.currentId) === String(t.id) ? "active" : "";
    const art = t.artwork
      ? `<div class="mt-art" style="background:url('${esc(t.artwork)}') center/cover no-repeat,var(--panel-solid)"></div>`
      : `<div class="mt-art mt-art-note"><span class="ico" data-icon="note"></span></div>`;
    const plays = t.plays ? `<span class="mt-plays" title="${Number(t.plays).toLocaleString("id-ID")} kali diputar">${t.plays >= 1000 ? Math.round(t.plays / 1000) + " rb" : t.plays} putar</span>` : "";
    return `<div class="music-track-row ${active}" data-online-track-id="${esc(String(t.id))}">
      <span class="mt-num">${idx + 1}</span>
      ${art}
      <div class="mt-info">
        <div class="mt-title">${esc(t.title)}</div>
        <div class="mt-artist">${esc(t.artist)}${plays}</div>
      </div>
      <span class="mt-dur">${fmtTime(t.duration)}</span>
      <button class="mt-play" data-online-play="${esc(String(t.id))}" aria-label="Putar">${iconSvg("play")}</button>
    </div>`;
  }).join("");
  if (typeof hydrateIcons === "function") hydrateIcons(list);
}

function playOnlineTrack(id) {
  const track = musicState.onlineTracks.find((t) => String(t.id) === String(id));
  if (!track) return;
  startLocalPlayback();
  const audio = musicState.audio;
  musicState.source = "online";
  musicState.currentId = String(track.id);
  musicState.playing = true;
  audio.src = track.stream_url;
  audio.volume = musicState.volume / 100;
  audio.play().catch(() => {
    musicState.playing = false;
    toast("Gagal memutar trek ini", "error");
    updateMusicPlayerUI();
  });
  renderOnlineMusicList();
  renderMusicList();
  updateMusicPlayerUI();
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
    const active = musicState.source === "local" && musicState.currentId === t.id ? "active" : "";
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
  const track = currentTrack();
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

  const art = musicState.source === "online"
    ? esc(track.artwork || "")
    : `/api/music/file/${encodeURIComponent(track.path)}`;
  $("#mpArt").innerHTML = art ? `<img src="${art}" alt="">` : `<span class="mp-art-empty">♪</span>`;
  $("#npbArt").innerHTML = art ? `<img src="${art}" alt="">` : `<span class="mp-art-empty">♪</span>`;
  $("#mpTitle").textContent = esc(track.title);
  $("#mpArtist").textContent = esc(track.artist || "Artis tidak diketahui");
  $("#npbTitle").textContent = esc(track.title);
  $("#npbArtist").textContent = esc(track.artist || "—");

  if (playBtn) { playBtn.querySelector(".ico").innerHTML = iconSvg(musicState.playing ? "pause" : "play"); }
  if (npbBtn) { npbBtn.querySelector(".ico").innerHTML = iconSvg(musicState.playing ? "pause" : "play"); }

  $$(".music-track-row").forEach((row) => {
    const localId = row.dataset.trackId;
    const onlineId = row.dataset.onlineTrackId;
    const active = (onlineId != null && musicState.source === "online" && String(onlineId) === String(musicState.currentId))
      || (localId != null && musicState.source === "local" && Number(localId) === musicState.currentId);
    row.classList.toggle("active", !!active);
  });
}

async function playTrack(id) {
  const track = musicState.tracks.find((t) => t.id === id);
  if (!track) return;
  startLocalPlayback();
  musicState.source = "local";
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
  if (musicState.onlinePlayback) {
    const frame = document.getElementById("onlinePlayerFrame");
    if (musicState.onlinePlayback === "youtube" && frame && frame.src.includes("youtube-nocookie.com")) {
      const isPlaying = document.querySelector("#npbPlayPause .ico")?.innerHTML.includes("pause");
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: isPlaying ? "pauseVideo" : "playVideo", args: [] }),
        "*"
      );
      ["#npbPlayPause .ico", "#musicPlayPause .ico"].forEach((sel) => {
        const node = document.querySelector(sel);
        if (node) node.innerHTML = iconSvg(isPlaying ? "play" : "pause");
      });
    } else {
      toast("Gunakan tombol di pemutar Spotify untuk kontrol lagu", "info", 2500);
    }
    return;
  }
  const audio = musicState.audio;
  if (!musicState.currentId || !currentTrack()) {
    const firstLocal = musicState.tracks[0];
    if (firstLocal) { playTrack(firstLocal.id); return; }
    const firstOnline = musicState.onlineTracks[0];
    if (firstOnline) { playOnlineTrack(firstOnline.id); return; }
    toast("Belum ada musik — pilih Koleksi Saya atau cari di tab Jelajah", "error");
    return;
  }
  if (musicState.playing) {
    audio.pause();
    musicState.playing = false;
  } else {
    try { audio.play(); } catch (err) { toast("Gagal memutar musik", "error"); return; }
    musicState.playing = true;
  }
  if (musicState.source === "local") {
    api("/api/music/state", { method: "POST", body: { now_playing: String(musicState.currentId), music_paused: String(musicState.playing ? "0" : "1"), music_volume: String(musicState.volume) } }).catch(() => {});
  }
  updateMusicPlayerUI();
}

function musicPrev() {
  if (musicState.onlinePlayback) { onlinePlayerStep(-1); return; }
  if (musicState.source === "online") {
    if (!musicState.onlineTracks.length) return;
    const idx = musicState.onlineTracks.findIndex((t) => String(t.id) === String(musicState.currentId));
    const next = idx <= 0 ? musicState.onlineTracks[musicState.onlineTracks.length - 1] : musicState.onlineTracks[idx - 1];
    playOnlineTrack(next.id);
    return;
  }
  if (!musicState.tracks.length) return;
  const idx = musicState.tracks.findIndex((t) => t.id === musicState.currentId);
  const next = idx <= 0 ? musicState.tracks[musicState.tracks.length - 1] : musicState.tracks[idx - 1];
  playTrack(next.id);
}

function musicNext() {
  if (musicState.onlinePlayback) { onlinePlayerStep(1); return; }
  if (musicState.source === "online") {
    if (!musicState.onlineTracks.length) return;
    const idx = musicState.onlineTracks.findIndex((t) => String(t.id) === String(musicState.currentId));
    const next = idx >= musicState.onlineTracks.length - 1 ? musicState.onlineTracks[0] : musicState.onlineTracks[idx + 1];
    playOnlineTrack(next.id);
    return;
  }
  if (!musicState.tracks.length) return;
  const idx = musicState.tracks.findIndex((t) => t.id === musicState.currentId);
  const next = idx >= musicState.tracks.length - 1 ? musicState.tracks[0] : musicState.tracks[idx + 1];
  playTrack(next.id);
}

function setVolume(v) {
  musicState.volume = Math.max(0, Math.min(100, v));
  if (musicState.audio) musicState.audio.volume = musicState.volume / 100;
  updateVolumeUI(musicState.volume);
  if (musicState.source === "local") {
    api("/api/music/state", { method: "POST", body: { now_playing: musicState.currentId ? String(musicState.currentId) : "", music_paused: String(musicState.playing ? "0" : "1"), music_volume: String(musicState.volume) } }).catch(() => {});
  }
}

function bindMusicActions() {
  $("#musicRescan").addEventListener("click", loadMusic);
  $("#musicSearch").addEventListener("input", renderMusicList);

  document.querySelectorAll("[data-source]").forEach((btn) => {
    btn.addEventListener("click", () => switchOnlineSource(btn.dataset.source));
  });
  ["youtube", "spotify"].forEach((kind) => {
    const input = document.getElementById(kind === "youtube" ? "youtubeMusicSearch" : "spotifyMusicSearch");
    const toggle = kind;
    let ytDebounce;
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(ytDebounce);
        kind === "youtube" ? searchYouTube() : searchSpotify();
      }
    });
    input?.addEventListener("input", () => {
      clearTimeout(ytDebounce);
      ytDebounce = setTimeout(() => { kind === "youtube" ? searchYouTube() : searchSpotify(); }, 450);
    });
  });
  document.getElementById("onlinePlayerPrev")?.addEventListener("click", () => onlinePlayerStep(-1));
  document.getElementById("onlinePlayerNext")?.addEventListener("click", () => onlinePlayerStep(1));
  $("#youtubeMusicTrackList")?.addEventListener("click", (e) => {
    const row = e.target.closest('[data-online-kind="youtube"]');
    if (row) playYouTubeTrack(Number(row.dataset.onlineIndex));
  });
  $("#spotifyMusicTrackList")?.addEventListener("click", (e) => {
    const row = e.target.closest('[data-online-kind="spotify"]');
    if (row) playSpotifyTrack(Number(row.dataset.onlineIndex));
  });

  document.querySelectorAll("[data-music-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchMusicTab(btn.dataset.musicTab));
  });
  $("#onlineMusicSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); searchOnlineMusic(); }
  });
  $("#onlineMusicSearch")?.addEventListener("search", searchOnlineMusic);
  let onlineDebounce;
  $("#onlineMusicSearch")?.addEventListener("input", () => {
    clearTimeout(onlineDebounce);
    onlineDebounce = setTimeout(searchOnlineMusic, 450);
  });
  $("#onlineMusicTrackList")?.addEventListener("click", (e) => {
    const row = e.target.closest("[data-online-track-id]");
    if (!row) return;
    playOnlineTrack(row.dataset.onlineTrackId);
  });

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

  wireSeekBars();
  updateVolumeUI(musicState.volume);
  updateSeekUI(0);

  // now playing bar controls
  $("#npbPlayPause").addEventListener("click", togglePlay);
  $("#npbPrev").addEventListener("click", musicPrev);
  $("#npbNext").addEventListener("click", musicNext);

  // keyboard space
  document.addEventListener("keydown", (e) => {
    if (e.key === " " && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      togglePlay();
    }
  });
}
