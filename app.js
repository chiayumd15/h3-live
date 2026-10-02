import { H3Parser } from './h3parser.js';
import { buildReport } from './report/reportHtml.js';
import { H3 } from './report/h3core.js';
import { createBle, isNative } from './ble.js';
import { saveFile, keepAwake } from './platform.js';

const SERVICE = 0xfff0, CH_DATA = 0xfff5, CH_CMD = 0xfff6;
const MAGIC = [0x4b, 0x59, 0x58, 0x42]; // "KYXB"
const CMD_ON = new Uint8Array([...MAGIC, 0x10, 0x80, 0x00]);
const CMD_OFF = new Uint8Array([...MAGIC, 0x10, 0x00, 0x80]);
const UV_PER_LSB = (25207.6 + 25208.3) / 65535; // ≈0.769 µV, same as 2chREC
const RATE = 250, WIN_SEC = 5;
const CH_NAMES = ['FP1', 'FP2', 'ECG', 'ROC'];

const $ = (id) => document.getElementById(id);
const logEl = $('log');
function log(msg, cls = '') {
  const t = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  const d = document.createElement('div'); d.textContent = `${t}  ${msg}`; if (cls) d.className = cls;
  logEl.prepend(d); while (logEl.childElementCount > 200) logEl.lastChild.remove();
}

// ---------- state ----------
let ble = null;            // BLE adapter (web or native), created on first connect
let device = null;         // { id, name }
let parser = new H3Parser();
let samples = 0, notifs = 0, bytes = 0, lastDataAt = 0, startedAt = 0;
let battery = null, userStopped = false, stallTimer = null;
const rings = CH_NAMES.map(() => new Float32Array(RATE * WIN_SEC));
const ACC_NAMES = ['X', 'Y', 'Z'], ACC_LSB_PER_G = 8192;
// raw (unfiltered) µV of FP1/FP2 for the live indices: 40 s → 5 s trimmed each end by the engine → 30 s analysed
const LIVE_SEC = 40, LIVE_N = RATE * LIVE_SEC;
const rawRing = [new Float32Array(LIVE_N), new Float32Array(LIVE_N)];
let rawHead = 0, rawFilled = 0;
const accRings = ACC_NAMES.map(() => new Float32Array(RATE * WIN_SEC));
let head = 0; // write index into rings
let filled = 0;
// simple 1st-order high-pass (0.5 Hz) to remove DC so waveforms stay in view
const hpAlpha = Math.exp(-2 * Math.PI * 0.5 / RATE);
const hpPrevIn = new Float32Array(4), hpPrevOut = new Float32Array(4);
// recording
let recording = false; let rec = null; let lastRec = null; let simMode = false;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ble?.isConnected()) keepAwake(true).catch(() => {}); });

function setStatus(text, cls) { const s = $('status'); s.textContent = text; s.className = 'status ' + cls; }
function setButtons() {
  const connected = !!(ble && ble.isConnected()) || simMode;
  $('btnConnect').disabled = connected; $('btnConnectAll').disabled = connected; $('btnDisconnect').disabled = !connected;
  $('btnRec').disabled = !connected; $('btnRec').textContent = recording ? '■ 停止並下載 EDF' : '● 開始錄製';
  $('btnRec').classList.toggle('recording', recording);
  $('btnReport').disabled = recording || !lastRec || lastRec.ch[0].length < 30 * RATE;
}

