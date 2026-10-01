// Unified BLE adapter for the H3.
//  - Browser (GitHub Pages / Chrome): Web Bluetooth
//  - Android app (Capacitor): @capacitor-community/bluetooth-le (WebView has no Web Bluetooth)
// Both expose the same small interface used by app.js.

export const isNative = !!(globalThis.Capacitor && globalThis.Capacitor.isNativePlatform && globalThis.Capacitor.isNativePlatform());

const SERVICE16 = 0xfff0, DATA16 = 0xfff5, CMD16 = 0xfff6;
const u128 = (n) => `0000${n.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;
export const SERVICE = u128(SERVICE16), CH_DATA = u128(DATA16), CH_CMD = u128(CMD16);

// ---------------- Web Bluetooth ----------------
class WebBle {
  constructor() { this.device = null; this.server = null; this.dataChar = null; this.cmdChar = null; this._onData = null; this._onDisc = null; }
  get kind() { return 'web'; }
  async available() { if (!navigator.bluetooth) return false; try { return await navigator.bluetooth.getAvailability(); } catch { return true; } }
  supported() { return !!navigator.bluetooth; }
  async requestDevice(all) {
    const dev = await navigator.bluetooth.requestDevice(all
      ? { acceptAllDevices: true, optionalServices: [SERVICE16] }
      : { filters: [{ services: [SERVICE16] }, { namePrefix: 'xb5' }, { namePrefix: 'XB5' }, { namePrefix: 'H3' }], optionalServices: [SERVICE16] });
    this.device = dev;
    return { id: dev.id, name: dev.name || '' };
  }
  async connect(_id, onDisconnect) {
    this._onDisc = onDisconnect;
    this.device.addEventListener('gattserverdisconnected', this._discHandler = () => this._onDisc && this._onDisc());
    this.server = await this.device.gatt.connect();
    const svc = await this.server.getPrimaryService(SERVICE16);
    this.dataChar = await svc.getCharacteristic(DATA16);
    this.cmdChar = await svc.getCharacteristic(CMD16);
  }
  async startNotifications(onData) {
    this._onData = onData;
    await this.dataChar.startNotifications();
    this.dataChar.addEventListener('characteristicvaluechanged', this._nHandler = (ev) => {
      const v = ev.target.value; this._onData(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    });
  }
  async stopNotifications() { try { this.dataChar?.removeEventListener('characteristicvaluechanged', this._nHandler); await this.dataChar?.stopNotifications(); } catch {} }
  async write(bytes) {
    try { await this.cmdChar.writeValueWithResponse(bytes); }
    catch { await this.cmdChar.writeValueWithoutResponse(bytes); }
  }
  isConnected() { return !!(this.server && this.server.connected); }
  async disconnect() { try { this.device?.removeEventListener('gattserverdisconnected', this._discHandler); this.device?.gatt.disconnect(); } catch {} this.server = null; }
}

// ---------------- Capacitor (Android) ----------------
class NativeBle {
  constructor(BleClient) { this.B = BleClient; this.id = null; this.name = ''; this.connected = false; this.inited = false; }
  get kind() { return 'native'; }
  supported() { return true; }
  async init() { if (!this.inited) { await this.B.initialize({ androidNeverForLocation: true }); this.inited = true; } }
  async available() { await this.init(); try { return await this.B.isEnabled(); } catch { return true; } }
  async requestDevice(all) {
    await this.init();
    try { if (!(await this.B.isEnabled())) await this.B.requestEnable(); } catch {}
    const dev = await this.B.requestDevice(all
      ? { optionalServices: [SERVICE] }
      : { services: [SERVICE], namePrefix: 'xb5', optionalServices: [SERVICE] });
    this.id = dev.deviceId; this.name = dev.name || '';
    return { id: dev.deviceId, name: dev.name || '' };
  }
  async connect(id, onDisconnect) {
    await this.init(); this.id = id;
    await this.B.connect(id, () => { this.connected = false; onDisconnect && onDisconnect(); }, { timeout: 15000 });
    this.connected = true;
    try { await this.B.requestConnectionPriority(id, 1); } catch {} // 1 = HIGH
  }
  async startNotifications(onData) {
    await this.B.startNotifications(this.id, SERVICE, CH_DATA, (dv) => onData(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)));
  }
  async stopNotifications() { try { await this.B.stopNotifications(this.id, SERVICE, CH_DATA); } catch {} }
  async write(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    try { await this.B.write(this.id, SERVICE, CH_CMD, dv); }
    catch { await this.B.writeWithoutResponse(this.id, SERVICE, CH_CMD, dv); }
  }
  isConnected() { return this.connected; }
  async disconnect() { try { await this.B.disconnect(this.id); } catch {} this.connected = false; }
}

export async function createBle() {
  if (isNative) {
    const { BleClient } = await import('@capacitor-community/bluetooth-le');
    return new NativeBle(BleClient);
  }
  return new WebBle();
}
