/**
 * A breadcrumb trail for uploads that survives the page being destroyed.
 *
 * Uploading from a phone fails in a way no desktop browser reproduces: the OS
 * discards the page while the native file picker is open and rebuilds it on
 * return. Anything held in memory — refs, state, console history — is gone, so
 * there is nothing left to inspect afterwards and remote debugging shows an
 * empty console.
 *
 * sessionStorage is one of the few things that survives that, so each step
 * writes a line here and the panel renders them. It turns "nothing happened"
 * into a list showing exactly how far it got.
 */
const KEY = 'gd-upload-trace';
const MAX = 40;

export function traceUpload(step: string, detail?: string) {
  try {
    const now = new Date().toISOString().slice(11, 19);
    const line = `${now} ${step}${detail ? ' — ' + detail : ''}`;
    const prev = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    sessionStorage.setItem(KEY, JSON.stringify([...prev, line].slice(-MAX)));
  } catch {
    /* private mode — diagnostics are best-effort */
  }
}

export function readUploadTrace(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearUploadTrace() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