// ---------- BLE ----------
async function connect(all = false) {
  try {
    if (!ble) ble = await createBle();
    if (!ble.supported()) { log('此瀏覽器不支援 Web Bluetooth。Android 請用 Chrome 或安裝 H3 Live app；iPhone 的 Safari 不支援。', 'err'); return; }
    setStatus('選擇裝置…', 'wait');
    log(all ? '開啟裝置清單（顯示全部 BLE 裝置）…' : '開啟裝置清單（只列 xb5… / FFF0 服務）…');
    device = await ble.requestDevice(all);
    log(`選到裝置：${device.name || '(無名稱)'} id=${device.id}`);
    userStopped = false;
    await openStream();
  } catch (e) {
    const msg = String(e?.message || e);
    if (e?.name === 'NotFoundError' || /cancel|No device/i.test(msg)) { log('沒有選擇裝置（已取消或清單中沒有符合的裝置）。若清單是空的，請改按「列出全部藍牙裝置」。', 'warn'); setStatus('未連線', 'off'); }
    else if (e?.name === 'SecurityError') { log(`被瀏覽器拒絕：${msg}（需要 HTTPS 與使用者點擊）`, 'err'); setStatus('連線失敗', 'err'); }
    else if (/permission|denied|not granted/i.test(msg)) { log(`沒有藍牙權限：${msg}。請到 設定 → 應用程式 → H3 Live → 權限 開啟「附近裝置」`, 'err'); setStatus('連線失敗', 'err'); }
    else { log(`連線失敗：${e?.name || ''} ${msg}`, 'err'); setStatus('連線失敗', 'err'); }
    setButtons();
  }
}

async function openStream() {
  setStatus('連線中…', 'wait');
  await ble.connect(device.id, onDisconnected);
  log('GATT 已連線，訂閱 FFF5 notify…');
  parser.resync(); // before the first notification, so a device switch is not counted as lost blocks
  await ble.startNotifications(onNotify);
  log('送出串流 ON (KYXB 10 80 00)');
  await writeCmd(CMD_ON);
  startedAt = performance.now(); lastDataAt = startedAt;
  setStatus(`串流中：${device.name || ''}`, 'on');
  setButtons(); keepAwake(true).then(() => log('螢幕常亮已開啟')).catch((e) => log(`螢幕常亮失敗：${e.message}`, 'warn'));
  clearInterval(stallTimer);
  stallTimer = setInterval(watchdog, 2000);
}

async function writeCmd(buf) {
  try { await ble.write(buf); }
  catch (e) { log(`指令寫入失敗：${e.message}`, 'err'); throw e; }
}

let stalledResends = 0;
async function watchdog() {
  if (!ble || !ble.isConnected()) return;
  const gap = (performance.now() - lastDataAt) / 1000;
  if (gap > 5) {
    if (stalledResends < 3) { stalledResends++; log(`${gap.toFixed(0)} 秒沒資料，重送串流 ON（第 ${stalledResends} 次）`, 'warn'); await writeCmd(CMD_ON).catch(() => {}); }
    else { log('超過 15 秒沒有資料，斷線重連', 'err'); try { await ble.disconnect(); } catch {} onDisconnected(); }
  } else stalledResends = 0;
}

async function disconnect() {
  userStopped = true; clearInterval(stallTimer);
  if (recording) stopRecording();
  try { if (ble?.isConnected()) { await writeCmd(CMD_OFF); await new Promise(r => setTimeout(r, 350)); await writeCmd(CMD_OFF); log('已送串流 OFF'); } } catch {}
  try { await ble?.stopNotifications(); } catch {}
  try { await ble?.disconnect(); } catch {}
  setStatus('未連線', 'off'); setButtons(); keepAwake(false).catch(() => {});
}

let reconnectTimer = null;
function onDisconnected() {
  clearInterval(stallTimer);
  setStatus('已斷線', 'err'); setButtons();
  if (userStopped) { log('已斷線'); return; }
  log('連線中斷，3 秒後自動重連…', 'warn');
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    if (userStopped) return;
    try { await openStream(); log('重連成功', 'ok'); }
    catch (e) { log(`重連失敗：${e.message}`, 'err'); onDisconnected(); }
  }, 3000);
}

