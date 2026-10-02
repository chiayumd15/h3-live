// H3 (Xenon "xb51") stream parser — JS port of 2chrec/src-tauri/src/parser.rs
// Input: notification payload with the 6-byte BLE header already stripped.
// Output events: {type:'line', text} or {type:'block', counter, n, channels:[Int16Array...], div, lostBefore, checksumOk}

const TEXT = 0, HEADER = 1, DATA = 2, TRAIL = 3;

function isHex(bytes) {
  if (!bytes.length) return false;
  for (const c of bytes) {
    if (!((c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102))) return false;
  }
  return true;
}
const parseHex = (bytes) => parseInt(String.fromCharCode(...bytes), 16) || 0;

// "x=CCCCSS" with valid checksum -> counter, else null
function parseXLine(line) {
  if (line.length !== 8 || line[0] !== 0x78 || line[1] !== 0x3d || !isHex(line.slice(2))) return null;
  const cnt = parseHex(line.slice(2, 6)) & 0xffff;
  const cs = parseHex(line.slice(6, 8)) & 0xff;
  const calc = ((cnt >> 8) + (cnt & 0xff)) & 0xff;
  return calc === cs ? cnt : null;
}

export class H3Parser {
  constructor() {
    this.mode = TEXT;
    this.line = [];
    this.partialX = null;
    this.hdr = [];
    this.hdrLen = 0;
    this.n = 0; this.m = 0; this.div = []; this.totalWords = 0;
    this.data = new Uint8Array(4096); this.dataLen = 0;
    this.trail = [];
    this.curCounter = 0; this.lastCounter = null;
    this.stats = { blocks: 0, lostBlocks: 0, checksumErrors: 0, framingErrors: 0, lines: 0 };
  }
  resync() { this.mode = TEXT; this.line = []; this.partialX = null; this.lastCounter = null; }

  feed(bytes, out) {
    let i = 0;
    while (i < bytes.length) {
      if (this.mode === TEXT) {
        const b = bytes[i++];
        if (b === 0x0d) { const l = this.line; this.line = []; this.handleLine(l, out); }
        else if (b !== 0x0a) {
          if (this.line.length < 512) this.line.push(b);
          else { this.line = []; this.stats.framingErrors++; }
        }
      } else if (this.mode === HEADER) {
        this.hdr.push(bytes[i++]);
        if (this.hdr.length === 2) {
          this.n = this.hdr[0] + 1; this.m = this.hdr[1] + 1;
          if (this.m > 8 || this.n > 64) { this.abortBlock(); continue; }
          this.hdrLen = ((this.m + 1) >> 1) + 2;
        }
        if (this.hdr.length >= 2 && this.hdr.length === this.hdrLen) {
          const nib = [];
          for (const b of this.hdr.slice(2)) { nib.push((b >> 4) + 1); nib.push((b & 0x0f) + 1); }
          this.div = nib.slice(0, this.m);
          this.totalWords = this.div.reduce((s, d) => s + Math.floor(this.n / d), 0);
          if (this.totalWords === 0 || this.totalWords > 2048) { this.abortBlock(); continue; }
          this.dataLen = 0; this.mode = DATA;
        }
      } else if (this.mode === DATA) {
        const need = this.totalWords * 2 - this.dataLen;
        const take = Math.min(need, bytes.length - i);
        this.data.set(bytes.subarray(i, i + take), this.dataLen);
        this.dataLen += take; i += take;
        if (this.dataLen === this.totalWords * 2) { this.trail = []; this.mode = TRAIL; }
      } else { // TRAIL
        this.trail.push(bytes[i++]);
        if (this.trail.length === 2) this.finishBlock(out);
      }
    }
  }

  abortBlock() { this.stats.framingErrors++; this.mode = TEXT; this.line = []; }
  startBlock(counter) { this.curCounter = counter; this.hdr = []; this.hdrLen = 0; this.mode = HEADER; this.partialX = null; }

  handleLine(line, out) {
    if (!line.length) return;
    let cnt = parseXLine(line);
    if (cnt !== null) { this.startBlock(cnt); return; }
    if (line.length > 8) {
      cnt = parseXLine(line.slice(line.length - 8));
      if (cnt !== null) { this.stats.framingErrors++; this.startBlock(cnt); return; }
    }
    // status line glued inside the x-line: "x=47" + "TI=000004"
    if (line.length > 8 && line[0] === 0x78 && line[1] === 0x3d) {
      for (let k = 2; k <= Math.min(6, line.length - 1); k++) {
        const rest = line.slice(k);
        if (isHex(line.slice(2, k)) && rest[0] >= 65 && rest[0] <= 90 && rest.includes(0x3d)) {
          this.partialX = line.slice(0, k);
          this.stats.lines++;
          out.push({ type: 'line', text: String.fromCharCode(...rest) });
          return;
        }
      }
    }
    if (this.partialX) {
      const p = this.partialX.concat(line); this.partialX = null;
      cnt = parseXLine(p);
      if (cnt !== null) { this.startBlock(cnt); return; }
    }
    this.stats.lines++;
    out.push({ type: 'line', text: String.fromCharCode(...line) });
  }

  finishBlock(out) {
    let sum = 0;
    for (let k = 0; k < this.dataLen; k++) sum += this.data[k];
    const trail = (this.trail[0] << 8) | this.trail[1];
    const checksumOk = (sum & 0xffff) === trail;
    if (!checksumOk) this.stats.checksumErrors++;
    const channels = this.div.map((d) => new Int16Array(Math.floor(this.n / d)));
    const idx = new Array(this.m).fill(0);
    let k = 0;
    for (let s = 0; s < this.n; s++) {
      for (let c = 0; c < this.m; c++) {
        if (s % this.div[c] === 0) {
          const w = (this.data[2 * k] << 8) | this.data[2 * k + 1];
          channels[c][idx[c]++] = w - 0x8000; // offset binary -> signed
          k++;
        }
      }
    }
    let lostBefore = 0;
    if (this.lastCounter !== null) {
      const gap = (this.curCounter - this.lastCounter - 1) & 0xffff;
      lostBefore = gap > 300 ? 0 : gap; // >300 blocks (~36 s) is a (re)connect discontinuity, not loss
    }
    this.lastCounter = this.curCounter;
    this.stats.blocks++; this.stats.lostBlocks += lostBefore;
    out.push({ type: 'block', counter: this.curCounter, n: this.n, channels, div: this.div.slice(), lostBefore, checksumOk });
    this.mode = TEXT; this.line = [];
  }
}
