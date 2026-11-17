/* ============================================================
   Icons (inline SVG, no external deps)
   ============================================================ */
const ICON_PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  'cloud-sun': '<path d="M12 3v2M5.2 5.2l1.4 1.4M3 12h2M18.8 5.2l-1.4 1.4"/><circle cx="12" cy="12" r="3.5"/><path d="M9 20h9a4 4 0 0 0 .6-7.96A6 6 0 0 0 7 13.5 3.5 3.5 0 0 0 9 20Z"/>',
  'check-square': '<path d="M9 11l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H4.5v1.5A3.5 3.5 0 0 0 8 10M16 5h3.5v1.5A3.5 3.5 0 0 1 16 10M12 13v3M8.5 21h7M9.5 16h5v5h-5z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h4"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5V5.5M8 7h8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'chevron-left': '<path d="m15 5-7 7 7 7"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 2.64-6.36"/><path d="M3 4v5h5"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.8V7l-2-2h10l-2 2v3.8l2 2.2H7l2-2.2Z"/>',
  droplets: '<path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3Z"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8a2.5 2.5 0 1 1-2.5 2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
  sunrise: '<path d="M12 3v5M9 6l3 3 3-3M3 18h18M6 22h12M8 14a4 4 0 0 1 8 0"/>',
  sunset: '<path d="M12 8V3M9 6l3-3 3 3M3 18h18M6 22h12M8 14a4 4 0 0 1 8 0"/>',
  gauge: '<path d="M12 15l4-4"/><path d="M4 18a9 9 0 1 1 16 0"/>',
  umbrella: '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z"/><path d="M12 12v6a3 3 0 0 0 6 0"/>',
  thermometer: '<path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z"/>',
  'map-pin': '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  flag: '<path d="M4 21V4h10l-1.5 4H20l-2 5 2 5H4"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/>',
  coffee: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9h2a3 3 0 0 1 0 6h-2M4 21h13"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  'external-link': '<path d="M14 4h6v6M20 4 10 14"/><path d="M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"/>',
  battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2M6 10.5v3M9.5 10.5v3M13 10.5v3"/>',
  flame: '<path d="M12 22c4.4 0 7-2.8 7-6.4 0-2.6-1.5-4.4-2.7-6.1-.7-1-1.3-2-1.6-3.5-1.7 1.2-2.4 3.1-2.3 5-1.1-.4-1.6-1.7-1.8-3.2C7 10 5 12.3 5 15.6 5 19.2 7.6 22 12 22Z"/>',
  wifi: '<path d="M2.5 9.5a15 15 0 0 1 19 0M5.5 13a10.5 10.5 0 0 1 13 0M8.5 16.5a6 6 0 0 1 7 0"/><circle cx="12" cy="20" r="1.3" fill="currentColor" stroke="none"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
  printer: '<path d="M6 9V3h12v6M6 18H3v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6h-3M6 14h12v7H6z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  star: '<path d="m12 3 2.6 5.9 6.4.5-4.9 4.2 1.5 6.2L12 17.3 6.4 19.8l1.5-6.2-4.9-4.2 6.4-.5Z"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-9"/>',
  target2: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  'trend-up': '<path d="m3 17 6-6 4 4 7-8"/><path d="M14 7h6v6"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>',
};

function iconSvg(name, extra = '') {
  if (name === 'spinner') {
    return `<svg class="spin ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56" opacity=".9"/></svg>`;
  }
  const path = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg class="${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function ico(name, extra = '') {
  return `<span class="ico ${extra}">${iconSvg(name)}</span>`;
}