const events = [];
function onNotify(u8) {
  notifs++; bytes += u8.byteLength; lastDataAt = performance.now();
  if (u8.byteLength < 7) return;
  const payload = u8.subarray(6);
  events.length = 0;
  parser.feed(payload, events);
  for (const e of events) {
    if (e.type === 'line') {
      if (e.text.startsWith('BAT=')) { battery = parseFloat(e.text.slice(4)); }
      else if (!/^(RT=|TE=|TI=|CT=|XYZ)/.test(e.text) && /^[\x20-\x7e]{1,40}$/.test(e.text)) log(`狀態：${e.text}`);
      continue;
    }
    if (samples === 0) log(`收到第一個波形區塊 counter=${e.counter} N=${e.n} div=[${e.div}]`, 'ok');
    if (e.lostBefore) { const d = globalThis.__h3dbg || (globalThis.__h3dbg = { gaps: {}, n: 0 }); d.gaps[e.lostBefore] = (d.gaps[e.lostBefore] || 0) + 1; d.n++; } // counter-gap histogram for firmware diagnosis
    for (let i = 0; i < e.n; i++) {
      for (let c = 0; c < 4; c++) {
        const raw = e.channels[c] ? e.channels[c][i] : 0;
        const uv = raw * UV_PER_LSB;
        if (c < 2) rawRing[c][rawHead] = uv;
        // high-pass
        const y = hpAlpha * (hpPrevOut[c] + uv - hpPrevIn[c]); hpPrevIn[c] = uv; hpPrevOut[c] = y;
        rings[c][head] = y;
        if (recording) rec.ch[c].push(raw);
      }
      for (let c = 0; c < 3; c++) { const ac = e.channels[4 + c]; accRings[c][head] = ac && ac.length ? ac[Math.min(ac.length - 1, Math.floor(i / 5))] / ACC_LSB_PER_G : 0; }
      head = (head + 1) % rings[0].length; filled = Math.min(filled + 1, rings[0].length); samples++;
      rawHead = (rawHead + 1) % LIVE_N; rawFilled = Math.min(rawFilled + 1, LIVE_N);
    }
    if (recording) { const a = e.channels; for (let k = 0; k < (a[4]?.length || 0); k++) { rec.acc[0].push(a[4][k]); rec.acc[1].push(a[5][k]); rec.acc[2].push(a[6][k]); } }
  }
}

// ---------- stats ----------
const rateHist = []; // [t, samples] pairs for a 15-second sliding-window rate (Android BLE delivers in bursts)
function updateStats() {
  const s = parser.stats;
  const now = performance.now();
  rateHist.push([now, samples]); while (rateHist.length > 2 && now - rateHist[0][0] > 15000) rateHist.shift();
  const dt = (now - rateHist[0][0]) / 1000, dn = samples - rateHist[0][1];
  $('stSamples').textContent = samples.toLocaleString();
  $('stRate').textContent = dt > 2 && dn > 0 ? (dn / dt).toFixed(1) + ' Hz' : '—';
  $('stNotif').textContent = `${notifs.toLocaleString()} / ${(bytes / 1024).toFixed(0)} KB`;
  $('stBlocks').textContent = `${s.blocks} 丟 ${s.lostBlocks} 錯 ${s.checksumErrors} 框 ${s.framingErrors}`;
  $('stBat').textContent = battery != null ? battery.toFixed(2) + ' V' : '—';
  $('stRec').textContent = recording ? `${(rec.ch[0].length / RATE).toFixed(0)} s` : '—';
  // per-channel peak-to-peak over last second
  const n = Math.min(filled, RATE); const pp = [];
  for (let c = 0; c < showCh; c++) { let mn = Infinity, mx = -Infinity; for (let k = 0; k < n; k++) { const v = rings[c][(head - 1 - k + rings[c].length) % rings[c].length]; if (v < mn) mn = v; if (v > mx) mx = v; } pp.push(n ? (mx - mn).toFixed(0) : '—'); }
  $('stPP').textContent = pp.map((v, i) => `${CH_NAMES[i]} ${v}`).join('  ');
}

