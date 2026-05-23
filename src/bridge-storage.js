// bridge-storage.ts
// Storage ibrido: bridge.setLocalStorage (persistente sugli occhiali) + window.localStorage (fallback)
let _bridge = null;
export function initBridgeStorage(bridge) {
    _bridge = bridge;
}
export async function bGet(key) {
    if (_bridge) {
        try {
            // Timeout di 1.5 secondi per il bridge storage
            const val = await Promise.race([
                _bridge.getLocalStorage(key),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 1500))
            ]);
            if (val)
                return val;
        }
        catch (e) {
            console.warn(`[Storage] Bridge get failed for ${key}:`, e);
        }
    }
    return window.localStorage.getItem(key);
}
export async function bSet(key, value) {
    if (_bridge) {
        try {
            await Promise.race([
                _bridge.setLocalStorage(key, value),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 1500))
            ]);
        }
        catch (e) {
            console.warn(`[Storage] Bridge set failed for ${key}:`, e);
        }
    }
    window.localStorage.setItem(key, value);
}
