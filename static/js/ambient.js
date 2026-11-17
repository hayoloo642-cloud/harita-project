/* ============================================================
   Ambient — suara latar yang disintesis lewat Web Audio API
   (tanpa file eksternal, jalan offline)
   ============================================================ */
'use strict';

const ambientEngine = (() => {
  let ctx = null;
  let masterGain = null;
  const nodes = [];

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function makeNoiseBuffer(durationSec = 2) {
    const len = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * 0.9;
    return buffer;
  }

  function makeBrownBuffer(durationSec = 4) {
    const len = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  function loopNoise(type, filterFn) {
    const src = ctx.createBufferSource();
    src.buffer = type === 'brown' ? makeBrownBuffer() : makeNoiseBuffer(4);
    src.loop = true;
    const out = filterFn(src);
    src.connect(out);
    out.connect(masterGain);
    src.start();
    return src;
  }

  // simple white/noise helper with frequency sweep (wind whistle)
  const windWhistle = (start, end, duration, peakGain) => {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(start, t0);
    o.frequency.exponentialRampToValueAtTime(end, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peakGain, t0 + duration * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    o.connect(g); g.connect(masterGain);
    o.start(t0); o.stop(t0 + duration + 0.02);
  };

  function stopAll() {
    nodes.forEach((n) => { try { n.stop?.(); } catch {} });
    nodes.length = 0;
    if (audioTimers.length) audioTimers.forEach((t) => clearInterval(t));
    audioTimers.length = 0;
    if (ctx) {
      try { ctx.close(); } catch {}
      ctx = null;
      masterGain = null;
    }
  }

  function applyVolume(v01) {
    if (masterGain) masterGain.gain.setTargetAtTime(v01, ctx.currentTime, 0.4);
  }

  const audioTimers = [];

  const engines = {
    rain() {
      loopNoise('white', (src) => {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        filter.Q.value = 0.6;
        src.connect(filter);
        return filter;
      });
      // tetesan sesekali
      const tick = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 1200 + Math.random() * 800;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.4);
      };
      audioTimers.push(setInterval(tick, 500 + Math.random() * 800));
    },

    fire() {
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 600;
        src.connect(lp);
        return lp;
      });
      const crackle = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 90 + Math.random() * 140;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.3);
      };
      audioTimers.push(setInterval(crackle, 900 + Math.random() * 2200));
    },

    ocean() {
      loopNoise('white', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        // slow LFO untuk swell
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(lp.frequency);
        lfo.start(ctx.currentTime);
        src.connect(lp);
        return lp;
      });
    },

    forest() {
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 320;
        src.connect(lp);
        return lp;
      });
      const bird = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1900 + Math.random() * 900, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(2400 + Math.random() * 600, ctx.currentTime + 0.08);
        o.frequency.exponentialRampToValueAtTime(1600 + Math.random() * 800, ctx.currentTime + 0.18);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.24);
      };
      audioTimers.push(setInterval(bird, 2500 + Math.random() * 3500));
    },

    cafe() {
      loopNoise('white', (src) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 650;
        bp.Q.value = 0.8;
        src.connect(bp);
        return bp;
      });
      const murmur = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = 90 + Math.random() * 120;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.15);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.3);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 1.35);
      };
      audioTimers.push(setInterval(murmur, 2800 + Math.random() * 3500));
    },

    brown() {
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 260;
        src.connect(lp);
        return lp;
      });
    },

    river() {
      // sungai — rolling white noise melalui low-pass ganda + gurgle
      loopNoise('white', (src) => {
        const lp1 = ctx.createBiquadFilter();
        lp1.type = 'lowpass';
        lp1.frequency.value = 1100;
        const lp2 = ctx.createBiquadFilter();
        lp2.type = 'lowpass';
        lp2.frequency.value = 420;
        src.connect(lp1);
        lp1.connect(lp2);
        return lp2;
      });
      const gurgle = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 500 + Math.random() * 400;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.22);
      };
      audioTimers.push(setInterval(gurgle, 280 + Math.random() * 420));
    },

    beach() {
      // pantai — ombak + deru ombak + bisik ombak
      loopNoise('white', (src) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 0.5;
        src.connect(bp);
        return bp;
      });
      const wave = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 180 + Math.random() * 60;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 3.3);
      };
      audioTimers.push(setInterval(wave, 3200 + Math.random() * 2200));
    },

    wind() {
      // angin — brown noise + slow gusts + sesekali siulan
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 480;
        const peak = ctx.createBiquadFilter();
        peak.type = 'peaking';
        peak.frequency.value = 900;
        peak.Q.value = 1.2;
        peak.gain.value = 4;
        src.connect(lp);
        lp.connect(peak);
        return peak;
      });
      const gustTimer = () => {
        if (!ctx) return;
        windWhistle(300 + Math.random() * 500, 1100 + Math.random() * 400, 2.2, 0.06);
      };
      audioTimers.push(setInterval(gustTimer, 4500 + Math.random() * 4500));
    },

    white() {
      // sunyi total — white noise steril (fokus tingkat tinggi)
      loopNoise('white', (src) => {
        const flatten = ctx.createGain();
        flatten.gain.value = 0.35;
        src.connect(flatten);
        return flatten;
      });
    },

    night() {
      // malam — jangkrik di atas noise lembut + sesekali burung
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 300;
        src.connect(lp);
        return lp;
      });
      const cricket = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = 4200 + Math.random() * 400;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.025, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.13);
      };
      audioTimers.push(setInterval(cricket, 900 + Math.random() * 1200));
    },

    thunder() {
      // petir — hujan + sesekali gemuruh jauh
      engines.rain.call(this);
      const rumble = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(55, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 2.5);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 3.1);
      };
      audioTimers.push(setInterval(rumble, 6500 + Math.random() * 7000));
    },

    waterfall() {
      // air terjun — white noise keras + low rumble berkelanjutan
      loopNoise('white', (src) => {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 400;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1200;
        src.connect(hp); hp.connect(lp);
        return lp;
      });
      const rumble = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 48;
        o.frequency.linearRampToValueAtTime(52, ctx.currentTime + 2);
        o.frequency.linearRampToValueAtTime(48, ctx.currentTime + 4);
        g.gain.setValueAtTime(0.045, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 2);
        g.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 4);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 4.1);
      };
      rumble();
      audioTimers.push(setInterval(rumble, 4000));
    },

    train() {
      // kereta — ketukan khas berkedip + angin + deru
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 350;
        src.connect(lp);
        return lp;
      });
      const click = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 90 + Math.random() * 30;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
      };
      // pola k-k click repetitif
      let beat = 0;
      const bassClick = () => { beat++; click(); if (beat % 2 === 0) setTimeout(() => click(), 180); };
      audioTimers.push(setInterval(bassClick, 620 + Math.random() * 60));
    },

    library() {
      // perpustakaan — murmer latar + sesekali buka halaman
      loopNoise('white', (src) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 450 + Math.random() * 350;
        bp.Q.value = 0.9;
        src.connect(bp);
        return bp;
      });
      const page = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = 800 + Math.random() * 200;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.23);
      };
      audioTimers.push(setInterval(page, 3500 + Math.random() * 4500));
    },

    cave() {
      // gua — tetesan dalam gema + nada rendah
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 240;
        src.connect(lp);
        return lp;
      });
      const drip = () => {
        if (!ctx) return;
        [0, 0.18].forEach((delay, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = 520 - i * 260 + Math.random() * 120;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
          g.gain.exponentialRampToValueAtTime(0.11 / (i + 1), ctx.currentTime + delay + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 1.6);
          o.connect(g); g.connect(masterGain);
          o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 1.7);
        });
      };
      audioTimers.push(setInterval(drip, 2800 + Math.random() * 2800));
    },

    windchime() {
      // bel angin — nada lembut acak sesekali
      const timbres = [523.25, 659.25, 783.99, 880.00, 1046.5];
      const chime = () => {
        if (!ctx) return;
        const f = timbres[Math.floor(Math.random() * timbres.length)];
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.2);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 2.3);
      };
      audioTimers.push(setInterval(chime, 1800 + Math.random() * 3200));
    },

    lofi() {
      // lofi — crackle vinyl + pad lembut (C minor / maj)
      loopNoise('white', (src) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.5;
        src.connect(bp);
        return bp;
      });
      const pad = () => {
        if (!ctx) return;
        const freqs = [130.81, 164.81, 196.00]; // C E G
        freqs.forEach((f) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 0.7);
          g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 5.5);
          o.connect(g); g.connect(masterGain);
          o.start(ctx.currentTime); o.stop(ctx.currentTime + 5.6);
        });
      };
      pad();
      audioTimers.push(setInterval(pad, 5200));
    },

    deep_space() {
      // luar angkasa — hum dalem + shimmer arc
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 200;
        src.connect(lp);
        return lp;
      });
      const shimmer = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(800 + Math.random() * 600, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 800, ctx.currentTime + 3.2);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 1);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 3.3);
      };
      audioTimers.push(setInterval(shimmer, 4200 + Math.random() * 2800));
    },

    city_rain() {
      // hujan kota — hujan + lalu lintas samar di jauh
      engines.rain.call(this);
      const traffic = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 55 + Math.random() * 15;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.4);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 2.5);
      };
      audioTimers.push(setInterval(traffic, 3800 + Math.random() * 3500));
    },

    jungle() {
      // hutan lebat — kerak + serangga + katak + burung
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 450;
        src.connect(lp);
        return lp;
      });
      const critter = () => {
        if (!ctx) return;
        const kind = Math.floor(Math.random() * 3);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        if (kind === 0) {
          o.type = 'square'; o.frequency.value = 1100 + Math.random() * 700; // jangkrik
        } else if (kind === 1) {
          o.type = 'sine'; o.frequency.value = 700 + Math.random() * 200; // katak
        } else {
          o.type = 'sine'; o.frequency.value = 1600 + Math.random() * 600; // burung
        }
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.38);
      };
      audioTimers.push(setInterval(critter, 300 + Math.random() * 600));
    },

    tide() {
      // pasang surut — ombak masuk-keluar lambat 6 detik siklus
      loopNoise('white', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 600;
        src.connect(lp);
        return lp;
      });
      const swell = () => {
        if (!ctx) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 140;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.14, t + 2.2);
        g.gain.linearRampToValueAtTime(0.0001, t + 5.8);
        o.connect(g); g.connect(masterGain);
        o.start(t); o.stop(t + 5.9);
      };
      swell();
      audioTimers.push(setInterval(swell, 6000));
    },

    aurora() {
      // aurora — shimmer arc + pad lembut
      loopNoise('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 280;
        src.connect(lp);
        return lp;
      });
      const arc = () => {
        if (!ctx) return;
        const freqs = [293.66, 369.99, 440.00, 587.33]; // D F# A D
        freqs.forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          const start = ctx.currentTime + i * 0.25;
          g.gain.setValueAtTime(0.0001, start);
          g.gain.linearRampToValueAtTime(0.018, start + 0.8);
          g.gain.linearRampToValueAtTime(0.0001, start + 6);
          o.connect(g); g.connect(masterGain);
          o.start(start); o.stop(start + 6.1);
        });
      };
      arc();
      audioTimers.push(setInterval(arc, 6500));
    },

    bubble() {
      // gelembung — poppelan udara bawah air (pengin apa pun)
      loopNoise('white', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        src.connect(lp);
        return lp;
      });
      const pop = () => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        const freq = 600 + Math.random() * 1200;
        o.frequency.setValueAtTime(freq, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + 0.06);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        o.connect(g); g.connect(masterGain);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.16);
      };
      audioTimers.push(setInterval(pop, 140 + Math.random() * 380));
    },

    breath() {
      // napas — 4 detik siklus tarik & embus (4-4)
      const breathe = () => {
        if (!ctx) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 220;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.09, t + 2);
        g.gain.linearRampToValueAtTime(0.0001, t + 4);
        o.connect(g); g.connect(masterGain);
        o.start(t); o.stop(t + 4.1);
      };
      breathe();
      audioTimers.push(setInterval(breathe, 4000));
    },
  };

  function play(name, volume01) {
    stopAll();
    const e = engines[name];
    if (!e) return;
    const created = ensure();
    if (!created) return;
    if (ctx.state === 'suspended') ctx.resume();
    e();
    applyVolume(volume01 ?? 0.35);
  }

  function stop() { stopAll(); }
  function setVolume(v01) { applyVolume(v01); }

  return { play, stop, setVolume };
})();

window.ambientEngine = ambientEngine;