// ---------- live indices (same engine/thresholds as the report, rolling 40-s window) ----------
function liveStatus(s) {
  if (s >= 80) return ['穩定', '#2457a8'];
  if (s >= 65) return ['留意', '#e8912a'];
  if (s >= 50) return ['建議追蹤', '#7b56b8'];
  return ['建議評估', '#c0392b'];
}
function setTile(id, score, note) {
  const t = $(id), b = t.querySelector('b'), u = t.querySelector('u'), e = t.querySelector('em');
  if (score == null) { b.textContent = '—'; u.style.width = '0'; u.style.background = '#9aa4b2'; e.textContent = note; e.style.background = ''; e.style.color = ''; return; }
  const [txt, col] = liveStatus(score);
  b.textContent = score; u.style.width = score + '%'; u.style.background = col; e.textContent = note || txt; e.style.background = col; e.style.color = '#fff';
}
let liveBusy = false, lastLiveAt = 0;
function updateLive() {
  const active = (ble && ble.isConnected()) || simMode;
  if (!active) { if (rawFilled === 0) { setTile('liveStress', null, '等待訊號'); setTile('liveFocus', null, '等待訊號'); } return; }
  if (performance.now() - lastDataAt > 5000) { setTile('liveStress', null, '沒有資料'); setTile('liveFocus', null, '沒有資料'); return; }
  if (rawFilled < LIVE_N) { const left = Math.ceil((LIVE_N - rawFilled) / RATE); setTile('liveStress', null, `蒐集中 ${left} s`); setTile('liveFocus', null, `蒐集中 ${left} s`); return; }
  if (liveBusy) return; liveBusy = true;
  try {
    const fp1 = new Float32Array(LIVE_N), fp2 = new Float32Array(LIVE_N);
    for (let i = 0; i < LIVE_N; i++) { const j = (rawHead + i) % LIVE_N; fp1[i] = rawRing[0][j]; fp2[i] = rawRing[1][j]; }
    const mk = (label, data) => ({ label, unit: 'uV', transducer: 'H3', fs: RATE, pmin: -25207.6, pmax: 25208.3, data });
    const res = H3.analyze({ start: new Date(), durationSec: LIVE_SEC, nRec: LIVE_SEC, recDur: 1, patient: '', recording: 'live', signals: [mk('EEG1', fp1), mk('EEG2', fp2)] });
    if (res.contact && !res.contact.ok) { setTile('liveStress', null, '未偵測到電極'); setTile('liveFocus', null, '未偵測到電極'); }
    else if (!(res.usableFrac >= 0.5)) { setTile('liveStress', null, '訊號不佳'); setTile('liveFocus', null, '訊號不佳'); }
    else { setTile('liveStress', res.scores.stress); setTile('liveFocus', res.scores.focus); }
    lastLiveAt = performance.now();
  } catch (e) { setTile('liveStress', null, '計算失敗'); setTile('liveFocus', null, '計算失敗'); console.error(e); }
  finally { liveBusy = false; }
}
setInterval(updateLive, 2000);

