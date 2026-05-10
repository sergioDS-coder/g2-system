// ai-quest.ts - Genera quest via Netlify Function (Gemini server-side)
const FUNCTION_URL = 'https://g2-system.netlify.app/.netlify/functions/generate-quest';
function buildDailyQuest(data, level, dateStr, idx) {
    return {
        id: `${dateStr}_ai_${idx}_${Date.now()}`,
        templateId: 'ai_daily',
        type: (data.type === 'mental' ? 'mental' : 'fitness'),
        nameKey: 'reward',
        attribute: data.attribute,
        unit: data.unit ?? 'count',
        amount: data.amount ?? 1,
        expReward: Math.round((100 + level * 15) * (data.amount / 10)),
        completed: false,
        date: dateStr,
        jollyName: data.name,
    };
}
// Genera tutte le quest giornaliere via Gemini
export async function generateDailyQuestsAI(level, language, count) {
    try {
        const response = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, language, count, mode: 'daily' }),
        });
        if (!response.ok)
            return null;
        const data = await response.json();
        if (!data.quests || !Array.isArray(data.quests))
            return null;
        const dateStr = new Date().toISOString().slice(0, 10);
        return data.quests
            .slice(0, count)
            .map((q, i) => buildDailyQuest(q, level, dateStr, i));
    }
    catch (err) {
        console.error('Errore generazione quest AI:', err);
        return null;
    }
}
// Genera singola quest jolly
export async function generateJollyQuest(level, language) {
    try {
        const response = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, language, mode: 'jolly' }),
        });
        if (!response.ok)
            return null;
        const data = await response.json();
        if (!data.name || !data.attribute)
            return null;
        const dateStr = new Date().toISOString().slice(0, 10);
        return {
            id: `${dateStr}_jolly_${Date.now()}`,
            templateId: 'jolly',
            type: 'jolly',
            nameKey: 'reward',
            attribute: data.attribute,
            unit: data.unit ?? 'count',
            amount: data.amount ?? 1,
            expReward: 200 + level * 10,
            completed: false,
            date: dateStr,
            jollyName: data.name,
        };
    }
    catch (err) {
        console.error('Errore quest jolly:', err);
        return null;
    }
}