/* ---------- weather icons ---------- */
let __wxSeq = 0;
function weatherSvg(code, isDay = true) {
  const id = ++__wxSeq;
  const cat = wmoInfo(code).cat;
  const sun = (cx, cy, r) => `
    <circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="#e8b49e" opacity=".12"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#e8b49e"/>`;
  const rays = (cx, cy, inner, outer) => {
    let out = '';
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      const x1 = cx + Math.cos(a) * inner, y1 = cy + Math.sin(a) * inner;
      const x2 = cx + Math.cos(a) * outer, y2 = cy + Math.sin(a) * outer;
      out += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#e8b49e" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    return out;
  };
  const cloud = (x = 0, y = 0, scale = 1, fill = '#e0d8d5') => `
    <g transform="translate(${x} ${y}) scale(${scale})">
      <path d="M20 45.5c-5.8 0-10.5-4.4-10.5-9.8 0-5.1 4.2-9.3 9.4-9.7C20 21.2 25 18 30.6 18c6.6 0 12 5.2 12 11.6 0 .4 0 .8-.1 1.2h.7c4.5 0 8.1 3.4 8.1 7.4s-3.6 7.3-8.1 7.3H20Z" fill="#a89c98" opacity=".45" transform="translate(1.6 1.6)"/>
      <path d="M20 45.5c-5.8 0-10.5-4.4-10.5-9.8 0-5.1 4.2-9.3 9.4-9.7C20 21.2 25 18 30.6 18c6.6 0 12 5.2 12 11.6 0 .4 0 .8-.1 1.2h.7c4.5 0 8.1 3.4 8.1 7.4s-3.6 7.3-8.1 7.3H20Z" fill="${fill}"/>
    </g>`;
  const drops = (color = '#fc8f8f') => `
    <g stroke="${color}" stroke-width="2.4" stroke-linecap="round">
      <path d="M22 49l-2.4 5"/><path d="M31 50.5 28.6 55.5"/><path d="M40 49l-2.4 5"/>
    </g>`;
  const stars = `<g fill="#e0d8d5" opacity=".9"><circle cx="17" cy="17" r="1.4"/><circle cx="46" cy="13" r="1.8"/><circle cx="49" cy="29" r="1.1"/><circle cx="14" cy="33" r="1.1"/></g>`;

  let body = '';
  switch (cat) {
    case 'clear':
      body = isDay ? sun(32, 32, 11) + rays(32, 32, 17, 24) : `<path d="M41 10a21 21 0 1 0 13 33A23 23 0 0 1 41 10Z" fill="#d8ccc9"/><circle cx="41" cy="10" r="14" fill="#d8ccc9" opacity=".08"/>${stars}`;
      break;
    case 'partly':
      body = isDay
        ? sun(41, 23, 8) + rays(41, 23, 13, 18) + cloud(-4, 4, 1)
        : `<path d="M45 10a15 15 0 1 0 9 23.5A16.5 16.5 0 0 1 45 10Z" fill="#d8ccc9"/>` + cloud(-4, 6, 1) + stars;
      break;
    case 'cloud':
      body = cloud(-2, 2, 1);
      break;
    case 'fog':
      body = cloud(-2, 0, 1, '#cfc4c2') + `<g stroke="#9b8f8d" stroke-width="2.2" stroke-linecap="round" opacity=".85"><path d="M14 51h30"/><path d="M20 57h26"/><path d="M16 45h16"/></g>`;
      break;
    case 'rain':
      body = cloud(-2, 0, 1) + drops();
      break;
    case 'thunder':
      body = cloud(-2, 0, 1, '#cfc4c2') + `<path d="m34 43-8 12h5.5L28 63l11-14h-6l4.5-6Z" fill="#e8b49e"/>` + `<g stroke="#fc8f8f" stroke-width="2.2" stroke-linecap="round"><path d="M20 49l-2 4"/><path d="M44 50l-2 4"/></g>`;
      break;
    case 'snow':
      body = cloud(-2, 0, 1) + `<g fill="#e0d8d5"><circle cx="22" cy="51" r="2"/><circle cx="32" cy="55" r="2"/><circle cx="42" cy="51" r="2"/></g>`;
      break;
    default:
      body = cloud(-2, 2, 1);
  }
  return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-wx="${id}">${body}</svg>`;
}

const WMO = {
  0: ['Cerah', 'clear'], 1: ['Cerah berawan', 'partly'], 2: ['Berawan', 'partly'], 3: ['Mendung', 'cloud'],
  45: ['Kabut', 'fog'], 48: ['Kabut beku', 'fog'],
  51: ['Gerimis ringan', 'rain'], 53: ['Gerimis', 'rain'], 55: ['Gerimis lebat', 'rain'],
  56: ['Gerimis beku', 'rain'], 57: ['Gerimis beku lebat', 'rain'],
  61: ['Hujan ringan', 'rain'], 63: ['Hujan', 'rain'], 65: ['Hujan lebat', 'rain'],
  66: ['Hujan beku', 'rain'], 67: ['Hujan beku lebat', 'rain'],
  71: ['Salju ringan', 'snow'], 73: ['Salju', 'snow'], 75: ['Salju lebat', 'snow'], 77: ['Butiran salju', 'snow'],
  80: ['Hujan lokal ringan', 'rain'], 81: ['Hujan lokal', 'rain'], 82: ['Hujan lokal lebat', 'rain'],
  85: ['Hujan salju', 'snow'], 86: ['Hujan salju lebat', 'snow'],
  95: ['Badai petir', 'thunder'], 96: ['Badai petir + es', 'thunder'], 99: ['Badai petir hebat', 'thunder'],
};
function wmoInfo(code) {
  const found = WMO[code] || ['Cuaca tidak diketahui', 'cloud'];
  return { label: found[0], cat: found[1] };
}