// ---------- chart ----------
const canvas = $('chart'); const ctx = canvas.getContext('2d');
let scaleUv = 200; // ± µV per channel lane
$('scale').addEventListener('change', (e) => { scaleUv = +e.target.value; });
// 2ch (FP1/FP2) or 4ch (FP1/FP2/ECG/ROC) display; recording always keeps the full EDF layout
let showCh = 4;
try { showCh = localStorage.getItem('h3live.showCh') === '2' ? 2 : 4; } catch {}
function setShowCh(n) { showCh = n; $('btnCh').textContent = n + 'ch'; try { localStorage.setItem('h3live.showCh', String(n)); } catch {} }
$('btnCh').onclick = () => setShowCh(showCh === 4 ? 2 : 4);
setShowCh(showCh);
const showAcc = true; // X/Y/Z lanes always shown
function draw() {
  const dpr = devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  ctx.fillStyle = dark ? '#0f1419' : '#fff'; ctx.fillRect(0, 0, W, H);
  const lanes = showCh, len = rings[0].length;
  const accH = showAcc ? Math.max(36, H * 0.11) : 0; // each X/Y/Z lane (3 lanes ≈ 1/3 of chart)
  const laneH = (H - accH * 3) / lanes;
  ctx.font = '12px system-ui'; ctx.textBaseline = 'top';
  if (showAcc) {
    const ACC_RANGE = 2; // ±2 g
    for (let c = 0; c < 3; c++) {
      const y0 = lanes * laneH + c * accH, mid = y0 + accH / 2, k = accH / 2 / ACC_RANGE;
      ctx.fillStyle = dark ? '#121920' : '#f8fafc'; ctx.fillRect(0, y0, W, accH);
      ctx.strokeStyle = dark ? '#2a3440' : '#e5e7eb'; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
      ctx.fillStyle = dark ? '#9aa4b2' : '#6b7280'; ctx.font = '12px system-ui'; ctx.fillText(`${ACC_NAMES[c]} ±2 g`, 6, y0 + 2);
      ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, accH); ctx.clip();
      ctx.strokeStyle = ['#f59e0b', '#0891b2', '#64748b'][c]; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const idx = Math.floor(x / W * len), i = (head + idx) % len;
        if (idx >= len - filled) { const y = mid - accRings[c][i] * k; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        else if (filled && idx === len - filled) ctx.moveTo(x, mid);
      }
      ctx.stroke(); ctx.restore();
    }
    ctx.font = '12px system-ui';
  }
  for (let c = 0; c < lanes; c++) {
    const y0 = c * laneH;
    ctx.strokeStyle = dark ? '#2a3440' : '#e5e7eb'; ctx.beginPath(); ctx.moveTo(0, y0 + laneH); ctx.lineTo(W, y0 + laneH); ctx.stroke();
    ctx.fillStyle = dark ? '#9aa4b2' : '#6b7280'; ctx.fillText(`${CH_NAMES[c]}  ±${scaleUv} µV`, 6, y0 + 4);
    ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, laneH); ctx.clip();
    ctx.strokeStyle = ['#2563eb', '#16a34a', '#dc2626', '#9333ea'][c]; ctx.lineWidth = 1.2; ctx.beginPath();
    const mid = y0 + laneH / 2, k = laneH / 2 / scaleUv;
    for (let x = 0; x < W; x++) {
      const idx = Math.floor(x / W * len); // left = oldest
      const i = (head + idx) % len;
      if (idx >= len - filled) { const y = mid - rings[c][i] * k; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      else if (filled && idx === len - filled) ctx.moveTo(x, mid);
    }
    ctx.stroke(); ctx.restore();
  }
  requestAnimationFrame(draw);
}

