// Platform helpers: file saving/sharing and screen wake lock.
//  - Browser: <a download> + Screen Wake Lock API
//  - Android app: Capacitor Filesystem (Documents/H3Live) + Share sheet, KeepAwake plugin
import { isNative } from './ble.js';

function blobToBase64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
}

/** Save a Blob under `name`. Returns a human-readable description of where it went. */
export async function saveFile(name, blob) {
  if (!isNative) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return `已下載 ${name}`;
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const data = await blobToBase64(blob);
  const path = `H3Live/${name}`;
  const res = await Filesystem.writeFile({ path, data, directory: Directory.Documents, recursive: true });
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title: name, files: [res.uri] });
  } catch { /* user dismissed the share sheet; file is still saved */ }
  return `已存到 Documents/${path}`;
}

let wakeLock = null;
export async function keepAwake(on) {
  if (isNative) {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    if (on) await KeepAwake.keepAwake(); else await KeepAwake.allowSleep();
    return;
  }
  if (on && !wakeLock && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
  if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
}
