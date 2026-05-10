// quest-data.ts - Database quest predefinite + generazione giornaliera
// Quest fisse sempre presenti
export const FIXED_QUESTS = [
    {
        id: 'fixed_camminata',
        type: 'fixed',
        nameKey: 'questCamminata',
        attribute: 'agi',
        unit: 'steps',
        expBase: 50,
        variants: [5000],
    },
    {
        id: 'fixed_sonno',
        type: 'fixed',
        nameKey: 'questSonno',
        attribute: 'vit',
        unit: 'h',
        expBase: 80,
        variants: [7],
    },
];
// Quest fitness random
export const FITNESS_QUESTS = [
    {
        id: 'corsa',
        type: 'fitness',
        nameKey: 'questCorsa',
        attribute: 'agi',
        unit: 'km',
        expBase: 100,
        variants: [1, 2, 3, 5],
    },
    {
        id: 'flessioni',
        type: 'fitness',
        nameKey: 'questFlessioni',
        attribute: 'str',
        unit: 'reps',
        expBase: 50,
        variants: [10, 20, 30, 50],
    },
    {
        id: 'addominali',
        type: 'fitness',
        nameKey: 'questAddominali',
        attribute: 'str',
        unit: 'reps',
        expBase: 50,
        variants: [15, 30, 50],
    },
    {
        id: 'plank',
        type: 'fitness',
        nameKey: 'questPlank',
        attribute: 'end',
        unit: 'min',
        expBase: 60,
        variants: [1, 2, 3],
    },
    {
        id: 'yoga',
        type: 'fitness',
        nameKey: 'questYoga',
        attribute: 'vit',
        unit: 'min',
        expBase: 80,
        variants: [10, 20, 30],
    },
    {
        id: 'scale',
        type: 'fitness',
        nameKey: 'questScale',
        attribute: 'end',
        unit: 'floors',
        expBase: 70,
        variants: [5, 10, 20],
    },
];
// Quest mentali
export const MENTAL_QUESTS = [
    {
        id: 'meditazione',
        type: 'mental',
        nameKey: 'questMeditazione',
        attribute: 'vit',
        unit: 'min',
        expBase: 100,
        variants: [10, 15, 20, 30],
    },
    {
        id: 'lettura',
        type: 'mental',
        nameKey: 'questLettura',
        attribute: 'int',
        unit: 'pages',
        expBase: 80,
        variants: [10, 20, 30, 50],
    },
    {
        id: 'studio',
        type: 'mental',
        nameKey: 'questStudio',
        attribute: 'int',
        unit: 'min',
        expBase: 100,
        variants: [30, 60, 90],
    },
    {
        id: 'scrittura',
        type: 'mental',
        nameKey: 'questScrittura',
        attribute: 'int',
        unit: 'min',
        expBase: 70,
        variants: [15, 30],
    },
    {
        id: 'noscreen',
        type: 'mental',
        nameKey: 'questNoScreen',
        attribute: 'vit',
        unit: 'h',
        expBase: 90,
        variants: [1, 2],
    },
];
function pickVariantForLevel(template, level) {
    const totalVariants = template.variants.length;
    // Più livello → variante più alta
    const idx = Math.min(totalVariants - 1, Math.floor(level / 20));
    return template.variants[idx];
}
function generateQuestFromTemplate(t, level, dateStr, idx) {
    const amount = pickVariantForLevel(t, level);
    const expMultiplier = (amount / t.variants[0]); // più valore = più EXP
    return {
        id: `${dateStr}_${idx}_${t.id}`,
        templateId: t.id,
        type: t.type,
        nameKey: t.nameKey,
        attribute: t.attribute,
        unit: t.unit,
        amount,
        expReward: Math.round(t.expBase * expMultiplier),
        completed: false,
        date: dateStr,
    };
}
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
// ─── Generazione lista quest giornaliera ─────────────────────────────────────
export function generateDailyQuests(level, count, dateStr) {
    const quests = [];
    let idx = 0;
    // 1. Quest fisse sempre presenti
    for (const t of FIXED_QUESTS) {
        quests.push(generateQuestFromTemplate(t, level, dateStr, idx++));
    }
    // 2. Riempi il resto con mix fitness/mental
    const remaining = count - quests.length;
    const fitnessShuffled = shuffle(FITNESS_QUESTS);
    const mentalShuffled = shuffle(MENTAL_QUESTS);
    const pool = [];
    // Alternato: ~60% fitness, ~40% mentali
    const fitnessCount = Math.ceil(remaining * 0.6);
    const mentalCount = remaining - fitnessCount;
    pool.push(...fitnessShuffled.slice(0, fitnessCount));
    pool.push(...mentalShuffled.slice(0, mentalCount));
    for (const t of shuffle(pool)) {
        quests.push(generateQuestFromTemplate(t, level, dateStr, idx++));
    }
    return quests.slice(0, count);
}