// ---------- recording / EDF ----------
function startRecording() {
  rec = { t0: new Date(), ch: [[], [], [], []], acc: [[], [], []] };
  recording = true; setButtons(); log('開始錄製');
}
function stopRecording() {
  recording = false; setButtons();
  const secs = Math.floor(rec.ch[0].length / RATE);
  if (secs < 1) { log('錄製不足 1 秒，不存檔', 'warn'); return; }
  lastRec = rec; setButtons();
  log(`錄製完成 ${secs} 秒`, 'ok');
  $('stopSecs').textContent = `${secs} 秒`;
  $('stopReport').disabled = secs < 30; $('stopReport').textContent = secs < 30 ? '直接產生報告（需 ≥30 秒）' : '直接產生報告';
  $('stopDlg').showModal();
}
function saveLastEdf() {
  const secs = Math.floor(lastRec.ch[0].length / RATE);
  const blob = buildEdf(lastRec, secs);
  const name = `H3_${(device?.name || 'h3').replace(/\W+/g, '')}_${fmtDate(lastRec.t0)}.edf`;
  saveFile(name, blob).then((m) => log(`${m}（${secs} 秒）`, 'ok')).catch((e) => log(`存檔失敗：${e.message}`, 'err'));
}
$('stopSaveEdf').onclick = () => { $('stopDlg').close(); saveLastEdf(); };
$('stopReport').onclick = () => { $('stopDlg').close(); $('btnReport').click(); };
$('stopLater').onclick = () => $('stopDlg').close();
const pad = (n, w = 2) => String(n).padStart(w, '0');
const fmtDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
function buildEdf(r, secs) {
  // same layout as Sleepwell H3rec: EEG1-4 @250 Hz uV, X/Y/Z @50 Hz mG; 1-s records
  const sig = [
    ...['EEG1', 'EEG2', 'EEG3', 'EEG4'].map((l, i) => ({ label: l, dim: 'uV', pmin: -25207.6, pmax: 25208.3, dmin: -32768, dmax: 32767, ns: RATE, data: r.ch[i] })),
    ...['X', 'Y', 'Z'].map((l, i) => ({ label: l, dim: 'mG', pmin: -4000, pmax: 4000, dmin: -32768, dmax: 32767, ns: 50, data: r.acc[i] })),
  ];
  const ns = sig.length, hdrLen = 256 + ns * 256;
  const f = (s, w) => String(s).slice(0, w).padEnd(w, ' ');
  const d = r.t0;
  let hdr = f('0', 8) + f(`X ${device?.name || 'H3'}`, 80) + f('Startdate X', 80)
    + f(`${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${pad(d.getFullYear() % 100)}`, 8)
    + f(`${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`, 8)
    + f(hdrLen, 8) + f('', 44) + f(secs, 8) + f('1', 8) + f(ns, 4);
  const field = (fn, w) => sig.map(s => f(fn(s), w)).join('');
  hdr += field(s => s.label, 16) + field(() => 'H3', 80) + field(s => s.dim, 8)
    + field(s => s.pmin, 8) + field(s => s.pmax, 8) + field(s => s.dmin, 8) + field(s => s.dmax, 8)
    + field(() => '', 80) + field(s => s.ns, 8) + field(() => '', 32);
  const recBytes = sig.reduce((a, s) => a + s.ns * 2, 0);
  const buf = new ArrayBuffer(hdrLen + secs * recBytes); const u8 = new Uint8Array(buf); const dv = new DataView(buf);
  for (let i = 0; i < hdrLen; i++) u8[i] = hdr.charCodeAt(i);
  let off = hdrLen;
  for (let t = 0; t < secs; t++) for (const s of sig) for (let k = 0; k < s.ns; k++) {
    const v = s.data[t * s.ns + k]; dv.setInt16(off, v == null ? 0 : Math.max(-32768, Math.min(32767, v)), true); off += 2;
  }
  return new Blob([buf], { type: 'application/octet-stream' });
}

// ---------- brain-health report (same engine as 2chREC / H3腦健康報告) ----------
let lastReportHtml = '', lastReportName = '';
$('btnReport').onclick = () => { try { $('rpName').value = localStorage.getItem('h3live.rpName') || ''; } catch {} $('reportDlg').showModal(); };
$('rpCancel').onclick = () => $('reportDlg').close();
$('rpOk').onclick = () => {
  $('reportDlg').close();
  if (!lastRec) return;
  try {
    const n = lastRec.ch[0].length;
    const toUv = (arr) => { const f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = arr[i] * UV_PER_LSB; return f; };
    const name = $('rpName').value.trim();
    try { localStorage.setItem('h3live.rpName', name); } catch {}
    const r = buildReport({ name, age: $('rpAge').value.trim(), sex: $('rpSex').value, start: lastRec.t0, sampleRate: RATE,
      fp1: toUv(lastRec.ch[0]), fp2: toUv(lastRec.ch[1]), physMin: -25207.6, physMax: 25208.3, source: `H3 Live ${device?.name || ''}` });
    lastReportHtml = r.html; lastReportName = `腦健康報告_${r.name}_${r.no}.html`;
    const fw = Math.max(200, innerWidth - 20); // A4 page is 210mm ≈ 794px + 16px margins
    const zoom = Math.min(1, fw / 826);
    $('reportFrame').srcdoc = r.html.replace('#toolbar { display: flex; }', '#toolbar { display: none; }')
      .replace('</head>', `<style>@media screen { .page { zoom: ${zoom.toFixed(3)}; margin: 8px auto; } body { margin: 0; } }</style></head>`);
    $('reportOverlay').classList.add('show');
    if (r.res.contact && !r.res.contact.ok) log('報告：未偵測到電極訊號，分數無效（請確認電極貼合後重錄）', 'err');
    else log(`報告完成：${r.no} 總分 ${r.res.scores.overall}`, 'ok');
  } catch (e) { log(`產生報告失敗：${e.message}`, 'err'); console.error(e); }
};
$('rpClose').onclick = () => $('reportOverlay').classList.remove('show');
$('rpPrint').onclick = () => { const w = $('reportFrame').contentWindow; w?.focus(); w?.print(); };
$('rpSave').onclick = () => {
  saveFile(lastReportName, new Blob([lastReportHtml], { type: 'text/html' })).then((m) => log(m, 'ok')).catch((e) => log(`存檔失敗：${e.message}`, 'err'));
};
if (isNative) { $('rpPrint').style.display = 'none'; $('rpSave').textContent = '儲存／分享報告'; }

