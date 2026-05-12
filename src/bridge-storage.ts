// bridge-storage.ts
// Storage ibrido: bridge.setLocalStorage (persistente sugli occhiali) + window.localStorage (fallback)

type Bridge = {
    setLocalStorage: (key: string, value: string) => Promise<boolean>
    getLocalStorage: (key: string) => Promise<string>
}

let _bridge: Bridge | null = null

export function initBridgeStorage(bridge: Bridge): void {
    _bridge = bridge
}

export async function bGet(key: string): Promise<string | null> {
    if (_bridge) {
        try {
            // Timeout di 1.5 secondi per il bridge storage
            const val = await Promise.race([
                _bridge.getLocalStorage(key),
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 1500))
            ])
            if (val) return val
        } catch (e) {
            console.warn(`[Storage] Bridge get failed for ${key}:`, e)
        }
    }
    return window.localStorage.getItem(key)
}

export async function bSet(key: string, value: string): Promise<void> {
    if (_bridge) {
        try {
            await Promise.race([
                _bridge.setLocalStorage(key, value),
                new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 1500))
            ])
        } catch (e) {
            console.warn(`[Storage] Bridge set failed for ${key}:`, e)
        }
    }
    window.localStorage.setItem(key, value)
}
