/* ============================================================
   Ambient canvas — latar bergerak hidup, ringan & multi-kanvas
   Dipandu Web Audio ambient + timer
   ============================================================ */
'use strict';

window.fmAmbient = (() => {
  const instances = [];
  let ambient = 'off';
  let globalRaf = null;
  let t = 0;

  const rand = (min, max) => Math.random() * (max - min) + min;

  const spawnStreak = (W, H, randomizeY = false) => ({
    x: Math.random() * W,
    y: randomizeY ? Math.random() * H : -40 - Math.random() * H * 0.3,
    len: rand(18, 44),
    speed: rand(9, 16),
    width: rand(0.8, 2.0),
    opacity: rand(0.25, 0.7),
    wind: rand(-1.2, 1.2),
  });

  const spawnEmber = (W, H) => ({
    x: rand(0.15 * W, 0.85 * W),
    y: H + rand(0, 40),
    vx: rand(-0.25, 0.25),
    vy: rand(-1.1, -0.5),
    size: rand(1.3, 3.2),
    life: rand(2.5, 4.2),
    age: 0,
    hue: rand(18, 38),
  });

  function createEntry(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return {
      canvas,
      ctx: canvas.getContext('2d'),
      W: 0, H: 0,
      streaks: [], droplets: [], wavesTextiles: [],
      windLines: [], fireflyNotes: [],
      embers: [], fireflies: [], leaves: [],
      bokeh: [], wisps: [], rings: [],
      stars: [], sparkles: [], ripples: [],
      bubbles: [], chimes: [], lightning: [{ active: false, timer: 0, nextAt: 120 }],
      auroraArcs: [], vineLeaves: [], shelfSpecks: [], tracks: [], glowArcs: [],
      t: 0,
    };
  }

  function resize(entry) {
    const parent = entry.canvas.parentElement;
    entry.W = Math.max(200, parent.clientWidth || 640);
    entry.H = Math.max(200, parent.clientHeight || 400);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // cap dpr 1.5 for perf
    entry.canvas.width = Math.floor(entry.W * dpr);
    entry.canvas.height = Math.floor(entry.H * dpr);
    entry.canvas.style.width = `${entry.W}px`;
    entry.canvas.style.height = `${entry.H}px`;
    entry.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed(entry);
  }

  function seed(entry) {
    const W = entry.W, H = entry.H;
    entry.streaks = Array.from({ length: 70 }, () => spawnStreak(W, H, true));
    entry.droplets = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, len: rand(12, 26), speed: rand(5, 8.4), opacity: rand(0.24, 0.5), wind: rand(-0.7, 0.7) }));
    entry.wavesTextiles = Array.from({ length: 14 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: rand(2, 4.6), phase: rand(0, Math.PI * 2), speed: rand(0.008, 0.018) }));
    entry.windLines = Array.from({ length: 20 }, () => ({ x: Math.random() * W, y: Math.random() * H, len: rand(60, 170), speed: rand(1.5, 2.9), opacity: rand(0.07, 0.2) }));
    entry.fireflyNotes = Array.from({ length: 18 }, () => ({ x: Math.random() * W, y: Math.random() * H, size: rand(0.7, 1.8), phase: rand(0, Math.PI * 2), vx: rand(-0.045, 0.045) }));
    entry.embers = [];
    entry.fireflies = Array.from({ length: 12 }, () => ({ x: rand(0, W), y: rand(0.55 * H, H), speed: rand(0.3, 0.75), size: rand(1.8, 4), phase: rand(0, Math.PI * 2) }));
    entry.leaves = Array.from({ length: 10 }, () => ({ x: rand(0, W), y: rand(-80, H), size: rand(2.6, 5.5), rot: rand(0, Math.PI * 2), dx: rand(-0.35, 0.35), dy: rand(0.16, 0.36), spin: rand(-0.018, 0.018), phase: rand(0, Math.PI * 2) }));
    entry.bokeh = Array.from({ length: 7 }, () => ({ x: rand(0, W), y: rand(0.15 * H, H), r: rand(60, 175), alpha: rand(0.05, 0.17), warm: Math.random() > 0.32, phase: rand(0, Math.PI * 2) }));
    entry.wisps = Array.from({ length: 4 }, () => ({ x: W * (0.15 + Math.random() * 0.7), basePhase: rand(0, Math.PI * 2), speed: rand(0.004, 0.009) }));
    entry.rings = [
      { r: 50, a: 0.22, speed: 0.18 },
      { r: 150, a: 0.12, speed: 0.13 },
      { r: 250, a: 0.07, speed: 0.09 },
    ];
    entry.stars = Array.from({ length: 55 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.7, size: rand(0.35, 1.3), phase: rand(0, Math.PI * 2) }));
    entry.sparkles = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.75, phase: rand(0, Math.PI * 2), size: rand(0.5, 1.4) }));
    entry.ripples = [];
    entry.bubbles = Array.from({ length: 16 }, () => ({ x: Math.random() * W, y: rand(H * 0.45, H), r: rand(2, 5.5), speed: rand(0.3, 0.85), wobble: rand(0.01, 0.03), phase: rand(0, Math.PI * 2) }));
    entry.chimes = Array.from({ length: 5 }, () => ({ x: rand(0, W), y: rand(0.1 * H, 0.7 * H), r: rand(3, 5.5), phase: rand(0, Math.PI * 2), drift: rand(0.007, 0.015) }));
    entry.lightning = [{ active: false, timer: 0, nextAt: 120 }];
    entry.auroraArcs = Array.from({ length: 3 }, () => ({ y: rand(0.15 * H, 0.45 * H), amp: rand(50, 120), hue: rand(120, 160), width: rand(8, 24), phase: rand(0, Math.PI * 2), speed: rand(0.004, 0.009) }));
    entry.vineLeaves = Array.from({ length: 28 }, () => ({ x: Math.random() * W, y: Math.random() * H, size: rand(2, 4.5), phase: rand(0, Math.PI * 2), vx: rand(-0.018, 0.018) }));
    entry.shelfSpecks = Array.from({ length: 30 }, () => ({ x: rand(0, W), y: rand(0.1 * H, 0.75 * H), size: rand(0.4, 1.1), phase: rand(0, Math.PI * 2) }));
    entry.tracks = [
      { y: H * 0.68, speed: 2.6, offset: 0 },
      { y: H * 0.78, speed: 3.4, offset: 18 },
    ];
    entry.glowArcs = Array.from({ length: 4 }, () => ({ r: rand(60, 180), a: rand(0.05, 0.18), hue: rand(260, 300), phase: rand(0, Math.PI * 2), speed: rand(0.004, 0.009) }));
  }

  const SILHOUETTE_ACCENT = {
    thunder: '#a78bfa', rain: '#93c5fd', fire: '#fca5a5', ocean: '#5eead4', forest: '#86efac', cafe: '#fdba74',
    brown: '#d6a5f5', breath: '#c7b3ff', river: '#7dd3fc', cave: '#6ee7ff', wind: '#cbd5e1', windchime: '#fbcfe8',
    white: '#e0e7ff', night: '#a5b4fc', deep_space: '#c084fc', waterfall: '#a5f3fc', train: '#fdba74',
    library: '#fde68a', lofi: '#fbbf24', city_rain: '#fcd34d', jungle: '#86efac', tide: '#6ee7b7', aurora: '#c084fc', bubble: '#99f6e4',
  };

  function drawSilhouette(entry, type) {
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'source-over';
    const accent = SILHOUETTE_ACCENT[type] || '#93c5fd';
    // glow tipis di horizon supaya siluet terbaca
    const glow = ctx.createLinearGradient(0, H * 0.35, 0, H * 0.75);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(0.5, accent);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = glow;
    ctx.fillRect(0, H * 0.4, W, H * 0.35);
    ctx.globalAlpha = 1;
    // fill black tapi dengan aksen tipis
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;

    switch (type) {
      case 'rain': {
        // hujan biasa — perbukitan & pohon cemara samar
        ctx.beginPath();
        ctx.moveTo(0, H * 0.8);
        for (let x = 0; x <= W; x += 24) {
          const y = H * 0.8 - Math.sin(x * 0.009 + 1.2) * H * 0.09 - Math.cos(x * 0.004 + 0.5) * H * 0.05;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        for (let x = 60; x < W; x += 150) {
          const th = H * (0.17 + 0.07 * Math.sin(x * 0.045 + 1));
          ctx.beginPath();
          ctx.moveTo(x, H * 0.8 - th);
          ctx.lineTo(x - 15, H * 0.8);
          ctx.lineTo(x + 15, H * 0.8);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'fire': {
        // api unggun — tumpukan kayu gelap
        ctx.beginPath();
        ctx.moveTo(W * 0.32, H);
        ctx.lineTo(W * 0.5, H * 0.82);
        ctx.lineTo(W * 0.68, H);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'ocean':
      case 'tide':
      case 'beach': {
        // pantai/laut — garis bukit rendah / garis pantai
        ctx.beginPath();
        ctx.moveTo(0, H * 0.72);
        for (let x = 0; x <= W; x += 30) {
          const y = H * 0.72 - Math.sin(x * 0.008 + 1.5) * H * 0.06 - Math.cos(x * 0.003) * H * 0.04;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();
        // garis pantai
        ctx.fillRect(0, H * 0.78, W, H * 0.22);
        break;
      }
      case 'forest':
      case 'jungle': {
        // hutan — pohon-pohon samar bertingkat
        const treeH = H * 0.38;
        for (let x = 0; x < W; x += 42) {
          const h = treeH * (0.7 + Math.sin(x * 0.02) * 0.3);
          ctx.fillRect(x, H - h, 14, h);
        }
        // barisan bawah
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, H * 0.55);
        for (let x = 0; x <= W; x += 80) { ctx.lineTo(x, H * 0.55 + Math.sin(x * 0.03 + t * 0.003) * 16); }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'cafe': {
        // kedai kopi — konter, lampu gantung
        ctx.fillRect(0, H * 0.6, W, H * 0.4); // counter base
        for (const lx of [W * 0.25, W * 0.5, W * 0.75]) {
          ctx.fillRect(lx - 2, H * 0.12, 4, H * 0.24); // cords
          ctx.beginPath();
          ctx.arc(lx, H * 0.34, 14, 0, Math.PI); // lamp shades
          ctx.fill();
        }
        // sinar lampu samar
        ctx.fillStyle = 'rgba(255,230,150,0.08)';
        for (const lx of [W * 0.25, W * 0.5, W * 0.75]) {
          ctx.fillRect(lx - 40, H * 0.34, 80, H * 0.28);
        }
        break;
      }
      case 'brown':
      case 'breath': {
        // struktur melengkung (ala katedral/arch)
        for (const offset of [0.18, 0.32, 0.5, 0.68, 0.82]) {
          const cx = W * offset;
          ctx.beginPath();
          ctx.arc(cx, H * 0.7, 55 + offset * 18, Math.PI, 0);
          ctx.fill();
        }
        break;
      }
      case 'river':
      case 'cave': {
        // batu-batu di sisi (kiri/kanan, aliran di tengah)
        ctx.fillRect(0, H * 0.4, W * 0.13, H * 0.6);
        ctx.fillRect(W * 0.87, H * 0.45, W * 0.13, H * 0.55);
        ctx.beginPath();
        ctx.moveTo(0, H * 0.42); ctx.lineTo(W * 0.13, H * 0.3); ctx.lineTo(W * 0.13, H * 0.42);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(W * 0.87, H * 0.5); ctx.lineTo(W, H * 0.35); ctx.lineTo(W, H * 0.5);
        ctx.fill();
        break;
      }
      case 'wind':
      case 'windchime': {
        // pepohonan tinggi di horizon + burung samar 
        ctx.beginPath();
        ctx.moveTo(0, H * 0.75);
        for (let x = 0; x <= W; x += 60) { ctx.lineTo(x, H * 0.75 - Math.sin(x * 0.01 + 2) * H * 0.1); }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();
        // burung samar
        ctx.strokeStyle = '#0f0b08'; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const bx = W * (0.2 + i * 0.17), by = H * (0.18 + (i * 0.04 % 0.12));
          ctx.beginPath(); ctx.moveTo(bx - 6, by); ctx.quadraticCurveTo(bx, by - 5, bx + 6, by); ctx.stroke();
        }
        break;
      }
      case 'white': {
        // garis cakrawala minimal + matahari rendah
        ctx.fillRect(0, H * 0.65, W, H * 0.35);
        break;
      }
      case 'night':
      case 'deep_space': {
        // kanopi pohon + bulan samar
        ctx.beginPath();
        ctx.moveTo(0, H * 0.72);
        for (let x = 0; x <= W; x += 50) { ctx.lineTo(x, H * 0.72 - Math.sin(x * 0.014 + t * 0.002) * H * 0.05); }
        ctx.lineTo(W, H); ctx.lineTo(0, H);
        ctx.closePath(); ctx.fill();
        // bulan
        ctx.fillStyle = 'rgba(240,240,230,0.12)';
        ctx.beginPath(); ctx.arc(W * 0.78, H * 0.22, 36, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'thunder': {
        // skyline kota petir
        const tops = [0.35, 0.25, 0.4, 0.3, 0.45, 0.2, 0.38, 0.28];
        const step = W / tops.length;
        for (let i = 0; i < tops.length; i++) {
          const h = H * tops[i];
          ctx.fillRect(i * step, H - h, step - 1, h);
        }
        // beberapa jendela menyala samar
        ctx.fillStyle = 'rgba(255, 240, 160, 0.22)';
        for (let x = 12; x < W; x += 34) { for (const yr of [0.25, 0.35, 0.42]) { if (Math.sin(x * yr + t * 0.015) > 0.6) ctx.fillRect(x, H * yr, 3, 2); } }
        break;
      }
      case 'waterfall': {
        // tebing kiri kanan dengan celah air di tengah
        ctx.fillRect(0, H * 0.35, W * 0.28, H * 0.65);
        ctx.fillRect(W * 0.72, H * 0.38, W * 0.28, H * 0.62);
        ctx.beginPath();
        ctx.moveTo(0, H * 0.35); ctx.lineTo(W * 0.12, H * 0.2); ctx.lineTo(W * 0.22, H * 0.35);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(W * 0.78, H * 0.38); ctx.lineTo(W * 0.9, H * 0.22); ctx.lineTo(W * 0.98, H * 0.38);
        ctx.fill();
        break;
      }
      case 'train': {
        // garis rel berganda
        ctx.fillRect(0, H * 0.86, W, H * 0.14);
        ctx.fillStyle = 'rgba(255,220,160,0.18)';
        ctx.fillRect(0, H * 0.84, W, H * 0.02);
        break;
      }
      case 'library': {
        // rak buku silhouettes + kursi membaca
        for (let x = 0; x < W; x += 52) { ctx.fillRect(x, H * 0.35, 20, H * 0.6); }
        // kursi membaca samar
        ctx.beginPath();
        ctx.moveTo(W * 0.42, H);
        ctx.lineTo(W * 0.48, H * 0.7);
        ctx.lineTo(W * 0.52, H * 0.7);
        ctx.lineTo(W * 0.58, H);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'lofi': {
        // kamar — jendel dan vinyl player
        ctx.fillRect(0, H * 0.55, W, H * 0.45); // lantai
        ctx.fillRect(W * 0.1, H * 0.08, W * 0.22, H * 0.3); // jendela besar
        ctx.fillRect(W * 0.6, H * 0.78, W * 0.08, H * 0.16); // radio/vinyl
        break;
      }
      case 'city_rain': {
        // kota detail — bangunan tinggi + lampu neon di horizon
        const heights = [0.38, 0.52, 0.28, 0.45, 0.32, 0.55, 0.42, 0.3, 0.48];
        const step = W / heights.length;
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        for (let i = 0; i < heights.length; i++) {
          const h = H * heights[i];
          ctx.fillRect(i * step, H - h, step - 1, h);
        }
        // lampu neon horizon
        ctx.fillStyle = 'rgba(255,170,60,0.45)';
        ctx.fillRect(0, H * 0.45, W, H * 0.03);
        // beberapa jendela nyala
        ctx.fillStyle = 'rgba(255, 220, 180, 0.55)';
        for (let x = 8; x < W; x += 18) { for (let y = H * 0.2; y < H * 0.75; y += 14) { if (Math.sin(x * 0.07 + y * 0.13) > 0.3) ctx.fillRect(x, y, 2.5, 3); } }
        break;
      }
      case 'aurora': {
        // garis pohon di bawah
        ctx.beginPath();
        ctx.moveTo(0, H * 0.88);
        for (let x = 0; x <= W; x += 28) { ctx.lineTo(x, H * 0.88 - Math.abs(Math.sin(x * 0.04 + 2) * H * 0.12)); }
        ctx.lineTo(W, H); ctx.lineTo(0, H);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'bubble': {
        // terumbu karang silhouettes di bawah
        for (const x of [W * 0.18, W * 0.38, W * 0.62, W * 0.82]) {
          ctx.beginPath(); ctx.arc(x, H, 55 + Math.sin(x) * 20, Math.PI, 0); ctx.fill();
        }
        break;
      }
    }
  }

  function clear(entry) {
    entry.ctx.clearRect(0, 0, entry.W, entry.H);
  }

  function drawSparkles(entry) {
    const { ctx, sparkles, t } = entry;
    for (const s of sparkles) {
      const a = 0.3 + Math.sin(t * 0.04 + s.phase) * 0.3;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function rainStreaks(entry) {
    const { ctx, streaks, t, H, W } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const d of streaks) {
      d.y += d.speed;
      d.x += d.wind * 0.3;
      ctx.strokeStyle = `rgba(176,224,255,${d.opacity})`;
      ctx.lineWidth = d.width;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.wind, d.y + d.len);
      ctx.stroke();
      if (d.y > H + d.len) Object.assign(d, spawnStreak(W, H));
    }
    if (Math.random() < 0.02) {
      entry.ripples.push({ x: Math.random() * W, y: H * (0.87 + Math.random() * 0.1), r: 0, a: 0.32 });
    }
    for (let i = entry.ripples.length - 1; i >= 0; i--) {
      const r = entry.ripples[i];
      r.r += 1.5; r.a -= 0.011;
      if (r.a <= 0) { entry.ripples.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, r.a);
      ctx.strokeStyle = '#cdeeff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r * 2.1, r.r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawRain(entry) {
    clear(entry);
    drawSilhouette(entry, 'rain');
    rainStreaks(entry);
  }

  function drawFire(entry) {
    clear(entry);
    drawSilhouette(entry, 'fire');
    const { ctx, embers, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    const base = ctx.createRadialGradient(W * 0.5, H * 1.02, 16, W * 0.5, H * 1.02, W * 0.8);
    base.addColorStop(0, 'rgba(255,170,80,0.5)');
    base.addColorStop(0.4, 'rgba(255,110,35,0.15)');
    base.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    const toAdd = 2;
    for (let i = 0; i < toAdd; i++) {
      if (embers.length < 90) embers.push(spawnEmber(W, H));
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.age += 1 / 60;
      e.x += e.vx + Math.sin(t * 0.035 + e.y * 0.012) * 0.32;
      e.y += e.vy;
      e.vy += 0.0018;
      const life = 1 - e.age / e.life;
      if (life <= 0 || e.y < -20) { embers.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, Math.min(0.9, life));
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 3.2);
      const lightness = 58 + Math.sin(t * 0.1 + i) * 10;
      g.addColorStop(0, `hsl(${e.hue}, 95%, ${lightness + 14}%)`);
      g.addColorStop(0.5, `hsla(${e.hue}, 90%, ${lightness}%, 0.5)`);
      g.addColorStop(1, `hsla(${e.hue}, 85%, ${lightness}%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawOcean(entry) {
    clear(entry);
    drawSilhouette(entry, 'ocean');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    const wave = (yBase, amp, speed, alpha, hue) => {
      ctx.strokeStyle = `hsla(${hue}, 70%, 72%, ${alpha})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const y = yBase + Math.sin(x * 0.011 + t * speed * 0.038) * amp + Math.sin(x * 0.021 + t * speed * 0.075) * amp * 0.4;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    wave(H * 0.78, 14, 1.1, 0.14, 190);
    wave(H * 0.62, 11, 1.5, 0.1, 175);
    wave(H * 0.46, 8, 2.0, 0.08, 170);
    if (Math.random() < 0.28) {
      for (let i = 0; i < 1; i++) {
        entry.sparkles.push({ x: Math.random() * W, y: H * (0.75 + Math.random() * 0.22), phase: rand(0, Math.PI * 2), size: rand(1, 2) });
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawForest(entry) {
    clear(entry);
    drawSilhouette(entry, 'forest');
    const { ctx, fireflies, leaves, t, W, H } = entry;
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.32, 10, W * 0.5, H * 0.32, W * 0.9);
    glow.addColorStop(0, 'rgba(130,255,170,0.13)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    for (const f of fireflies) {
      f.x += Math.sin(t * 0.01 + f.phase) * 0.32 * f.speed;
      f.y += Math.cos(t * 0.008 + f.phase * 1.7) * 0.24 * f.speed;
      const pulse = 0.42 + Math.sin(t * 0.06 + f.phase) * 0.38;
      ctx.globalAlpha = pulse;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 5);
      g.addColorStop(0, 'rgba(210,255,170,0.9)');
      g.addColorStop(0.35, 'rgba(140,255,150,0.36)');
      g.addColorStop(1, 'rgba(120,255,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const l of leaves) {
      l.x += l.dx + Math.sin(t * 0.01 + l.phase) * 0.28;
      l.y += l.dy;
      l.rot += l.spin;
      if (l.y > H + 10) { l.y = -20; l.x = Math.random() * W; }
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = 'rgba(165, 225, 165, 0.62)';
      ctx.beginPath();
      ctx.ellipse(l.x, l.y, l.size, l.size * 0.52, l.rot, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawCafe(entry) {
    clear(entry);
    drawSilhouette(entry, 'cafe');
    const { ctx, bokeh, wisps, t, H, W } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bokeh) {
      const pulse = 1 + Math.sin(t * 0.012 + b.phase) * 0.12;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * pulse);
      if (b.warm) {
        g.addColorStop(0, 'rgba(255,205,135,0.24)');
        g.addColorStop(1, 'rgba(255,160,60,0)');
      } else {
        g.addColorStop(0, 'rgba(255,230,180,0.19)');
        g.addColorStop(1, 'rgba(255,190,110,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const w of wisps) {
      const phase = t * w.speed + w.basePhase;
      ctx.strokeStyle = 'rgba(255,235,200,0.11)';
      ctx.lineWidth = 24 + Math.sin(phase * 2) * 6;
      ctx.beginPath();
      ctx.moveTo(w.x, H);
      ctx.bezierCurveTo(w.x + Math.sin(phase) * 18, H * 0.72, w.x + Math.cos(phase * 1.3) * 24, H * 0.45, w.x + Math.sin(phase * 0.7) * 14, H * 0.18);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawBrown(entry) {
    clear(entry);
    drawSilhouette(entry, 'brown');
    const { ctx, rings, t, W, H } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      ctx.globalAlpha = r.a;
      ctx.strokeStyle = '#f5d0d0';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.45, r.r + t * r.speed * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      r.r += r.speed * 0.35;
      if (r.r > Math.max(W, H) * 0.9) r.r = 28 + Math.random() * 36;
    }
    const g = ctx.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, W);
    g.addColorStop(0, 'rgba(180, 70, 60, 0.1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawRiver(entry) {
    clear(entry);
    drawSilhouette(entry, 'river');
    const { ctx, droplets, W, H } = entry;
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createLinearGradient(0, H * 0.55, 0, H);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(0.5, 'rgba(120, 210, 255, 0.07)');
    glow.addColorStop(1, 'rgba(40, 180, 220, 0.16)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    for (const d of droplets) {
      d.x += d.wind * 0.3;
      d.y += d.speed;
      if (d.y > H + d.len) { d.y = -20 - Math.random() * 80; d.x = Math.random() * W; }
      ctx.globalAlpha = d.opacity * (0.6 + Math.sin(entry.t * 0.08 + d.y) * 0.4);
      ctx.strokeStyle = '#bfe9ff';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.wind, d.y + d.len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawBeach(entry) {
    clear(entry);
    drawSilhouette(entry, 'beach');
    const { ctx, wavesTextiles, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    const horizon = ctx.createLinearGradient(0, H * 0.6, 0, H * 0.6 + 38);
    horizon.addColorStop(0, 'rgba(255,210,140,0.24)');
    horizon.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, H * 0.6, W, 38);
    for (const p of wavesTextiles) {
      p.phase += p.speed;
      p.y += Math.sin(p.phase) * 0.13;
      ctx.globalAlpha = 0.12 + Math.sin(p.phase) * 0.07;
      ctx.fillStyle = '#ffe9ce';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawWind(entry) {
    clear(entry);
    drawSilhouette(entry, 'wind');
    const { ctx, windLines, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const w of windLines) {
      w.x += w.speed;
      if (w.x - w.len > W) { w.x = -w.len; w.y = Math.random() * H; }
      ctx.globalAlpha = w.opacity * (0.5 + Math.sin(t * 0.05 + w.y) * 0.45);
      ctx.strokeStyle = '#cfe8ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.x - w.len, w.y + Math.sin(w.y * 0.01 + t * 0.03) * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    entry.t += 1;
  }

  function drawWhite(entry) {
    clear(entry);
    drawSilhouette(entry, 'white');
    const { ctx, stars, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      const a = 0.13 + Math.sin(t * 0.02 + s.phase) * 0.11;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#f0f0ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 0.66, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    entry.t += 1;
  }

  function drawNight(entry) {
    clear(entry);
    drawSilhouette(entry, 'night');
    const { ctx, stars, fireflyNotes, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      const a = 0.26 + Math.sin(t * 0.025 + s.phase) * 0.4;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff8e0';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const f of fireflyNotes) {
      f.x += f.vx;
      f.phase += 0.017;
      if (f.x < -5) f.x = W + 5; else if (f.x > W + 5) f.x = -5;
      const pulse = 0.35 + Math.sin(f.phase) * 0.28;
      if (pulse <= 0) continue;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#b8ff98';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    entry.t += 1;
  }

  function drawBreath(entry) {
    clear(entry);
    drawSilhouette(entry, 'breath');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    const breathRadius = 75 + Math.sin(t * 0.006) * 48;
    const ringsList = [
      { r: breathRadius, a: 0.2 },
      { r: breathRadius * 1.45, a: 0.12 },
      { r: breathRadius * 2.05, a: 0.06 },
    ];
    for (const { r, a } of ringsList) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#b8ccff';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.45, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawThunder(entry) {
    clear(entry);
    drawSilhouette(entry, 'thunder');
    const { ctx, W, H, t } = entry;
    rainStreaks(entry);
    const L = entry.lightning[0];
    if (!L.active && t > L.nextAt) { L.active = true; L.timer = 1.3; L.nextAt = t + 200 + Math.random() * 160; }
    if (L.active) {
      L.timer -= 0.016;
      const a = Math.max(0, L.timer) * 0.55;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255, 240, 200, ${a})`;
      ctx.fillRect(0, 0, W, H);
      if (L.timer <= 0) L.active = false;
    }
    ctx.globalCompositeOperation = 'source-over';
    entry.t += 0; // drawRain already incremented t
  }

  function drawWaterfall(entry) {
    clear(entry);
    drawSilhouette(entry, 'waterfall');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    const base = ctx.createLinearGradient(0, H * 0.42, 0, H);
    base.addColorStop(0, 'rgba(200,240,255,0.02)');
    base.addColorStop(0.5, 'rgba(180,235,255,0.07)');
    base.addColorStop(1, 'rgba(140,210,240,0.16)');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    for (const d of entry.streaks) {
      d.y += d.speed * 1.35;
      d.x += d.wind * 0.3;
      ctx.strokeStyle = `rgba(215,245,255,${d.opacity * 0.7})`;
      ctx.lineWidth = d.width;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.wind, d.y + d.len * 1.35);
      ctx.stroke();
      if (d.y > H + d.len) Object.assign(d, spawnStreak(W, H));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawTrain(entry) {
    clear(entry);
    drawSilhouette(entry, 'train');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const track of entry.tracks) {
      track.offset += track.speed;
      if (track.offset > 40) track.offset -= 40;
      ctx.globalAlpha = 0.17;
      ctx.strokeStyle = '#ffd0b0';
      ctx.lineWidth = 1.8;
      for (let i = -1; i < 18; i++) {
        const x = i * 40 + track.offset;
        ctx.beginPath();
        ctx.moveTo(x, track.y - 6);
        ctx.lineTo(x, track.y + 6);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.35);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(30, 20, 10, 0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.35);
    ctx.globalCompositeOperation = 'source-over';
    entry.t += 1;
  }

  function drawLibrary(entry) {
    clear(entry);
    drawSilhouette(entry, 'library');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of entry.shelfSpecks) {
      p.phase += 0.012;
      p.y += Math.sin(p.phase * 0.5) * 0.08;
      p.x += Math.cos(p.phase * 0.45) * 0.06;
      const a = 0.16 + Math.sin(p.phase + t * 0.018) * 0.12;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#f7e8c8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawCave(entry) {
    clear(entry);
    drawSilhouette(entry, 'cave');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    const crack = ctx.createRadialGradient(W * 0.5, H * 1.02, 18, W * 0.5, H * 1.02, W * 0.8);
    crack.addColorStop(0, 'rgba(120, 205, 255, 0.13)');
    crack.addColorStop(0.5, 'rgba(40, 120, 180, 0.05)');
    crack.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = crack;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < entry.streaks.length * 0.3; i++) {
      const s = entry.streaks[i];
      s.y += s.speed * 0.6;
      if (s.y > H + 30) { s.y = -20; s.x = Math.random() * W; }
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#b0e0ff';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y + s.len * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawWindchime(entry) {
    clear(entry);
    drawSilhouette(entry, 'windchime');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const c of entry.chimes) {
      c.y += Math.sin(t * c.drift + c.phase) * 0.18;
      c.x += Math.cos(t * c.drift * 0.8 + c.phase * 1.3) * 0.12;
      const a = 0.16 + Math.sin(t * 0.05 + c.phase) * 0.11;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffe4b0';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.32;
      ctx.fillStyle = '#fff3d0';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawLofi(entry) {
    clear(entry);
    drawSilhouette(entry, 'lofi');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = '#ffe9c8';
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.48, 32 + i * 21 + Math.sin(t * 0.014 + i) * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawDeepSpace(entry) {
    clear(entry);
    drawSilhouette(entry, 'deep_space');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const arc of entry.glowArcs) {
      arc.phase += arc.speed;
      const pulse = 0.5 + Math.sin(t * 0.01 + arc.phase) * 0.38;
      if (pulse <= 0) continue;
      ctx.globalAlpha = arc.a * pulse;
      ctx.strokeStyle = `hsla(${arc.hue}, 70%, 68%, 1)`;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.4 + Math.sin(arc.phase) * 28);
      ctx.bezierCurveTo(W * 0.25, H * 0.28 + Math.cos(arc.phase) * 55, W * 0.7, H * 0.5 + Math.sin(arc.phase * 2) * 48, W, H * 0.35 + Math.cos(arc.phase) * 35);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawCityRain(entry) {
    clear(entry);
    drawSilhouette(entry, 'city_rain');
    const { ctx, W, H, t } = entry;
    rainStreaks(entry);
    ctx.globalCompositeOperation = 'lighter';
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.42);
    sky.addColorStop(0, 'rgba(255, 180, 80, 0.07)');
    sky.addColorStop(1, 'rgba(255, 130, 50, 0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.42);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawJungle(entry) {
    clear(entry);
    drawSilhouette(entry, 'jungle');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const v of entry.vineLeaves) {
      v.x += v.vx + Math.sin(t * 0.008 + v.phase) * 0.06;
      v.y += 0.03;
      if (v.y > H + 4) { v.y = -5; v.x = Math.random() * W; }
      ctx.globalAlpha = 0.3 + Math.sin(v.phase + t * 0.025) * 0.18;
      ctx.fillStyle = '#8bf0a0';
      ctx.beginPath();
      ctx.ellipse(v.x, v.y, v.size, v.size * 0.55, v.phase, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawTide(entry) {
    clear(entry);
    drawSilhouette(entry, 'tide');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    const wave = (yBase, amp, speed, alpha, hue) => {
      ctx.strokeStyle = `hsla(${hue}, 65%, 68%, ${alpha})`;
      ctx.lineWidth = 18;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const y = yBase + Math.sin(x * 0.01 + t * speed * 0.026) * amp;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    wave(H * 0.72, 28, 0.8, 0.17, 185);
    wave(H * 0.5, 22, 1.1, 0.11, 170);
    wave(H * 0.32, 16, 1.4, 0.08, 160);
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawAurora(entry) {
    clear(entry);
    drawSilhouette(entry, 'aurora');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const a of entry.auroraArcs) {
      a.phase += a.speed;
      const pulse = 0.55 + Math.sin(t * 0.009 + a.phase) * 0.42;
      if (pulse <= 0) continue;
      ctx.globalAlpha = 0.2 * pulse;
      ctx.strokeStyle = `hsla(${a.hue}, 75%, 72%, 1)`;
      ctx.lineWidth = a.width;
      ctx.beginPath();
      ctx.moveTo(0, a.y + Math.sin(a.phase) * a.amp * 0.4);
      ctx.bezierCurveTo(W * 0.3, a.y - a.amp, W * 0.65, a.y + a.amp, W, a.y + Math.sin(a.phase * 0.7) * a.amp * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawBubble(entry) {
    clear(entry);
    drawSilhouette(entry, 'bubble');
    const { ctx, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of entry.bubbles) {
      b.phase += b.wobble;
      b.y -= b.speed;
      b.x += Math.sin(b.phase) * 0.28;
      if (b.y < -b.r) { b.y = H + b.r; b.x = Math.random() * W; }
      const a = 0.09 + Math.sin(t * 0.03 + b.phase) * 0.06;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#cfefff';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSparkles(entry);
    entry.t += 1;
  }

  function drawOff(entry) {
    clear(entry);
    const { ctx, stars, W, H, t } = entry;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      const a = 0.32 + Math.sin(t * 0.026 + s.phase) * 0.32;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff8ef';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    entry.t += 1;
  }

  const SCENES = {
    rain: drawRain, fire: drawFire, ocean: drawOcean, forest: drawForest,
    cafe: drawCafe, brown: drawBrown, river: drawRiver, beach: drawBeach,
    wind: drawWind, white: drawWhite, night: drawNight, breath: drawBreath, off: drawOff,
    thunder: drawThunder, waterfall: drawWaterfall, train: drawTrain, library: drawLibrary,
    cave: drawCave, windchime: drawWindchime, lofi: drawLofi, deep_space: drawDeepSpace,
    city_rain: drawCityRain, jungle: drawJungle, tide: drawTide, aurora: drawAurora,
    bubble: drawBubble,
  };

  function loop() {
    globalRaf = null;
    t += 1;
    for (const e of instances) {
      if (!e.canvas.isConnected) continue;
      e.t += 1;
      const scene = SCENES[ambient] || drawOff;
      scene(e);
    }
    if (instances.length) globalRaf = requestAnimationFrame(loop);
  }

  function ensure(canvasId) {
    let entry = instances.find((e) => e.canvas.id === canvasId);
    if (entry) return entry;
    entry = createEntry(canvasId);
    if (entry) instances.push(entry);
    return entry;
  }

  function start(canvasId) {
    const entry = ensure(canvasId);
    if (!entry) return;
    resize(entry);
    if (!globalRaf) globalRaf = requestAnimationFrame(loop);
  }

  function stop(canvasId) {
    const idx = instances.findIndex((e) => e.canvas.id === canvasId);
    if (idx >= 0) instances.splice(idx, 1);
    if (!instances.length && globalRaf) {
      cancelAnimationFrame(globalRaf);
      globalRaf = null;
    }
  }

  function setAmbient(name, canvasId) {
    ambient = name || 'off';
    start(canvasId);
  }

  function setAmbientForAll(name) {
    ambient = name || 'off';
    if (!globalRaf && instances.length) globalRaf = requestAnimationFrame(loop);
    else if (globalRaf) { /* loop keeps running */ }
  }

  window.addEventListener('resize', () => {
    // debounce resize: only resize visible canvases
    for (const e of instances) {
      if (e.canvas.isConnected) resize(e);
    }
  });

  return { start, stop, setAmbient, setAmbientForAll };
})();
