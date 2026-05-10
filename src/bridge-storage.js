// bridge-storage.ts
// Storage ibrido: bridge.setLocalStorage (persistente sugli occhiali) + window.localStorage (fallback)
let _bridge = null;
export function initBridgeStorage(bridge) {
    _bridge = bridge;
}
export async function bGet(key) {
    if (_bridge) {
        try {
            const val = await _bridge.getLocalStorage(key);
            if (val)
                return val;
        }
        catch { }
    }
    return window.localStorage.getItem(key);
}
export async function bSet(key, value) {
    if (_bridge) {
        try {
            await _bridge.setLocalStorage(key, value);
        }
        catch { }
    }
    window.localStorage.setItem(key, value);
}