// ---------- wiring ----------
$('btnConnect').onclick = () => connect(false);
$('btnConnectAll').onclick = () => connect(true);
$('btnDisconnect').onclick = disconnect;
$('btnRec').onclick = () => (recording ? stopRecording() : startRecording());
$('btnClear').onclick = () => (logEl.innerHTML = '');
setButtons(); setInterval(updateStats, 500); requestAnimationFrame(draw);
if (!isNative && /SamsungBrowser/i.test(navigator.userAgent)) {
  $('browserWarn').style.display = 'block';
  $('openChrome').href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
  log('偵測到三星瀏覽器：Web Bluetooth 無法掃描，請用 Chrome 開啟', 'err');
}
if (isNative) {
  log('H3 Live app 就緒。開啟 H3 電源後按「連線 H3」，第一次會詢問藍牙／附近裝置權限，請允許。');
  createBle().then((b) => { ble = b; return b.available(); }).then((ok) => log(ok ? '藍牙已開啟' : '藍牙未開啟：請先開啟手機藍牙', ok ? 'ok' : 'err')).catch((e) => log(`藍牙初始化失敗：${e.message}`, 'err'));
} else if (!navigator.bluetooth) { setStatus('此瀏覽器不支援 Web Bluetooth', 'err'); log('需要 Android Chrome（或 Mac/Windows 的 Chrome、Edge）。iPhone Safari 不支援。', 'err'); }
else {
  log('就緒。開啟 H3 電源後按「連線」，在清單中選 xb5… 裝置。');
  navigator.bluetooth.getAvailability?.().then(ok => log(ok ? '藍牙介面可用' : '藍牙介面不可用：請確認手機藍牙已開啟', ok ? 'ok' : 'err')).catch(() => {});
  log(`瀏覽器：${navigator.userAgent.replace(/^.*?\) /, '').slice(0, 80)}`);
}
if (!isNative && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// ---------- simulation (?sim): replay a captured H3 stream without hardware ----------
let simStarted = false;
async function startSim() {
  if (simStarted) return; simStarted = true;
    const buf = new Uint8Array(await (await fetch('./test/h3_stream_sample.bin')).arrayBuffer());
    log('模擬模式：重播實機側錄樣本（無硬體）', 'warn');
    setStatus('模擬串流', 'wait'); startedAt = performance.now(); lastDataAt = startedAt;
    simMode = true; device = { name: 'xb51-sim' }; setButtons(); $('btnConnect').disabled = true;
    let pos = 0, seq = 0;
    // 14 payload bytes per notification, ~ (30 samples / 250 Hz) per block ≈ 120 ms per 230 B → ~7 ms per notification
    setInterval(() => {
      for (let k = 0; k < 2; k++) {
        const chunk = buf.subarray(pos, pos + 14); pos += 14;
        if (pos >= buf.length) { pos = 0; parser.resync(); }
        const pkt = new Uint8Array(6 + chunk.length); pkt[2] = seq++ & 0xff; pkt.set(chunk, 6);
        onNotify(pkt);
      }
    }, 14);
}
if (new URLSearchParams(location.search).has('sim')) startSim();
{ let taps = 0, lastTap = 0; document.querySelector('header h1').addEventListener('click', () => { const t = Date.now(); taps = t - lastTap < 600 ? taps + 1 : 1; lastTap = t; if (taps >= 5 && !ble?.isConnected()) startSim(); }); }
