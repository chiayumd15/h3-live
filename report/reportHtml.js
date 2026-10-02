import { H3 } from "./h3core.js";
const REPORT_CSS = `
  :root {
    --navy: #1b3f7a; --blue: #2457a8; --teal: #2f9e9a; --teal-d: #23807c; --orange: #e8912a; --green: #3b8a4e; --purple: #7b56b8;
    --ink: #1f2937; --sub: #4b5563; --muted: #8a94a6; --line: #dfe6f0; --bg: #f2f6fb; --card: #ffffff;
    --font: "Microsoft JhengHei", "\u5FAE\u8EDF\u6B63\u9ED1\u9AD4", "PingFang TC", "Noto Sans TC", "Heiti TC", "Segoe UI", system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font); }
  button { font-family: var(--font); }

  /* \u2500\u2500\u2500\u2500\u2500 \u8F38\u5165\u9801 */
  #form { max-width: 560px; margin: 48px auto; background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 32px 36px; box-shadow: 0 10px 30px rgba(27,63,122,.08); }
  #form h1 { margin: 0 0 4px; font-size: 26px; color: var(--navy); letter-spacing: 1px; display: flex; align-items: center; gap: 10px; }
  #form .sub { color: var(--muted); font-size: 13px; margin-bottom: 22px; }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 13px; color: var(--sub); margin-bottom: 6px; font-weight: 600; }
  .field input[type=text], .field input[type=number], .field select { width: 100%; padding: 10px 12px; border: 1px solid #c9d3e2; border-radius: 10px; font-size: 16px; font-family: var(--font); background: #fbfcfe; }
  .row { display: flex; gap: 12px; } .row .field { flex: 1; }
  .drop { border: 2px dashed #b9c8de; border-radius: 12px; padding: 18px; text-align: center; color: var(--sub); cursor: pointer; background: #f8fafd; transition: .15s; }
  .drop:hover, .drop.on { border-color: var(--blue); background: #eef4fd; }
  .drop b { color: var(--blue); }
  .drop .fname { margin-top: 8px; font-size: 13px; color: var(--ink); word-break: break-all; }
  #file { display: none; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 22px; border-radius: 12px; border: 0; font-size: 16px; font-weight: 700; cursor: pointer; }
  .btn.primary { background: linear-gradient(135deg, var(--blue), var(--teal)); color: #fff; width: 100%; box-shadow: 0 6px 16px rgba(36,87,168,.25); }
  .btn.primary:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
  .btn.ghost { background: #fff; border: 1px solid #c9d3e2; color: var(--navy); }
  #status { margin-top: 14px; font-size: 13px; color: var(--sub); min-height: 18px; }
  #status.err { color: #c0392b; }
  .hint { font-size: 12px; color: var(--muted); margin-top: 18px; line-height: 1.7; }
  #history { margin-top: 20px; font-size: 13px; color: var(--sub); }
  #history table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  #history td, #history th { padding: 5px 6px; border-bottom: 1px solid var(--line); text-align: left; font-weight: normal; }
  #history th { color: var(--muted); font-size: 12px; }

  /* \u2500\u2500\u2500\u2500\u2500 \u5831\u544A\u5DE5\u5177\u5217 */
  #toolbar { position: sticky; top: 0; z-index: 5; display: flex; gap: 10px; justify-content: center; padding: 12px; background: rgba(242,246,251,.92); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); }

  /* \u2500\u2500\u2500\u2500\u2500 \u5831\u544A\u9801\u9762\uFF08A4\uFF09 */
  .page { width: 210mm; min-height: 297mm; margin: 16px auto; background: #fff; padding: 11mm 11mm 9mm; position: relative; box-shadow: 0 8px 28px rgba(27,63,122,.12); overflow: hidden; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .deco { position: absolute; right: -40px; top: -60px; width: 300px; height: 300px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(47,158,154,.18), rgba(36,87,168,.06) 55%, transparent 70%); pointer-events: none; }
  .deco2 { position: absolute; right: 18px; top: 22px; width: 120px; height: 90px; background-image: radial-gradient(rgba(36,87,168,.25) 1.2px, transparent 1.3px); background-size: 9px 9px; opacity: .6; pointer-events: none; }
  header.rep { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; position: relative; }
  header.rep .logo { width: 72px; height: 72px; flex: none; }
  header.rep h1 { margin: 0; font-size: 34px; letter-spacing: 3px; color: var(--navy); font-weight: 800; }
  header.rep .sub { color: var(--sub); font-size: 13px; letter-spacing: 2px; margin-top: 3px; }
  .info { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 9px 14px; font-size: 12.5px; color: var(--sub); box-shadow: 0 2px 8px rgba(27,63,122,.05); }
  .info span { display: inline-flex; align-items: center; gap: 5px; }
  .info b { color: var(--ink); font-weight: 600; }
  .info i.sep { width: 1px; height: 16px; background: var(--line); }
  .info svg { width: 14px; height: 14px; color: var(--blue); }

  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 3px 10px rgba(27,63,122,.05); }
  .hero { display: flex; align-items: center; gap: 18px; padding: 14px 20px; margin-top: 10px; background: linear-gradient(135deg, #f4f9ff, #f7fcfb); }
  .hero .gauge { flex: none; }
  .hero .vline { width: 1px; align-self: stretch; background: var(--line); }
  .hero .verdict { flex: 1; }
  .hero .verdict .lbl { font-size: 15px; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
  .pill-big { display: inline-flex; align-items: center; gap: 10px; padding: 8px 22px 8px 12px; border-radius: 14px; color: #fff; font-size: 26px; font-weight: 800; letter-spacing: 2px; }
  .pill-big svg { width: 30px; height: 30px; }
  .hero .note { font-size: 12.5px; color: var(--sub); line-height: 1.75; margin-top: 10px; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
  .dim { display: flex; align-items: center; gap: 14px; padding: 12px 16px; }
  .dim .ico { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none; }
  .dim .ico svg { width: 36px; height: 36px; }
  .dim .name { font-size: 15px; font-weight: 700; color: var(--ink); }
  .dim .val { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
  .dim .num { font-size: 32px; font-weight: 800; line-height: 1.1; }
  .dim .bar { width: 1px; height: 22px; background: var(--line); }
  .pill { display: inline-block; padding: 3px 12px; border-radius: 8px; color: #fff; font-size: 13px; font-weight: 700; letter-spacing: 1px; }

  .sec-title { display: flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .sec-title svg { width: 18px; height: 18px; color: var(--blue); }
  .chart-card { padding: 10px 12px 6px; }
  .foot-note { font-size: 10.5px; color: var(--muted); text-align: center; margin-top: 2px; }
  .trend-note { margin-top: 6px; background: #eef4fd; border-radius: 9px; padding: 7px 10px; font-size: 12px; color: var(--navy); display: flex; align-items: center; gap: 8px; }
  .trend-note svg { width: 16px; height: 16px; flex: none; }

  .advice { display: flex; align-items: center; gap: 16px; padding: 10px 18px; margin-top: 10px; background: linear-gradient(135deg, #f4f9ff, #f6fbfa); }
  .advice .head { display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 800; color: var(--ink); padding-right: 16px; border-right: 1px solid var(--line); }
  .advice .head svg { width: 44px; height: 44px; }
  .advice ol { list-style: none; margin: 0; padding: 0; flex: 1; }
  .advice li { display: flex; align-items: center; gap: 9px; font-size: 13.5px; color: var(--ink); margin: 5px 0; }
  .advice li i { width: 22px; height: 22px; border-radius: 50%; background: var(--teal); color: #fff; font-style: normal; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .advice .art { width: 96px; height: 78px; flex: none; }
  .disclaimer { display: flex; align-items: center; gap: 12px; margin-top: 10px; font-size: 10px; color: var(--sub); line-height: 1.7; padding: 0 6px; white-space: nowrap; }
  .disclaimer svg { width: 28px; height: 28px; flex: none; color: var(--navy); }
  .quality-warn { margin-top: 8px; background: #fff4e5; border: 1px solid #f6d9ae; color: #8a5200; border-radius: 10px; padding: 7px 12px; font-size: 12px; }

  /* \u7B2C\u4E8C\u9801 */
  .p2 h2 { margin: 0 0 2px; font-size: 20px; color: var(--navy); letter-spacing: 2px; }
  .p2 .p2sub { color: var(--muted); font-size: 12px; margin-bottom: 10px; }
  .p2 table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .p2 th, .p2 td { padding: 2.5px 6px; border-bottom: 1px solid var(--line); text-align: left; }
  .p2 th { color: var(--sub); font-weight: 600; background: #f6f9fd; }
  .p2 td.num, .p2 th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .p2 .kv { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 12px; font-size: 12px; }
  .p2 .kv div { background: #f6f9fd; border-radius: 8px; padding: 4px 9px; }
  .p2 .kv small { display: block; color: var(--muted); font-size: 10.5px; }
  .p2 .kv b { font-size: 13px; color: var(--navy); }
  .p2 .explain { font-size: 10px; color: var(--sub); line-height: 1.6; }
  .legend { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--sub); margin-right: 10px; }
  .legend i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }

  @media print {
    @page { size: A4; margin: 0; }
    html, body { background: #fff; }
    #toolbar, #form { display: none !important; }
    .page { margin: 0; box-shadow: none; width: 210mm; height: 297mm; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
`;
const REPORT_ICONS = `<svg width="0" height="0" style="position:absolute">
  <defs>
    <symbol id="ico-brain" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M27 10c-5 0-8 3-8 7-4 0-7 3-7 7 0 2 1 4 2 5-2 1-3 3-3 6 0 4 3 7 7 7 0 4 3 7 7 7h2V10h0z"/>
      <path d="M37 10c5 0 8 3 8 7 4 0 7 3 7 7 0 2-1 4-2 5 2 1 3 3 3 6 0 4-3 7-7 7 0 4-3 7-7 7h-2V10h0z"/>
      <path d="M32 10v39"/><path d="M19 17c3 0 5 1 6 3M45 17c-3 0-5 1-6 3M14 29c3 0 5 1 6 3M50 29c-3 0-5 1-6 3M18 42c2 0 4 1 5 2M46 42c-2 0-4 1-5 2"/>
      <path d="M8 54h12l3-6 4 10 4-8 3 4h22" stroke-width="2.6"/>
    </symbol>
    <symbol id="ico-user" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7z"/></symbol>
    <symbol id="ico-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></symbol>
    <symbol id="ico-doc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6M9 13h7M9 17h7"/></symbol>
    <symbol id="ico-age" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></symbol>
    <symbol id="ico-sex" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="14" r="5"/><path d="M14 10l6-6M15 4h5v5"/></symbol>
    <symbol id="ico-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></symbol>
    <symbol id="ico-moon" viewBox="0 0 64 64" fill="none" stroke="#2457a8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M40 10a22 22 0 1 0 14 38A19 19 0 0 1 40 10z" fill="#c7d9f5"/><path d="M47 16l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5zM52 32l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#2457a8" stroke="none"/></symbol>
    <symbol id="ico-brain2" viewBox="0 0 64 64" fill="none" stroke="#e8912a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M29 12c-6 0-9 3-9 7-4 0-7 3-7 7 0 2 1 4 2 5-2 1-3 3-3 6 0 4 3 7 7 7 0 4 3 7 7 7h3V12z" fill="#fde6c8"/><path d="M35 12c6 0 9 3 9 7 4 0 7 3 7 7 0 2-1 4-2 5 2 1 3 3 3 6 0 4-3 7-7 7 0 4-3 7-7 7h-3V12z" fill="#fde6c8"/><path d="M32 12v39M21 19c3 0 5 1 6 3M43 19c-3 0-5 1-6 3M15 31c3 0 5 1 6 3M49 31c-3 0-5 1-6 3"/></symbol>
    <symbol id="ico-target" viewBox="0 0 64 64" fill="none" stroke="#3b8a4e" stroke-width="3" stroke-linecap="round"><circle cx="32" cy="32" r="20" fill="#d9eedd"/><circle cx="32" cy="32" r="12" fill="#fff"/><circle cx="32" cy="32" r="4" fill="#3b8a4e"/><path d="M32 6v10M32 48v10M6 32h10M48 32h10"/></symbol>
    <symbol id="ico-wave" viewBox="0 0 64 64" fill="none" stroke="#7b56b8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="34" width="8" height="18" rx="2" fill="#e5dcf5"/><rect x="24" y="26" width="8" height="26" rx="2" fill="#e5dcf5"/><rect x="38" y="30" width="8" height="22" rx="2" fill="#e5dcf5"/><path d="M8 24c6 0 6-8 12-8s6 8 12 8 6-10 12-10 6 8 12 8"/></symbol>
    <symbol id="ico-radar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 5v8l-8 5-8-5V8z"/><path d="M12 8l4 2.5v4L12 17l-4-2.5v-4z" fill="currentColor" opacity=".25"/></symbol>
    <symbol id="ico-trend" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M4 15l5-5 4 3 7-7"/><path d="M16 6h4v4"/></symbol>
    <symbol id="ico-clip" viewBox="0 0 64 64" fill="none" stroke="#2457a8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="12" width="36" height="44" rx="4" fill="#e7f0fc"/><rect x="24" y="8" width="16" height="8" rx="2" fill="#fff"/><path d="M22 28l4 4 6-7M22 42l4 4 6-7M36 30h8M36 44h8"/></symbol>
    <symbol id="ico-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z"/><rect x="9" y="10" width="6" height="5" rx="1"/><path d="M10 10V8.5a2 2 0 0 1 4 0V10"/></symbol>
    <symbol id="ico-lotus" viewBox="0 0 120 96" fill="none" stroke="#2f9e9a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="60" cy="20" r="10" fill="#d5efee"/>
      <path d="M50 33h20c6 0 9 4 10 10l3 20H37l3-20c1-6 4-10 10-10z" fill="#d5efee"/>
      <path d="M46 40c-8 6-12 14-10 24M74 40c8 6 12 14 10 24"/>
      <path d="M24 72c0-10 16-14 36-14s36 4 36 14c0 8-16 12-36 12S24 80 24 72z" fill="#e7f5f4"/>
      <path d="M36 64c8-4 16 0 24 8 8-8 16-12 24-8"/>
      <circle cx="36" cy="66" r="3.2" fill="#d5efee"/><circle cx="84" cy="66" r="3.2" fill="#d5efee"/>
      <path d="M14 60c-5-7-3-16 4-19 4 7 2 15-4 19zM106 60c5-7 3-16-4-19-4 7-2 15 4 19z" fill="#cfe9e7"/>
      <path d="M96 14a6 6 0 0 1 8 6c0 6-8 10-8 10s-8-4-8-10a6 6 0 0 1 8-6z" fill="#fde6c8" stroke="#e8912a"/>
    </symbol>
  </defs>
</svg>`;
const DIMS = [
  { key: "sleep", name: "\u7761\u7720\u6062\u5FA9\u72C0\u614B", short: "\u7761\u7720\u6062\u5FA9", color: "#2457a8", icoBg: "#e3ecfa", ico: "ico-moon" },
  { key: "stress", name: "\u58D3\u529B\u8207\u795E\u7D93\u5E73\u8861", short: "\u58D3\u529B\u8207\n\u795E\u7D93\u5E73\u8861", color: "#e8912a", icoBg: "#fdeedb", ico: "ico-brain2" },
  { key: "focus", name: "\u5C08\u6CE8\u8207\u8B66\u89BA\u72C0\u614B", short: "\u5C08\u6CE8\u8207\n\u8B66\u89BA\u72C0\u614B", color: "#3b8a4e", icoBg: "#e1f0e4", ico: "ico-target" },
  { key: "rhythm", name: "\u8166\u6CE2\u7BC0\u5F8B\u8207\u5C0D\u7A31", short: "\u8166\u6CE2\u7BC0\u5F8B\u8207\u5C0D\u7A31", color: "#7b56b8", icoBg: "#ece5f8", ico: "ico-wave" }
];
function pad(n) {
  return String(n).padStart(2, "0");
}
const fmtDate = (d) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
const fmtYM = (d) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}`;
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
const HKEY = "h3live.reportHistory.v1";
function loadHist() {
  try {
    return JSON.parse(localStorage.getItem(HKEY) || "{}");
  } catch (e) {
    return {};
  }
}
function saveHist(h) {
  try {
    localStorage.setItem(HKEY, JSON.stringify(h));
  } catch (e) {
  }
}
function nextReportNo(h, start) {
  const day = `${start.getFullYear()}-${pad(start.getMonth() + 1)}${pad(start.getDate())}`;
  let n = 0;
  for (const name in h) for (const r of h[name]) if ((r.no || "").startsWith("H3L-" + day)) n++;
  return `H3L-${day}-${pad(n + 1)}`;
}
function statusOf(s) {
  if (s >= 80) return { text: "\u7A69\u5B9A", color: "#2457a8" };
  if (s >= 65) return { text: "\u7559\u610F", color: "#e8912a" };
  if (s >= 50) return { text: "\u5EFA\u8B70\u8FFD\u8E64", color: "#7b56b8" };
  return { text: "\u5EFA\u8B70\u8A55\u4F30", color: "#c0392b" };
}
function verdictOf(s, lowQ) {
  if (lowQ) return { text: "\u8A0A\u865F\u54C1\u8CEA\u4E0D\u8DB3", color: "#8a94a6", note: "\u672C\u6B21\u53EF\u7528\u8A0A\u865F\u4E0D\u8DB3\uFF0C\u5206\u6578\u50C5\u4F9B\u53C3\u8003\u3002\u5EFA\u8B70\u78BA\u8A8D\u96FB\u6975\u8CBC\u5408\u3001\u4FDD\u6301\u975C\u6B62\u4E26\u91CD\u65B0\u9304\u88FD 3 \u5206\u9418\u3002" };
  if (s >= 80) return { text: "\u8868\u73FE\u826F\u597D", color: "#2f9e9a", note: "\u672C\u6B21\u5404\u9805\u6307\u6A19\u5927\u81F4\u7A69\u5B9A\uFF0C\u5EFA\u8B70\u7DAD\u6301\u76EE\u524D\u751F\u6D3B\u578B\u614B\u4E26\u5B9A\u671F\u8FFD\u8E64\u3002" };
  if (s >= 65) return { text: "\u5EFA\u8B70\u6301\u7E8C\u8FFD\u8E64", color: "#3fa7a0", note: "\u672C\u6B21\u6574\u9AD4\u5C1A\u53EF\uFF0C\u90E8\u5206\u6307\u6A19\u6709\u6539\u5584\u7A7A\u9593\uFF0C\u5EFA\u8B70\u6301\u7E8C\u8FFD\u8E64\u3002" };
  if (s >= 50) return { text: "\u90E8\u5206\u6307\u6A19\u504F\u4F4E", color: "#e8912a", note: "\u672C\u6B21\u90E8\u5206\u6307\u6A19\u504F\u4F4E\uFF0C\u5EFA\u8B70\u7559\u610F\u4F5C\u606F\u8207\u58D3\u529B\u7BA1\u7406\uFF0C\u4E26\u65BC 1 \u500B\u6708\u5167\u518D\u6E2C\u3002" };
  return { text: "\u5EFA\u8B70\u9032\u4E00\u6B65\u8A55\u4F30", color: "#c0392b", note: "\u672C\u6B21\u591A\u9805\u6307\u6A19\u504F\u4F4E\uFF0C\u82E5\u9023\u7E8C\u8FFD\u8E64\u4ECD\u504F\u4F4E\uFF0C\u5EFA\u8B70\u8207\u91AB\u5E2B\u9032\u4E00\u6B65\u8A0E\u8AD6\u3002" };
}
function advices(r, prev) {
  const S = r.scores, B = r.bands, R = r.ratios, out = [];
  const add = (cond, w, t) => {
    if (cond) out.push({ w, t });
  };
  add(S.sleep < 65, 100 - S.sleep, "\u6162\u6CE2\u504F\u591A\uFF1A\u56FA\u5B9A\u4F5C\u606F\uFF0C\u78BA\u8A8D\u7761\u7720\u662F\u5426\u5145\u8DB3");
  add(S.stress < 65, 95 - S.stress, "\u5FEB\u6CE2\u6BD4\u4F8B\u504F\u9AD8\uFF1A\u6BCF\u5929 10 \u5206\u9418\u8179\u5F0F\u547C\u5438\u6216\u6F38\u9032\u5F0F\u653E\u9B06");
  add(R.bar > 2 && r.parts.gamma < 70, 70, "\u9AD8\u983B\u504F\u591A\uFF1A\u9304\u88FD\u6642\u653E\u9B06\u4E0B\u5DF4\u8207\u984D\u982D\uFF0C\u907F\u514D\u54AC\u7259");
  add(S.focus < 65, 90 - S.focus, "theta/beta \u6BD4\u504F\u9AD8\uFF1A\u898F\u5F8B\u904B\u52D5\u8207\u5145\u8DB3\u7761\u7720");
  add(S.rhythm < 65, 85 - S.rhythm, "alpha \u7BC0\u5F8B\u4E0D\u660E\u986F\uFF1A\u9589\u773C\u975C\u5750 3\u20135 \u5206\u9418\u5F8C\u518D\u9304\u4E00\u6B21");
  add(R.asym !== null && Math.abs(R.asym) > 0.5, 60, "\u5DE6\u53F3 alpha \u5DEE\u7570\u8F03\u5927\uFF1A\u78BA\u8A8D\u5169\u5074\u96FB\u6975\u8CBC\u5408\uFF0C\u4E0B\u6B21\u518D\u6BD4\u8F03");
  add(r.motion && r.motion.stillFrac < 0.7, 65, "\u9304\u88FD\u671F\u9593\u9AD4\u52D5\u504F\u591A\uFF1A\u5750\u7A69\u3001\u9589\u773C\u3001\u653E\u9B06\u96D9\u80A9\u518D\u9304\u4E00\u6B21");
  add(prev.length && S.overall < prev[prev.length - 1].overall - 8, 75, "\u7E3D\u5206\u8F03\u4E0A\u6B21\u4E0B\u964D\uFF1A\u7559\u610F\u8FD1\u671F\u7761\u7720\u3001\u58D3\u529B\u8207\u8EAB\u9AD4\u72C0\u6CC1");
  add(true, 10, "\u7DAD\u6301\u898F\u5F8B\u7761\u7720\u8207\u56FA\u5B9A\u4F5C\u606F");
  add(true, 9, "\u6BCF\u9031\u5B89\u6392\u653E\u9B06\u6E1B\u58D3\u8207\u904B\u52D5");
  add(true, 8, S.overall >= 65 ? "\u5EFA\u8B70 1\u20133 \u500B\u6708\u5F8C\u518D\u6B21\u8FFD\u8E64" : "\u5EFA\u8B70 2\u20134 \u9031\u5F8C\u518D\u6B21\u8FFD\u8E64");
  out.sort((a, b) => b.w - a.w);
  const seen = /* @__PURE__ */ new Set();
  return out.filter((o) => !seen.has(o.t) && seen.add(o.t)).slice(0, 3).map((o) => o.t);
}
function gauge(score, color) {
  const r = 78, c = 2 * Math.PI * r, f = score / 100;
  return `<svg width="196" height="196" viewBox="0 0 196 196">
    <circle cx="98" cy="98" r="${r}" fill="none" stroke="#e6ebf3" stroke-width="18"/>
    <circle cx="98" cy="98" r="${r}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 98 98)"/>
    <text x="98" y="72" text-anchor="middle" font-size="15" fill="#374151" font-weight="700">\u8166\u5065\u5EB7\u7E3D\u5206</text>
    <text x="98" y="122" text-anchor="middle" font-size="54" fill="#1f2937" font-weight="800">${score}</text>
    <text x="98" y="146" text-anchor="middle" font-size="14" fill="#8a94a6">/100</text></svg>`;
}
function radar(scores) {
  const W = 300, H = 220, cx = 150, cy = 112, R = 74;
  const axes = [DIMS[0], DIMS[2], DIMS[3], DIMS[1]];
  const pt = (i, v) => {
    const a = -Math.PI / 2 + i * Math.PI / 2;
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
  };
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  for (const g of [0.25, 0.5, 0.75, 1]) s += `<polygon points="${[0, 1, 2, 3].map((i) => pt(i, g).join(",")).join(" ")}" fill="none" stroke="#d6deea" stroke-width="1" stroke-dasharray="${g === 1 ? "0" : "3 3"}"/>`;
  for (let i = 0; i < 4; i++) {
    const [x, y] = pt(i, 1);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#d6deea"/>`;
  }
  for (const g of [25, 50, 75, 100]) s += `<text x="${cx + 3}" y="${cy - R * g / 100 + 3}" font-size="8" fill="#9aa5b8">${g}</text>`;
  s += `<text x="${cx + 3}" y="${cy + 3}" font-size="8" fill="#9aa5b8">0</text>`;
  const poly = axes.map((d, i) => pt(i, scores[d.key] / 100));
  s += `<polygon points="${poly.map((p) => p.join(",")).join(" ")}" fill="rgba(36,87,168,.18)" stroke="#2457a8" stroke-width="2.2"/>`;
  poly.forEach((p) => {
    s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#2457a8"/>`;
  });
  const lab = [[cx, 14, "middle", 0, 30], [W - 4, cy - 6, "end", 0, 12], [cx, H - 22, "middle", 0, 14], [4, cy - 6, "start", 0, 12]];
  axes.forEach((d, i) => {
    const [x, y, anc] = lab[i];
    const lines = d.short.split("\n");
    const v = scores[d.key];
    if (i === 0) s += `<text x="${x}" y="${y}" text-anchor="${anc}" font-size="11" fill="#374151">${lines.join("")}</text><text x="${x}" y="${y + 16}" text-anchor="${anc}" font-size="15" font-weight="800" fill="${d.color}">${v}</text>`;
    else if (i === 2) s += `<text x="${x}" y="${y}" text-anchor="${anc}" font-size="15" font-weight="800" fill="${d.color}">${v}</text><text x="${x}" y="${y + 15}" text-anchor="${anc}" font-size="11" fill="#374151">${lines.join("")}</text>`;
    else {
      lines.forEach((l, k) => {
        s += `<text x="${x}" y="${y - (lines.length - 1) * 13 + k * 13}" text-anchor="${anc}" font-size="11" fill="#374151">${l}</text>`;
      });
      s += `<text x="${x}" y="${y + 17}" text-anchor="${anc}" font-size="15" font-weight="800" fill="${d.color}">${v}</text>`;
    }
  });
  return s + "</svg>";
}
function trendChart(points) {
  const W = 300, H = 200, L = 40, Rr = 16, T = 22, Bm = 34, pw = W - L - Rr, ph = H - T - Bm;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><text x="${L}" y="12" font-size="10" fill="#6b7280">\u7E3D\u5206\uFF08\u5206\uFF09</text>`;
  for (const g of [0, 25, 50, 75, 100]) {
    const y = T + ph - ph * g / 100;
    s += `<line x1="${L}" y1="${y}" x2="${W - Rr}" y2="${y}" stroke="#e6ebf3"/><text x="${L - 6}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="#6b7280">${g}</text>`;
  }
  s += `<line x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}" stroke="#9aa5b8"/><line x1="${L}" y1="${T + ph}" x2="${W - Rr}" y2="${T + ph}" stroke="#9aa5b8"/>`;
  const n = points.length, xs = points.map((p, i) => n === 1 ? L + pw / 2 : L + pw * (0.12 + 0.76 * i / (n - 1)));
  const ys = points.map((p) => T + ph - ph * p.v / 100);
  if (n > 1) s += `<polyline points="${xs.map((x, i) => `${x},${ys[i]}`).join(" ")}" fill="none" stroke="#2457a8" stroke-width="2.4"/>`;
  points.forEach((p, i) => {
    s += `<circle cx="${xs[i]}" cy="${ys[i]}" r="4.5" fill="#2457a8"/><text x="${xs[i]}" y="${ys[i] - 9}" text-anchor="middle" font-size="12" font-weight="700" fill="#2457a8">${p.v}</text><text x="${xs[i]}" y="${T + ph + 15}" text-anchor="middle" font-size="10" fill="#4b5563">${p.label}</text>`;
  });
  return s + "</svg>";
}
function trendText(points) {
  if (points.length < 2) return "\u9996\u6B21\u6AA2\u6E2C\uFF0C\u5EFA\u8B70 1\u20133 \u500B\u6708\u5F8C\u518D\u6E2C\uFF0C\u5EFA\u7ACB\u500B\u4EBA\u8DA8\u52E2\u3002";
  const d = points[points.length - 1].v - points[0].v;
  if (d >= 5) return "\u6574\u9AD4\u8DA8\u52E2\u7A69\u5B9A\u4E0A\u5347\uFF0C\u5EFA\u8B70\u6301\u7E8C\u8FFD\u8E64\u3002";
  if (d <= -5) return "\u6574\u9AD4\u8DA8\u52E2\u4E0B\u964D\uFF0C\u5EFA\u8B70\u7559\u610F\u8FD1\u671F\u4F5C\u606F\u4E26\u6301\u7E8C\u8FFD\u8E64\u3002";
  return "\u6574\u9AD4\u8DA8\u52E2\u5927\u81F4\u6301\u5E73\uFF0C\u5EFA\u8B70\u6301\u7E8C\u8FFD\u8E64\u3002";
}
function renderReport(c) {
  const r = c.res, S = r.scores, v = verdictOf(S.overall, r.lowQuality);
  const start = new Date(r.start), points = [...c.prev.map((p) => ({ v: p.overall, label: fmtYM(new Date(p.ts)) })), { v: S.overall, label: fmtYM(start) }];
  const adv = advices(r, c.prev);
  const icon = (id) => `<svg><use href="#${id}"/></svg>`;
  const dimCard = (d) => {
    const st = statusOf(S[d.key]);
    return `<div class="card dim"><div class="ico" style="background:${d.icoBg}"><svg><use href="#${d.ico}"/></svg></div><div><div class="name">${d.name}</div><div class="val"><span class="num" style="color:${d.color}">${S[d.key]}</span><span class="bar"></span><span class="pill" style="background:${st.color}">${st.text}</span></div></div></div>`;
  };
  const page1 = `
<div class="page">
<div class="deco"></div><div class="deco2"></div>
<header class="rep"><svg class="logo" viewBox="0 0 64 64" style="color:#2457a8"><use href="#ico-brain"/></svg>
  <div><h1>H3 \u8166\u5065\u5EB7\u5831\u544A</h1><div class="sub">H3 Live \u5373\u6642\u8A18\u9304\u30FB\u5FEB\u901F\u7BE9\u6AA2\u30FB\u6301\u7E8C\u8FFD\u8E64</div></div></header>
<div class="info">
  <span>${icon("ico-user")}\u53D7\u6AA2\u8005\uFF1A<b>${esc(c.name)}</b></span><i class="sep"></i>
  <span>${icon("ico-cal")}\u6AA2\u6E2C\u65E5\u671F\uFF1A<b>${fmtDate(start)}</b></span><i class="sep"></i>
  <span>${icon("ico-doc")}\u5831\u544A\u7DE8\u865F\uFF1A<b>${c.rec.no}</b></span><i class="sep"></i>
  <span>${icon("ico-age")}\u5E74\u9F61\uFF1A<b>${c.age ? esc(c.age) : "\u2014"}</b></span><i class="sep"></i>
  <span>${icon("ico-sex")}\u6027\u5225\uFF1A<b>${c.sex || "\u2014"}</b></span>
</div>
<div class="card hero">
  <div class="gauge">${gauge(S.overall, r.lowQuality ? "#9aa5b8" : "#2f9e9a")}</div><div class="vline"></div>
  <div class="verdict"><div class="lbl">\u672C\u6B21\u7E3D\u8A55\uFF1A</div>
    <div class="pill-big" style="background:${v.color}"><svg><use href="#ico-shield"/></svg>${v.text}</div>
    <div class="note">${v.note}</div></div>
</div>
${r.lowQuality ? `<div class="quality-warn">\u26A0 \u53EF\u7528\u8A0A\u865F ${Math.round(r.usableSec)} \u79D2\uFF08${Math.round(r.usableFrac * 100)}%\uFF09\uFF0C\u4F4E\u65BC ${r.cfg.minUsableSec} \u79D2\u9580\u6ABB\uFF1B\u5206\u6578\u50C5\u4F9B\u53C3\u8003\u3002</div>` : ""}
<div class="grid2">${DIMS.map(dimCard).join("")}</div>
<div class="grid2">
  <div class="card chart-card"><div class="sec-title">${icon("ico-radar")}\u672C\u6B21\u8166\u5065\u5EB7\u8F2A\u5ED3</div>${radar(S)}<div class="foot-note">\u5206\u6578\u7BC4\u570D\uFF1A0\u2013100 \u5206\uFF08\u5206\u6578\u8D8A\u9AD8\u4EE3\u8868\u8868\u73FE\u8D8A\u4F73\uFF09</div></div>
  <div class="card chart-card"><div class="sec-title">${icon("ico-trend")}\u8FD1\u4E09\u6B21\u6AA2\u6E2C\u8DA8\u52E2</div>${trendChart(points)}<div class="trend-note">${icon("ico-trend")}${trendText(points)}</div></div>
</div>
<div class="card advice">
  <div class="head"><svg><use href="#ico-clip"/></svg>\u672C\u6B21\u5EFA\u8B70</div>
  <ol>${adv.map((t, i) => `<li><i>${i + 1}</i>${t}</li>`).join("")}</ol>
  <svg class="art" viewBox="0 0 120 96"><use href="#ico-lotus"/></svg>
</div>
<div class="disclaimer"><svg><use href="#ico-lock"/></svg><div>\u672C\u5831\u544A\u4F9D 3 \u5206\u9418\u975C\u606F\u614B\u524D\u984D\u8166\u6CE2\uFF08FP1\uFF0FFP2\uFF09\u8A08\u7B97\uFF0C\u4F9B\u8166\u5065\u5EB7\u7BA1\u7406\u8207\u6301\u7E8C\u8FFD\u8E64\u53C3\u8003\uFF1B\u5982\u6709\u4E0D\u9069\u6216\u9AD8\u98A8\u96AA\u60C5\u5F62\uFF0C\u8ACB\u81F3\u5C08\u79D1\u91AB\u7642\u9662\u6240\u9032\u4E00\u6B65\u8A55\u4F30\u3002</div></div>
</div>`;
  return page1;
}
function buildReport(inp) {
  const fs = inp.sampleRate;
  const n = Math.min(inp.fp1.length, inp.fp2.length);
  const mk = (label, data) => ({ label, unit: "uV", transducer: "H3", fs, pmin: inp.physMin, pmax: inp.physMax, data: data.subarray(0, n) });
  const edfLike = {
    start: inp.start,
    durationSec: n / fs,
    nRec: Math.floor(n / fs),
    recDur: 1,
    patient: "",
    recording: inp.source,
    signals: [mk("EEG1", inp.fp1), mk("EEG2", inp.fp2)]
  };
  const res = H3.analyze(edfLike);
  const name = inp.name.trim() || "\u672A\u547D\u540D";
  const h = loadHist();
  h[name] = h[name] || [];
  const ts = inp.start.getTime();
  let rec = h[name].find((r) => r.ts === ts);
  if (!rec) {
    rec = { ts, no: nextReportNo(h, inp.start), overall: res.scores.overall, scores: res.scores };
    h[name].push(rec);
    h[name].sort((a, b) => a.ts - b.ts);
    saveHist(h);
  }
  const prev = h[name].filter((r) => r.ts < ts).slice(-2);
  const ctx = { name, age: inp.age || "", sex: inp.sex || "", res, rec, prev };
  const body = renderReport(ctx);
  const title = `\u8166\u5065\u5EB7\u5831\u544A ${esc(name)} ${rec.no}`;
  const doc = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${REPORT_CSS}
  #toolbar { display: flex; }</style></head><body>
<div id="toolbar"><button class="btn primary" style="width:auto" onclick="(window.__tauriPrint||window.print)()">\u5217\u5370\uFF0F\u5B58\u6210 PDF</button><button class="btn ghost" onclick="(window.__tauriClose||window.close)()">\u95DC\u9589</button></div>
${REPORT_ICONS}
${body}
</body></html>`;
  return { html: doc, res, rec, no: rec.no, name };
}
export {
  REPORT_CSS,
  REPORT_ICONS,
  buildReport,
  loadHist
};
