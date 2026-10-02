// Electrode-contact feature extraction: node test/contact/features.mjs <edf> [startSec] [durSec]
import { readFileSync } from 'node:fs';
import { H3 } from '../../report/h3core.js';
const [file, startArg = '0', durArg = '60'] = process.argv.slice(2);
const buf = readFileSync(file);
const edf = H3.parseEDF(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const eeg = edf.signals.filter(s => /uv/i.test(s.unit) && s.fs >= 100).slice(0, 2);
const fs = eeg[0].fs, s0 = Math.round(+startArg * fs), n = Math.round(+durArg * fs);
const cut = eeg.map(s => ({ ...s, data: s.data.subarray(s0, s0 + n) }));
const res = H3.analyze({ start: edf.start, durationSec: +durArg, nRec: +durArg, recDur: 1, patient: '', recording: '', signals: cut });
// spectral slope 2–30 Hz (log-log), per channel
const binHz = res.spec[1][0] - res.spec[0][0];
const slope = (psd) => { const xs = [], ys = []; for (let k = 0; k < psd.length; k++) { const f = (k + 1) * binHz; if (f >= 2 && f <= 30 && psd[k] > 0) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k])); } }
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length; let sxy = 0, sxx = 0; for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; } return sxy / sxx; };
// 1-Hz high-passed inter-channel correlation + blink-size deflections
const hp = (x) => { const a = Math.exp(-2 * Math.PI * 1 / fs); const y = new Float32Array(x.length); let pi = 0, po = 0; for (let i = 0; i < x.length; i++) { po = a * (po + x[i] - pi); pi = x[i]; y[i] = po; } return y; };
const h1 = hp(cut[0].data), h2 = hp(cut[1].data);
let m1 = 0, m2 = 0; for (let i = 0; i < n; i++) { m1 += h1[i]; m2 += h2[i]; } m1 /= n; m2 /= n;
let sxy = 0, sxx = 0, syy = 0, big = 0; for (let i = 0; i < n; i++) { const a = h1[i] - m1, b = h2[i] - m2; sxy += a * b; sxx += a * a; syy += b * b; if (Math.abs(a) > 60 || Math.abs(b) > 60) big++; }
const corr = sxy / Math.sqrt(sxx * syy);
const rms = Math.sqrt(sxx / n), rms2 = Math.sqrt(syy / n);
// raw DC level (mean of unfiltered µV) — floating inputs tend to sit near 0 or rail
let dc1 = 0, dc2 = 0; for (let i = 0; i < n; i++) { dc1 += cut[0].data[i]; dc2 += cut[1].data[i]; } dc1 /= n; dc2 /= n;
const out = { file: file.split('/').pop(), start: +startArg, usableFrac: +res.usableFrac.toFixed(2), rmsFP1: +rms.toFixed(1), rmsFP2: +rms2.toFixed(1), dcFP1: Math.round(dc1), dcFP2: Math.round(dc2),
  slopeFP1: +slope(res.specByChannel[0]).toFixed(2), slopeFP2: +slope(res.specByChannel[1]).toFixed(2), corr1Hz: +corr.toFixed(2), bigFrac: +(big / n).toFixed(3),
  bands: Object.fromEntries(Object.entries(res.bands).map(([k, v]) => [k, +v.toFixed(2)])), scores: res.scores };
console.log(JSON.stringify(out));
