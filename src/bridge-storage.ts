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
            const val = await _bridge.getLocalStorage(key)
            if (val) return val
        } catch { }
    }
    return window.localStorage.getItem(key)
}

export async function bSet(key: string, value: string): Promise<void> {
    if (_bridge) {
        try { await _bridge.setLocalStorage(key, value) } catch { }
    }
    window.localStorage.setItem(key, value)
}
