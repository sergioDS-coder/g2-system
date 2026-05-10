import { bGet, bSet } from './bridge-storage';
const KEYS = {
    player: 'g2sys_player',
    quests: 'g2sys_quests',
    setupComplete: 'g2sys_setup_complete',
};
export async function loadPlayer() {
    try {
        const raw = await bGet(KEYS.player);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function savePlayer(p) {
    await bSet(KEYS.player, JSON.stringify(p));
}
export async function loadQuests() {
    try {
        const raw = await bGet(KEYS.quests);
        if (!raw)
            return [];
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
export async function saveQuests(q) {
    await bSet(KEYS.quests, JSON.stringify(q));
}
export async function isSetupComplete() {
    const val = await bGet(KEYS.setupComplete);
    return val === 'true';
}
export async function saveSetupComplete() {
    await bSet(KEYS.setupComplete, 'true');
}
export function generatePlayerId() {
    return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
