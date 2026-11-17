/* ============================================================
   Mode jam — tampilan jam penuh dengan ambient yang hidup
   ============================================================ */
'use strict';

const clockMode = (() => {
  const state = { rAF: null };
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function render() {
    const now = new Date();
    const timeEl = document.getElementById('clockTime');
    if (!timeEl) return;
    timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const dayEl = document.getElementById('clockDay');
    const monthEl = document.getElementById('clockMonth');
    const yearEl = document.getElementById('clockYear');
    const weekdayEl = document.getElementById('clockWeekday');
    if (dayEl) dayEl.textContent = String(now.getDate());
    if (monthEl) monthEl.textContent = MONTHS[now.getMonth()];
    if (yearEl) yearEl.textContent = String(now.getFullYear());
    if (weekdayEl) weekdayEl.textContent = DAYS[now.getDay()];
    state.rAF = requestAnimationFrame(render);
  }

  function openMode() {
    const o = document.getElementById('clockMode');
    if (!o) return;
    o.classList.add('open');
    o.setAttribute('aria-hidden', 'false');
    if (window.fmAmbient) window.fmAmbient.setAmbient(state.ambient_sound || 'off', 'clockAmbientCanvas');
    if (window.ambientEngine && state.ambient_sound && state.ambient_sound !== 'off') {
      window.ambientEngine.play(state.ambient_sound, (state.ambient_volume || 35) / 100);
    }
    state.rAF = requestAnimationFrame(render);
    syncAmbient();
  }
  function closeMode() {
    const o = document.getElementById('clockMode');
    if (!o) return;
    o.classList.remove('open');
    o.setAttribute('aria-hidden', 'true');
    if (state.rAF) cancelAnimationFrame(state.rAF);
    if (window.fmAmbient) window.fmAmbient.stop();
    if (window.ambientEngine) window.ambientEngine.stop();
  }

  function syncAmbient() {
    // mirror the shared ambient settings so chips reflect same state
    const current = (window.__clockAmbient ? window.__clockAmbient.sound : (localStorage.getItem('harita:ambient_sound') || 'off'));
    if (current && current !== 'off') {
      document.querySelectorAll('#clockAmbientChips .fm-amb-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.amb === current);
      });
    }
  }

  function wireAmbientBar() {
    const chips = document.getElementById('clockAmbientChips');
    const toggle = document.getElementById('clockAmbientToggle');
    const collapseBtn = document.getElementById('clockAmbientCollapse');
    const body = document.getElementById('clockAmbientBody');
    const collapseIcon = document.getElementById('clockAmbientCollapseIcon');
    const vol = document.getElementById('clockAmbientVolume');
    const vNum = document.getElementById('clockAmbientVolumeValue');

    const apply = (patch) => {
      Object.assign(state, patch);
      if (vNum && patch.ambient_volume !== undefined) vNum.textContent = `${patch.ambient_volume}%`;
      if (vol && patch.ambient_volume !== undefined) vol.value = String(patch.ambient_volume);
      document.querySelectorAll('#clockAmbientChips .fm-amb-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.amb === state.ambient_sound);
      });
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(state.ambient_sound !== 'off'));
        toggle.textContent = state.ambient_sound !== 'off' ? 'Aktif' : 'Mati';
        toggle.classList.toggle('is-on', state.ambient_sound !== 'off');
      }
      const overlay = document.getElementById('clockMode');
      if (overlay) {
        ['ambient-rain','ambient-fire','ambient-ocean','ambient-forest','ambient-cafe','ambient-brown','ambient-river','ambient-beach','ambient-wind','ambient-white','ambient-night','ambient-breath','ambient-thunder','ambient-waterfall','ambient-train','ambient-library','ambient-cave','ambient-windchime','ambient-lofi','ambient-deep_space','ambient-city_rain','ambient-jungle','ambient-tide','ambient-aurora','ambient-bubble'].forEach((c) => overlay.classList.remove(c));
        if (state.ambient_sound && state.ambient_sound !== 'off') overlay.classList.add('ambient-' + state.ambient_sound);
      }
      if (window.ambientEngine) {
        if (state.ambient_sound === 'off') window.ambientEngine.stop();
        else window.ambientEngine.play(state.ambient_sound, (state.ambient_volume || 35) / 100);
      }
      if (window.fmAmbient) window.fmAmbient.setAmbient(state.ambient_sound || 'off', 'clockAmbientCanvas');
    };

    if (chips) {
      chips.addEventListener('click', (e) => {
        const btn = e.target.closest('.fm-amb-chip');
        if (!btn) return;
        apply({ ambient_sound: btn.dataset.amb });
      });
    }
    if (vol) {
      vol.addEventListener('input', (e) => apply({ ambient_volume: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }));
    }
    if (toggle) {
      toggle.addEventListener('click', () => {
        apply({ ambient_sound: state.ambient_sound === 'off' ? 'rain' : 'off' });
      });
    }
    if (collapseBtn && body) {
      collapseBtn.addEventListener('click', () => {
        const collapsed = body.hidden;
        body.hidden = !collapsed;
        if (collapseIcon) collapseIcon.textContent = collapsed ? '▾' : '▸';
      });
    }

    // seed from focus settings if available
    try {
      const saved = JSON.parse(localStorage.getItem('harita:timer') || '{}');
      // fallback: try bootstrap via state if loaded
    } catch {}
    state.ambient_sound = 'off';
    state.ambient_volume = 35;
  }

  function init() {
    document.getElementById('clockModeOpen')?.addEventListener('click', openMode);
    document.getElementById('clockModeExit')?.addEventListener('click', closeMode);
    document.getElementById('clockGoFocus')?.addEventListener('click', () => {
      closeMode();
      const btn = document.getElementById('focusModeOpen');
      if (btn) btn.click();
    });
    // hydrate settings if available — easiest is to reuse the API
    fetch('/api/settings', { credentials: 'same-origin' }).then((r) => r.json()).then((d) => {
      if (d && d.settings) {
        state.ambient_sound = d.settings.ambient_sound || 'off';
        state.ambient_volume = Number(d.settings.ambient_volume) || 35;
      }
    }).catch(() => {});
    wireAmbientBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openMode, closeMode };
})();
