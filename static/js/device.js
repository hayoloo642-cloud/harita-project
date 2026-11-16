/* ============================================================
   Device performance monitor
   ============================================================ */
let devicePoll = null;

function fmtBytes(n) {
  if (!n) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
function fmtPct(n) { return `${n}%`; }

function renderDeviceGrid(d) {
  const g = $('#deviceGrid');
  if (!g) return;
  const bat = d.battery || {};
  const rows = [
    { key: "cpu", label: "CPU", icon: "gauge", value: d.cpu_percent, sub: `${d.cpu_count} core` },
    { key: "ram", label: "RAM", icon: "droplets", value: d.memory.percent, sub: `${fmtBytes(d.memory.used)} / ${fmtBytes(d.memory.total)}` },
    { key: "disk", label: "Penyimpanan", icon: "book", value: d.disk.percent, sub: `${fmtBytes(d.disk.used)} / ${fmtBytes(d.disk.total)}` },
    { key: "batt", label: "Baterai", icon: "battery", value: bat.percent ?? "—", sub: bat.plugged ? "Tercolok" : (bat.percent != null ? "Menggunakan baterai" : "Tidak terdeteksi") },
  ];
  g.innerHTML = rows.map((r) => {
    const cls = r.key === "cpu" ? "cpu" : r.key === "ram" ? "ram" : r.key === "disk" ? "disk" : "batt";
    const pct = typeof r.value === "number" ? Math.round(r.value) : 0;
    return `<div class="device-stat ${cls}">
      <span class="ds-icon">${iconSvg(r.icon)}</span>
      <strong>${typeof r.value === "number" ? pct + "%" : esc(String(r.value))}</strong>
      <span>${esc(r.sub)}</span>
      <div style="height:5px;border-radius:99px;background:rgba(255,255,255,.12);margin-top:8px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent-2));transition:width .5s ease"></div>
      </div>
    </div>`;
  }).join('');
}

function renderDeviceDetail(d) {
  const node = $('#deviceDetail');
  if (!node) return;
  const net = d.network || {};
  const up = d.uptime_seconds;
  const days = Math.floor(up / 86400);
  const hours = Math.floor((up % 86400) / 3600);
  const mins = Math.floor((up % 3600) / 60);
  const bat = d.battery || {};
  let left = "—";
  if (bat.secs_left != null) {
    const h = Math.floor(bat.secs_left / 3600);
    const m = Math.floor((bat.secs_left % 3600) / 60);
    left = h > 0 ? `${h}j ${m}m` : `${m}m`;
  }
  node.innerHTML = `
    <div class="card-head"><div><p class="eyebrow">Rincian sistem</p><h3>Device</h3></div></div>
    <table class="device-table">
      <tr><th>Platform</th><td>${esc(d.platform)}</td></tr>
      <tr><th>Python</th><td>${esc(d.python)}</td></tr>
      <tr><th>Waktu aktif (uptime)</th><td>${days > 0 ? days + " hari " : ""}${hours} jam ${mins} menit</td></tr>
      <tr><th>CPU</th><td><span class="mono">${d.cpu_percent}%</span> · <span class="mono">${d.cpu_count} core</span></td></tr>
      <tr><th>RAM</th><td><span class="mono">${fmtBytes(d.memory.used)}</span> dipakai dari <span class="mono">${fmtBytes(d.memory.total)}</span> (<span class="mono">${d.memory.percent}%</span>)</td></tr>
      <tr><th>Swap</th><td><span class="mono">${fmtBytes(d.swap.used)}</span> / <span class="mono">${fmtBytes(d.swap.total)}</span> (<span class="mono">${d.swap.percent}%</span>)</td></tr>
      <tr><th>Disk</th><td><span class="mono">${fmtBytes(d.disk.used)}</span> / <span class="mono">${fmtBytes(d.disk.total)}</span> (<span class="mono">${d.disk.percent}%</span>)</td></tr>
      <tr><th>Baterai</th><td>${bat.percent != null ? `<span class="mono">${bat.percent}%</span>` : "—"} · ${bat.plugged ? "<span class='chip ok'>Tercolok</span>" : "<span class='chip warn'>Baterai</span>"} · sisa <span class="mono">${left}</span></td></tr>
      <tr><th>Jaringan kirim</th><td><span class="mono">${fmtBytes(net.bytes_sent)}</span></td></tr>
      <tr><th>Jaringan terima</th><td><span class="mono">${fmtBytes(net.bytes_recv)}</span></td></tr>
      <tr><th>Paket kirim</th><td><span class="mono">${net.packets_sent}</span></td></tr>
      <tr><th>Paket terima</th><td><span class="mono">${net.packets_recv}</span></td></tr>
      ${Object.keys(d.temperatures || {}).length ? `<tr><th>Suhu</th><td>${Object.entries(d.temperatures).map(([k, v]) => `<span class="chip">${esc(k)}: ${v.join(" / ")}°C</span>`).join(" ")}</td></tr>` : ""}
    </table>`;
}

async function loadDevice() {
  try {
    const d = await api("/api/device");
    if (d.ok) {
      renderDeviceGrid(d.device);
      renderDeviceDetail(d.device);
      const tag = $('#deviceUpdated');
      if (tag) tag.textContent = `Diperbarui ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      throw new Error(d.error || "Gagal memuat data device");
    }
  } catch (err) {
    const g = $('#deviceGrid');
    if (g) g.innerHTML = `<div class="hint" style="padding:30px 12px;text-align:center;color:var(--danger)">Gagal memuat device: ${esc(err.message)}</div>`;
    toast(err.message, "error");
  }
}

function startDevicePoll() {
  if (devicePoll) clearInterval(devicePoll);
  loadDevice();
  devicePoll = setInterval(() => {
    loadDevice();
  }, 8000);
}

function stopDevicePoll() {
  if (devicePoll) clearInterval(devicePoll);
  devicePoll = null;
}
