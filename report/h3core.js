const H3 = (function() {
  "use strict";
  const CFG = {
    winSec: 2,
    welchSec: 2,
    // 特徵視窗（秒），50% 重疊；每視窗一段 Hann FFT（解析度 0.49 Hz）
    hp: 1,
    lp: 45,
    // 靜息態分析：1 Hz 高通壓掉基線漂移與慢眼動，45 Hz 低通
    notch: 60,
    // 台灣市電
    artifactRms: 80,
    // 1–45 Hz RMS 超過即視為假影（µV）；此裝置 Fp−Fpz 導程振幅約傳統導程一半
    flatRunSec: 0.5,
    flatFrac: 0.1,
    trimSec: 5,
    // 頭尾各去 5 秒（按鍵、調整頭帶）
    bands: { delta: [1, 4], theta: [4, 8], alpha: [8, 13], beta: [13, 30], gamma: [30, 45] },
    minUsableSec: 60,
    // 電極接觸偵測（2026-10-02 以空接 vs 貼好樣本校正：空接 RMS≈3.6 µV、頻譜斜率≈−0.7；貼好 RMS 28–85、斜率 −1.8～−2.8）
    contactMinRms: 8,
    // 1–45 Hz RMS 中位數低於此（µV）視為未接觸
    contactMaxSlope: -1.2
    // 2–30 Hz log-log 頻譜斜率高於此（太平＝白雜訊）視為未接觸
    // 乾淨訊號不足 60 秒 → 標示品質不足
  };
  function ascii(bytes, s, n) {
    let out = "";
    for (let i = s; i < s + n; i++) out += String.fromCharCode(bytes[i]);
    return out.trim();
  }
  function parseEDF(buffer) {
    const b = new Uint8Array(buffer);
    if (b.length < 256) throw new Error("\u6A94\u6848\u592A\u5C0F\uFF0C\u4E0D\u662F EDF");
    const startDate = ascii(b, 168, 8), startTime = ascii(b, 176, 8);
    const headerBytes = parseInt(ascii(b, 184, 8), 10);
    let nRec = parseInt(ascii(b, 236, 8), 10);
    const recDur = parseFloat(ascii(b, 244, 8)) || 1;
    const ns = parseInt(ascii(b, 252, 4), 10);
    if (!(ns > 0) || !(headerBytes > 0)) throw new Error("EDF \u6A94\u982D\u7121\u6CD5\u89E3\u6790");
    const patient = ascii(b, 8, 80), recording = ascii(b, 88, 80);
    let p = 256;
    const f = (n) => {
      const arr = [];
      for (let i = 0; i < ns; i++) {
        arr.push(ascii(b, p, n));
        p += n;
      }
      return arr;
    };
    const labels = f(16), transducer = f(80), units = f(8);
    const pmin = f(8).map(Number), pmax = f(8).map(Number), dmin = f(8).map(Number), dmax = f(8).map(Number);
    f(80);
    const nsamp = f(8).map(Number);
    f(32);
    const recBytes = nsamp.reduce((a, c) => a + c, 0) * 2;
    const avail = Math.floor((b.length - headerBytes) / recBytes);
    if (nRec < 0 || nRec > avail) nRec = avail;
    if (nRec <= 0) throw new Error("EDF \u6C92\u6709\u8CC7\u6599\u8A18\u9304");
    const [dd, mm, yy] = startDate.split(".").map(Number);
    const [hh, mi, ss] = startTime.split(".").map(Number);
    const year = yy >= 85 ? 1900 + yy : 2e3 + yy;
    const start = new Date(year, (mm || 1) - 1, dd || 1, hh || 0, mi || 0, ss || 0);
    const dv = new DataView(buffer);
    const signals = labels.map((label, i) => ({
      label,
      unit: units[i],
      transducer: transducer[i],
      fs: nsamp[i] / recDur,
      pmin: pmin[i],
      pmax: pmax[i],
      data: new Float32Array(nsamp[i] * nRec)
    }));
    const gain = signals.map((s, i) => (pmax[i] - pmin[i]) / (dmax[i] - dmin[i]));
    const off = signals.map((s, i) => pmin[i] - dmin[i] * gain[i]);
    let pos = headerBytes;
    for (let r = 0; r < nRec; r++) {
      for (let i = 0; i < ns; i++) {
        const n = nsamp[i], out = signals[i].data, base = r * n, g = gain[i], o = off[i];
        for (let k = 0; k < n; k++) {
          out[base + k] = dv.getInt16(pos, true) * g + o;
          pos += 2;
        }
      }
    }
    return { start, durationSec: nRec * recDur, nRec, recDur, patient, recording, signals };
  }
  function selectChannels(edf) {
    const sig = edf.signals;
    const isAcc = (s) => /^[XYZ]$/i.test(s.label) || /mg/i.test(s.unit);
    const eegLike = sig.filter((s) => !isAcc(s) && s.fs >= 100 && /uv|µv/i.test(s.unit));
    let eeg = [];
    const byLabel = (re) => eegLike.find((s) => re.test(s.label));
    if (byLabel(/^EEG1$/i) && byLabel(/^EEG2$/i)) eeg = [byLabel(/^EEG1$/i), byLabel(/^EEG2$/i)];
    else if (byLabel(/^ECG$/i) && byLabel(/^EEG$/i)) eeg = [byLabel(/^ECG$/i), byLabel(/^EEG$/i)];
    else eeg = eegLike.slice(0, 2);
    if (eeg.length < 1) throw new Error("\u627E\u4E0D\u5230\u8166\u6CE2\u901A\u9053\uFF08\u9700\u8981 \xB5V \u55AE\u4F4D\u3001\u2265100 Hz \u7684\u8A0A\u865F\uFF09");
    const acc = ["X", "Y", "Z"].map((l) => sig.find((s) => s.label.toUpperCase() === l));
    return { eeg: eeg.map((s, i) => ({ name: i === 0 ? "FP1" : "FP2", sig: s })), acc: acc.every(Boolean) ? acc : null };
  }
  function biquad(type, fc, fs) {
    const w0 = 2 * Math.PI * fc / fs, c = Math.cos(w0), a = Math.sin(w0) / (2 * Math.SQRT1_2);
    const a0 = 1 + a;
    let b0, b1, b2;
    if (type === "lp") {
      b0 = (1 - c) / 2;
      b1 = 1 - c;
      b2 = b0;
    } else {
      b0 = (1 + c) / 2;
      b1 = -(1 + c);
      b2 = b0;
    }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * c / a0, a2: (1 - a) / a0 };
  }
  function notch(f0, fs, Q) {
    Q = Q || 30;
    const w0 = 2 * Math.PI * f0 / fs, c = Math.cos(w0), a = Math.sin(w0) / (2 * Q), a0 = 1 + a;
    return { b0: 1 / a0, b1: -2 * c / a0, b2: 1 / a0, a1: -2 * c / a0, a2: (1 - a) / a0 };
  }
  function runBiquad(x, c, reverse) {
    const n = x.length;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const first = reverse ? x[n - 1] : x[0];
    x1 = x2 = first;
    y1 = y2 = first;
    if (reverse) for (let i = n - 1; i >= 0; i--) {
      const v = x[i];
      const y = c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1;
      x1 = v;
      y2 = y1;
      y1 = y;
      x[i] = y;
    }
    else for (let i = 0; i < n; i++) {
      const v = x[i];
      const y = c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1;
      x1 = v;
      y2 = y1;
      y1 = y;
      x[i] = y;
    }
  }
  function filtfilt(src, coeffs) {
    const y = Float32Array.from(src);
    for (const c of coeffs) {
      runBiquad(y, c, false);
      runBiquad(y, c, true);
    }
    return y;
  }
  function fft(re, im) {
    const n = re.length;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const p = i + k, q = p + half;
          const tr = cr * re[q] - ci * im[q], ti = cr * im[q] + ci * re[q];
          re[q] = re[p] - tr;
          im[q] = im[p] - ti;
          re[p] += tr;
          im[p] += ti;
          const nr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = nr;
        }
      }
    }
  }
  function makeWelch(fs) {
    const seg = Math.round(CFG.welchSec * fs);
    let nfft = 1;
    while (nfft < seg) nfft <<= 1;
    const win = new Float64Array(seg);
    let wsum = 0;
    for (let i = 0; i < seg; i++) {
      win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (seg - 1)));
      wsum += win[i] * win[i];
    }
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    const binHz = fs / nfft, nb = (nfft >> 1) + 1;
    const scale = 1 / (fs * wsum);
    return {
      binHz,
      nb,
      psd(x, s0, len) {
        const out = new Float64Array(nb);
        const hop = seg >> 1;
        let cnt = 0;
        for (let s = s0; s + seg <= s0 + len; s += hop) {
          re.fill(0);
          im.fill(0);
          for (let i = 0; i < seg; i++) re[i] = x[s + i] * win[i];
          fft(re, im);
          for (let k = 0; k < nb; k++) out[k] += (re[k] * re[k] + im[k] * im[k]) * scale * (k > 0 && k < nb - 1 ? 2 : 1);
          cnt++;
        }
        if (cnt) for (let k = 0; k < nb; k++) out[k] /= cnt;
        return out;
      },
      band(p, lo, hi) {
        const i0 = Math.max(1, Math.ceil(lo / binHz)), i1 = Math.min(nb - 1, Math.ceil(hi / binHz) - 1);
        let s = 0;
        for (let i = i0; i <= i1; i++) s += p[i];
        return s * binHz;
      }
    };
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mean = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  function median(a) {
    if (!a.length) return 0;
    const s = Array.from(a).sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function percentile(a, q) {
    if (!a.length) return 0;
    const s = Array.from(a).sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
  }
  function piece(x, pts) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return pts[pts.length - 1][1];
  }
  function std(x, s0, len) {
    let m = 0;
    for (let i = 0; i < len; i++) m += x[s0 + i];
    m /= len;
    let v = 0;
    for (let i = 0; i < len; i++) {
      const d = x[s0 + i] - m;
      v += d * d;
    }
    return Math.sqrt(v / len);
  }
  function channelFeatures(sig, fs, log) {
    const raw = sig.data;
    const coeffs = [biquad("hp", CFG.hp, fs), biquad("lp", CFG.lp, fs)];
    if (CFG.notch && CFG.notch < fs / 2) coeffs.push(notch(CFG.notch, fs));
    const x = filtfilt(raw, coeffs);
    const W = makeWelch(fs);
    const win = Math.round(CFG.winSec * fs), hop = win >> 1;
    const s0 = Math.round(CFG.trimSec * fs), s1 = raw.length - Math.round(CFG.trimSec * fs);
    const satLim = 0.95 * Math.max(Math.abs(sig.pmin), Math.abs(sig.pmax));
    const flatNeed = Math.round(CFG.flatRunSec * fs);
    const wins = [];
    for (let s = s0; s + win <= s1; s += hop) {
      let sat = 0, flat = 0, run = 0;
      for (let i = 0; i < win; i++) {
        const v = raw[s + i];
        if (Math.abs(v) >= satLim) sat++;
        if (i > 0 && v === raw[s + i - 1]) run++;
        else {
          if (run >= flatNeed) flat += run;
          run = 0;
        }
      }
      if (run >= flatNeed) flat += run;
      const rms = std(x, s, win);
      const p = W.psd(x, s, win);
      const bp = {};
      for (const k in CFG.bands) bp[k] = W.band(p, CFG.bands[k][0], CFG.bands[k][1]);
      const tot = W.band(p, 1, 45) || 1e-9;
      const rel = {};
      for (const k in bp) rel[k] = bp[k] / tot;
      wins.push({ t: s / fs, rms, bp, rel, tot, psd: p, bad: rms > CFG.artifactRms || sat / win > 0.02 || flat / win > CFG.flatFrac, sat: sat / win, flat: flat / win });
    }
    const ok = wins.filter((w) => !w.bad);
    const psd = new Float64Array(W.nb);
    for (const w of ok) for (let k = 0; k < W.nb; k++) psd[k] += w.psd[k];
    if (ok.length) for (let k = 0; k < W.nb; k++) psd[k] /= ok.length;
    for (const w of wins) w.psd = null;
    const line60 = W.band(psd, 59, 61) / (W.band(psd, 40, 70) || 1e-9);
    return { wins, psd, binHz: W.binHz, nb: W.nb, welch: W, line60, x };
  }
  function alphaPeak(psd, binHz) {
    const i0 = Math.ceil(7 / binHz), i1 = Math.floor(13 / binHz);
    const flat = [];
    for (let i = i0; i <= i1; i++) flat.push(psd[i] * (i * binHz));
    let bi = 0;
    for (let i = 1; i < flat.length; i++) if (flat[i] > flat[bi]) bi = i;
    const freq = (i0 + bi) * binHz;
    const side = (a, b) => {
      let s = 0, n = 0;
      for (let i = a; i <= b; i++) {
        s += psd[i] * (i * binHz);
        n++;
      }
      return n ? s / n : 0;
    };
    const lo = side(Math.ceil(5 / binHz), i0 - 1), hi = side(i1 + 1, Math.floor(16 / binHz));
    const prom = flat[bi] / ((lo + hi) / 2 || 1e-9);
    return { freq, prominence: prom, clear: prom >= 1.3 && bi > 0 && bi < flat.length - 1 };
  }
  function accelSummary(acc, fs0, durSec) {
    const [X, Y, Z] = acc.map((s) => s.data);
    const fs = acc[0].fs;
    const n = Math.min(X.length, Y.length, Z.length);
    let prev = null, m2 = 0, c = 0;
    const per = [];
    const w = Math.round(2 * fs);
    let acc2 = 0, cc = 0;
    for (let i = 0; i < n; i++) {
      const v = Math.sqrt(X[i] * X[i] + Y[i] * Y[i] + Z[i] * Z[i]);
      if (prev !== null) {
        const d = v - prev;
        m2 += d * d;
        c++;
        acc2 += d * d;
        cc++;
      }
      prev = v;
      if (cc === w) {
        per.push(Math.sqrt(acc2 / cc));
        acc2 = 0;
        cc = 0;
      }
    }
    return { sd: c ? Math.sqrt(m2 / c) : 0, perWin: per, stillFrac: per.length ? per.filter((v) => v < 15).length / per.length : 1 };
  }
  // 2–30 Hz log-log 斜率：真腦波 1/f 約 −2，空接白雜訊接近 0
  function spectralSlope(psd, binHz) {
    const xs = [], ys = [];
    for (let k = 0; k < psd.length; k++) { const f = (k + 1) * binHz; if (f >= 2 && f <= 30 && psd[k] > 0) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k])); } }
    if (xs.length < 4) return 0;
    const mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    return sxx ? sxy / sxx : 0;
  }
  function analyze(edf, opts) {
    opts = opts || {};
    const { eeg, acc } = selectChannels(edf);
    const fs = eeg[0].sig.fs;
    if (edf.durationSec < 30) throw new Error("\u9304\u97F3\u4E0D\u8DB3 30 \u79D2\uFF0C\u7121\u6CD5\u5206\u6790");
    const chans = eeg.map((c) => ({ name: c.name, label: c.sig.label, ...channelFeatures(c.sig, fs) }));
    const nWin = chans[0].wins.length;
    const chQ = chans.map((c) => {
      const bad = c.wins.filter((w) => w.bad).length / nWin;
      return {
        name: c.name,
        label: c.label,
        artifactFrac: bad,
        satFrac: mean(c.wins.map((w) => w.sat)),
        flatFrac: mean(c.wins.map((w) => w.flat)),
        line60: c.line60,
        rmsMedian: median(c.wins.filter((w) => !w.bad).map((w) => w.rms)),
        slope: spectralSlope(c.psd, c.binHz),
        usable: bad < 0.5
      };
    });
    for (const q of chQ) q.contact = q.rmsMedian >= CFG.contactMinRms && q.slope <= CFG.contactMaxSlope;
    const contactOk = chQ.some((q) => q.contact);
    const useIdx = chQ.map((q, i) => q.usable && (!contactOk || q.contact) ? i : -1).filter((i) => i >= 0);
    const used = (useIdx.length ? useIdx : chans.map((c, i) => i)).map((i) => chans[i]);
    const wins = [];
    for (let i = 0; i < nWin; i++) {
      const ok = used.filter((c) => !c.wins[i].bad);
      const f = { t: chans[0].wins[i].t, bad: !ok.length };
      if (ok.length) {
        f.rel = {};
        f.bp = {};
        for (const k in CFG.bands) {
          f.rel[k] = mean(ok.map((c) => c.wins[i].rel[k]));
          f.bp[k] = mean(ok.map((c) => c.wins[i].bp[k]));
        }
        f.rms = mean(ok.map((c) => c.wins[i].rms));
      }
      wins.push(f);
    }
    const clean = wins.filter((w) => !w.bad);
    const usableSec = clean.length * CFG.winSec / 2 + (clean.length ? CFG.winSec / 2 : 0);
    const usableFrac = nWin ? clean.length / nWin : 0;
    const bands = {};
    for (const k in CFG.bands) bands[k] = mean(clean.map((w) => w.rel[k]));
    const bandsCh = chans.map((c) => {
      const o = {};
      const ok = c.wins.filter((w) => !w.bad);
      for (const k in CFG.bands) o[k] = mean(ok.map((w) => w.rel[k]));
      return o;
    });
    const nb = chans[0].nb, binHz = chans[0].binHz;
    const psd = new Float64Array(nb);
    for (const c of used) for (let k = 0; k < nb; k++) psd[k] += c.psd[k] / used.length;
    const peak = alphaPeak(psd, binHz);
    const peaksCh = chans.map((c) => alphaPeak(c.psd, binHz));
    const eps = 1e-9;
    const tbr = bands.theta / (bands.beta + eps);
    const bar = bands.beta / (bands.alpha + eps);
    const atr = bands.alpha / (bands.theta + eps);
    const slowFast = (bands.delta + bands.theta) / (bands.alpha + bands.beta + eps);
    let asym = null;
    if (chans.length === 2 && chQ[0].usable && chQ[1].usable) {
      const idx = [];
      for (let i = 0; i < nWin; i++) if (!chans[0].wins[i].bad && !chans[1].wins[i].bad) idx.push(i);
      if (idx.length >= 10) {
        const l = mean(idx.map((i) => chans[0].wins[i].bp.alpha)), r = mean(idx.map((i) => chans[1].wins[i].bp.alpha));
        if (l > 0 && r > 0) asym = Math.log(r) - Math.log(l);
      }
    }
    const alphaCv = clean.length > 5 ? Math.sqrt(mean(clean.map((w) => (w.rel.alpha - bands.alpha) ** 2))) / (bands.alpha + eps) : null;
    const motion = acc ? accelSummary(acc) : null;
    const S = {}, P = {};
    P.slowFast = piece(slowFast, [[1, 100], [2, 85], [4, 60], [8, 35], [16, 15]]);
    P.thetaRel = piece(bands.theta, [[0.1, 100], [0.2, 80], [0.3, 55], [0.45, 25]]);
    S.sleep = 0.6 * P.slowFast + 0.4 * P.thetaRel;
    P.bar = piece(bar, [[0.5, 100], [1, 85], [2, 60], [4, 35], [8, 15]]);
    P.gamma = piece(bands.gamma, [[0.05, 100], [0.15, 70], [0.3, 35]]);
    P.motion = motion ? piece(1 - motion.stillFrac, [[0.05, 100], [0.3, 70], [0.6, 40]]) : 80;
    S.stress = 0.5 * P.bar + 0.3 * P.gamma + 0.2 * P.motion;
    P.tbr = piece(tbr, [[1.5, 100], [3, 75], [5, 50], [8, 25]]);
    P.fast = piece(bands.alpha + bands.beta, [[0.15, 30], [0.3, 65], [0.45, 90], [0.6, 100]]);
    S.focus = 0.6 * P.tbr + 0.4 * P.fast;
    P.iaf = peak.clear ? piece(peak.freq, [[7.5, 40], [8.5, 65], [9.5, 90], [10, 100], [12, 100], [13, 85]]) : 50;
    P.atr = piece(atr, [[0.3, 20], [0.6, 50], [1, 80], [1.5, 100]]);
    P.asym = asym === null ? 60 : piece(Math.abs(asym), [[0.2, 100], [0.5, 70], [1, 40], [1.5, 20]]);
    P.stab = alphaCv === null ? 60 : piece(alphaCv, [[0.3, 100], [0.6, 75], [1, 45]]);
    S.rhythm = 0.3 * P.iaf + 0.3 * P.atr + 0.2 * P.asym + 0.2 * P.stab;
    for (const k in S) S[k] = Math.round(clamp(S[k], 0, 100));
    S.overall = Math.round(clamp(0.25 * S.sleep + 0.25 * S.stress + 0.25 * S.focus + 0.25 * S.rhythm, 0, 100));
    for (const k in P) P[k] = Math.round(P[k]);
    const series = wins.map((w) => ({ t: w.t, bad: w.bad, rel: w.rel || null, rms: w.rms || null }));
    const spec = [];
    for (let k = 1; k * binHz <= 45; k++) spec.push([+(k * binHz).toFixed(3), psd[k]]);
    const specCh = chans.map((c) => {
      const a = [];
      for (let k = 1; k * binHz <= 45; k++) a.push(c.psd[k]);
      return a;
    });
    return {
      cfg: CFG,
      fs,
      start: edf.start,
      durationSec: edf.durationSec,
      nWin,
      winSec: CFG.winSec,
      channels: chQ,
      hasAcc: !!acc,
      usableSec,
      usableFrac,
      lowQuality: usableSec < CFG.minUsableSec || !contactOk,
      contact: { ok: contactOk, channels: chQ.map((q) => ({ name: q.name, contact: q.contact, rms: q.rmsMedian, slope: q.slope })) },
      bands,
      bandsByChannel: bandsCh,
      peak,
      peaksByChannel: peaksCh,
      ratios: { tbr, bar, atr, slowFast, asym, alphaCv },
      motion: motion ? { sd: motion.sd, stillFrac: motion.stillFrac, perWin: motion.perWin } : null,
      series,
      spec,
      specByChannel: specCh,
      parts: P,
      scores: S
    };
  }
  return { CFG, parseEDF, selectChannels, analyze, alphaPeak, piece, clamp };
})();
export {
  H3
};
