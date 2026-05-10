// main.ts — G2 System v1.3.0
import { waitForEvenAppBridge, OsEventTypeList, } from '@evenrealities/even_hub_sdk';
import { addExp, subtractExp, applyPenalty, incrementQuestCount, createDefaultPlayer, getQuestsPerDay, } from './game-engine';
import { generateDailyQuests } from './quest-data';
import { generateDailyQuestsAI, generateJollyQuest } from './ai-quest';
import { SupabaseClient } from './supabase-client';
import { G2Display } from './g2-display';
import { initBridgeStorage } from './bridge-storage';
import { loadPlayer, savePlayer, loadQuests, saveQuests, isSetupComplete, saveSetupComplete, generatePlayerId, } from './storage';
let currentScreen = 'boot';
let display;
let bridge;
let supabase;
let player = null;
let quests = [];
let ranking = [];
let rankingPage = 0;
let myRankPos = null;
let questIdx = 0;
let profileIdx = 0;
let detailIdx = 0;
let rankingIdx = 0;
let allDoneIdx = 0;
let msgIdx = 0;
let levelIdx = 0;
let rankUpIdx = 0;
let warningIdx = 0;
let pendingLevelUp = null;
let pendingRankUp = null;
let warningExpLost = 0;
// ─── Inserimento nome, lingua e privacy ───────────────────────────────────────
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-';
const LANGS = ['it', 'en', 'fr', 'de', 'es', 'ja', 'ko', 'zh', 'pt', 'ru'];
const PRIVACY_OPTIONS = ['public', 'anonymous', 'private'];
let nameBuffer = '';
let charIdx = 0;
let inputStep = 'name';
let selectedLang = 'it';
let selectedPrivacy = 'anonymous';
let isChangingName = false;
function currentChar() {
    if (inputStep === 'lang')
        return LANGS[charIdx % LANGS.length];
    if (inputStep === 'privacy')
        return PRIVACY_OPTIONS[charIdx % PRIVACY_OPTIONS.length];
    if (charIdx < CHARSET.length)
        return CHARSET[charIdx];
    if (charIdx === CHARSET.length)
        return 'LANG';
    if (charIdx === CHARSET.length + 1)
        return 'PRIV';
    if (charIdx === CHARSET.length + 2)
        return 'OK';
    return 'ESC';
}
function charsetLen() {
    if (inputStep === 'lang')
        return LANGS.length;
    if (inputStep === 'privacy')
        return PRIVACY_OPTIONS.length;
    return CHARSET.length + 4;
}
// ─── Avvio ────────────────────────────────────────────────────────────────────
async function main() {
    bridge = await waitForEvenAppBridge();
    initBridgeStorage(bridge);
    display = new G2Display(bridge);
    await display.initPage();
    const supaUrl = import.meta.env.VITE_SUPABASE_URL;
    const supaKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    supabase = new SupabaseClient(supaUrl, supaKey);
    await initialize();
    setupEventListener();
}
async function initialize() {
    const setupDone = await isSetupComplete();
    const savedPlayer = await loadPlayer();
    if (!setupDone || !savedPlayer || !savedPlayer.name || savedPlayer.name === 'Player') {
        const netlifyPlayer = readNetlifyPlayer();
        if (netlifyPlayer?.name && netlifyPlayer.name !== 'Player') {
            await savePlayer(netlifyPlayer);
            await saveSetupComplete();
            player = netlifyPlayer;
        }
        else {
            nameBuffer = '';
            charIdx = 0;
            inputStep = 'name';
            isChangingName = false;
            currentScreen = 'nameInput';
            await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep));
            return;
        }
    }
    else {
        player = savedPlayer;
    }
    display.setLang(player.language);
    quests = await loadQuests();
    const today = new Date().toISOString().slice(0, 10);
    if (player.lastDailyDate !== today) {
        const missed = quests.filter(q => !q.completed && q.date === player.lastDailyDate);
        if (missed.length > 0 && player.lastDailyDate) {
            const lost = missed.reduce((s, q) => s + Math.floor(q.expReward * 0.5), 0);
            player = applyPenalty(player, lost);
            warningExpLost = lost;
            await savePlayer(player);
            warningIdx = 0;
            currentScreen = 'warning';
            await display.update(display.buildWarningScreen(warningExpLost, warningIdx));
            return;
        }
        // Genera quest con Gemini, fallback su template locali
        const count = getQuestsPerDay(player.level);
        const aiQuests = await generateDailyQuestsAI(player.level, player.language, count);
        quests = aiQuests ?? generateDailyQuests(player.level, count, today);
        // Quest jolly 10% probabilità
        if (Math.random() < 0.1) {
            const jolly = await generateJollyQuest(player.level, player.language);
            if (jolly)
                quests.push(jolly);
        }
        await saveQuests(quests);
        player.lastDailyDate = today;
        await savePlayer(player);
        await supabase.upsertPlayer(player);
        msgIdx = 0;
        currentScreen = 'dailyMessage';
        await display.update(display.buildDailyMessage(msgIdx));
    }
    else {
        const allDone = quests.length > 0 && quests.every(q => q.completed);
        if (allDone) {
            allDoneIdx = 0;
            currentScreen = 'allDone';
            await display.update(display.buildAllDoneScreen(allDoneIdx));
        }
        else {
            await goToQuestList();
        }
    }
}
function readNetlifyPlayer() {
    try {
        const raw = window.localStorage.getItem('g2sys_player');
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
// ─── Setup ────────────────────────────────────────────────────────────────────
async function confirmSetup() {
    const name = nameBuffer.trim();
    if (!name)
        return;
    if (isChangingName && player) {
        player.name = name;
        player.language = selectedLang;
        player.privacy = selectedPrivacy;
        await savePlayer(player);
        display.setLang(selectedLang);
        await supabase.upsertPlayer(player);
        isChangingName = false;
        await goToProfile();
    }
    else {
        player = createDefaultPlayer(generatePlayerId(), name, selectedLang);
        player.privacy = selectedPrivacy;
        await savePlayer(player);
        await saveSetupComplete();
        display.setLang(selectedLang);
        nameBuffer = '';
        charIdx = 0;
        inputStep = 'name';
        isChangingName = false;
        await initialize();
    }
}
async function startChangeName() {
    isChangingName = true;
    nameBuffer = '';
    charIdx = 0;
    inputStep = 'name';
    selectedLang = player?.language ?? 'it';
    selectedPrivacy = player?.privacy ?? 'anonymous';
    currentScreen = 'nameInput';
    await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep));
}
// ─── Navigazione ─────────────────────────────────────────────────────────────
async function goToQuestList() {
    currentScreen = 'questList';
    questIdx = 0;
    await display.update(display.buildQuestList(quests, questIdx));
}
async function refreshQuestList() {
    await display.update(display.buildQuestList(quests, questIdx));
}
async function goToProfile() {
    currentScreen = 'profile';
    profileIdx = 0;
    myRankPos = await supabase.getPlayerRank(player.playerId);
    await display.update(display.buildProfile(player, myRankPos, profileIdx));
}
async function goToRanking() {
    currentScreen = 'ranking';
    rankingPage = 0;
    rankingIdx = 0;
    ranking = await supabase.getRanking(50);
    await display.update(display.buildRanking(ranking, rankingPage, rankingIdx));
}
// ─── Quest ────────────────────────────────────────────────────────────────────
async function completeQuest() {
    const q = quests[questIdx];
    if (q.completed)
        return;
    q.completed = true;
    await saveQuests(quests);
    const result = addExp(player, q.expReward, q.attribute);
    player = incrementQuestCount(result.player);
    await savePlayer(player);
    await supabase.upsertPlayer(player);
    const allDone = quests.every(q => q.completed);
    if (result.rankedUp) {
        rankUpIdx = 0;
        currentScreen = 'rankUp';
        pendingRankUp = { oldRank: result.oldRank };
        await display.update(display.buildRankUp(player, result.oldRank, rankUpIdx));
    }
    else if (result.leveledUp) {
        levelIdx = 0;
        currentScreen = 'levelUp';
        pendingLevelUp = { oldLevel: result.oldLevel };
        await display.update(display.buildLevelUp(player, result.oldLevel, levelIdx));
    }
    else if (allDone) {
        allDoneIdx = 0;
        currentScreen = 'allDone';
        await display.update(display.buildAllDoneScreen(allDoneIdx));
    }
    else {
        await goToQuestList();
    }
}
async function undoQuest() {
    const q = quests[questIdx];
    if (!q.completed)
        return;
    q.completed = false;
    await saveQuests(quests);
    // Sottrai EXP guadagnati
    if (player) {
        player = subtractExp(player, q.expReward, q.attribute);
        player.questsCompleted = Math.max(0, player.questsCompleted - 1);
        await savePlayer(player);
        await supabase.upsertPlayer(player);
    }
    detailIdx = 0;
    await display.update(display.buildQuestDetail(quests[questIdx], detailIdx));
}
// ─── Gestione eventi ──────────────────────────────────────────────────────────
function setupEventListener() {
    bridge.onEvenHubEvent(async (event) => {
        const textEvent = event.textEvent;
        const sysEvent = event.sysEvent;
        const activeEvent = textEvent ?? sysEvent;
        if (!activeEvent)
            return;
        if ([
            OsEventTypeList.FOREGROUND_ENTER_EVENT,
            OsEventTypeList.FOREGROUND_EXIT_EVENT,
            OsEventTypeList.ABNORMAL_EXIT_EVENT,
        ].includes(activeEvent.eventType))
            return;
        switch (activeEvent.eventType) {
            case OsEventTypeList.CLICK_EVENT:
            case undefined:
            case 0:
                await handlePress();
                break;
            case OsEventTypeList.DOUBLE_CLICK_EVENT:
                await handleDoublePress();
                break;
            case OsEventTypeList.SCROLL_TOP_EVENT:
                await handleSwipeUp();
                break;
            case OsEventTypeList.SCROLL_BOTTOM_EVENT:
                await handleSwipeDown();
                break;
        }
    });
}
async function handlePress() {
    switch (currentScreen) {
        case 'setup':
            await initialize();
            break;
        case 'nameInput':
            if (inputStep === 'lang') {
                selectedLang = currentChar();
                inputStep = 'name';
                charIdx = 0;
                await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep));
            }
            else if (inputStep === 'privacy') {
                selectedPrivacy = currentChar();
                inputStep = 'name';
                charIdx = 0;
                await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep));
            }
            else if (currentChar() === 'LANG') {
                inputStep = 'lang';
                charIdx = LANGS.indexOf(selectedLang);
                await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep));
            }
            else if (currentChar() === 'PRIV') {
                inputStep = 'privacy';
                charIdx = PRIVACY_OPTIONS.indexOf(selectedPrivacy);
                await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep));
            }
            else if (currentChar() === 'OK' && nameBuffer.trim().length > 0) {
                await confirmSetup();
            }
            else if (currentChar() === 'ESC') {
                if (isChangingName) {
                    isChangingName = false;
                    await goToProfile();
                }
                else {
                    currentScreen = 'setup';
                    await display.update(display.buildSetupScreen());
                }
            }
            else if (nameBuffer.length < 15 && !['OK', 'ESC', 'LANG', 'PRIV'].includes(currentChar())) {
                nameBuffer += currentChar();
                await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep));
            }
            break;
        case 'dailyMessage':
            if (msgIdx === 1) {
                await bridge.shutDownPageContainer(0);
            }
            else {
                await goToQuestList();
            }
            break;
        case 'warning':
            if (warningIdx === 1) {
                await bridge.shutDownPageContainer(0);
            }
            else {
                await goToQuestList();
            }
            break;
        case 'allDone':
            if (allDoneIdx === 1) {
                await goToQuestList();
            }
            else {
                await goToProfile();
            }
            break;
        case 'questList':
            if (questIdx === quests.length + 1) {
                await bridge.shutDownPageContainer(1);
            }
            else if (questIdx === quests.length) {
                await goToProfile();
            }
            else {
                detailIdx = 0;
                currentScreen = 'questDetail';
                await display.update(display.buildQuestDetail(quests[questIdx], detailIdx));
            }
            break;
        case 'questDetail': {
            const q = quests[questIdx];
            if (q.completed) {
                if (detailIdx === 1) {
                    await undoQuest();
                }
                else {
                    await goToQuestList();
                }
            }
            else {
                if (detailIdx === 0) {
                    await completeQuest();
                }
                else {
                    await goToQuestList();
                }
            }
            break;
        }
        case 'levelUp':
            if (levelIdx === 1) {
                await bridge.shutDownPageContainer(0);
            }
            else {
                pendingLevelUp = null;
                if (pendingRankUp) {
                    const r = pendingRankUp.oldRank;
                    pendingRankUp = null;
                    rankUpIdx = 0;
                    currentScreen = 'rankUp';
                    await display.update(display.buildRankUp(player, r, rankUpIdx));
                }
                else {
                    await goToQuestList();
                }
            }
            break;
        case 'rankUp':
            if (rankUpIdx === 1) {
                await bridge.shutDownPageContainer(0);
            }
            else {
                pendingRankUp = null;
                await goToQuestList();
            }
            break;
        case 'profile':
            if (profileIdx === 1) {
                await startChangeName();
            }
            else if (profileIdx === 2) {
                await goToQuestList();
            }
            else {
                await goToRanking();
            }
            break;
        case 'ranking': {
            const itemsPerPage = 4;
            if (rankingIdx === itemsPerPage) {
                await goToProfile();
            }
            break;
        }
    }
}
async function handleDoublePress() {
    if (currentScreen === 'questList') {
        await bridge.shutDownPageContainer(1);
    }
    else {
        await bridge.shutDownPageContainer(0);
    }
}
async function handleSwipeUp() {
    switch (currentScreen) {
        case 'nameInput':
            charIdx = (charIdx - 1 + charsetLen()) % charsetLen();
            await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep));
            break;
        case 'dailyMessage':
            msgIdx = Math.max(0, msgIdx - 1);
            await display.update(display.buildDailyMessage(msgIdx));
            break;
        case 'warning':
            warningIdx = Math.max(0, warningIdx - 1);
            await display.update(display.buildWarningScreen(warningExpLost, warningIdx));
            break;
        case 'allDone':
            allDoneIdx = Math.max(0, allDoneIdx - 1);
            await display.update(display.buildAllDoneScreen(allDoneIdx));
            break;
        case 'questList':
            if (questIdx > 0) {
                questIdx--;
                await refreshQuestList();
            }
            break;
        case 'questDetail':
            if (detailIdx > 0) {
                detailIdx--;
                await display.update(display.buildQuestDetail(quests[questIdx], detailIdx));
            }
            break;
        case 'levelUp':
            levelIdx = Math.max(0, levelIdx - 1);
            await display.update(display.buildLevelUp(player, pendingLevelUp?.oldLevel ?? player.level - 1, levelIdx));
            break;
        case 'rankUp':
            rankUpIdx = Math.max(0, rankUpIdx - 1);
            await display.update(display.buildRankUp(player, pendingRankUp?.oldRank ?? player.rank, rankUpIdx));
            break;
        case 'profile':
            if (profileIdx > 0) {
                profileIdx--;
                await display.update(display.buildProfile(player, myRankPos, profileIdx));
            }
            break;
        case 'ranking':
            if (rankingIdx > 0) {
                rankingIdx--;
                await display.update(display.buildRanking(ranking, rankingPage, rankingIdx));
            }
            else if (rankingPage > 0) {
                rankingPage--;
                rankingIdx = 0;
                await display.update(display.buildRanking(ranking, rankingPage, rankingIdx));
            }
            break;
    }
}
async function handleSwipeDown() {
    switch (currentScreen) {
        case 'nameInput':
            charIdx = (charIdx + 1) % charsetLen();
            await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep));
            break;
        case 'dailyMessage':
            msgIdx = Math.min(1, msgIdx + 1);
            await display.update(display.buildDailyMessage(msgIdx));
            break;
        case 'warning':
            warningIdx = Math.min(1, warningIdx + 1);
            await display.update(display.buildWarningScreen(warningExpLost, warningIdx));
            break;
        case 'allDone':
            allDoneIdx = Math.min(1, allDoneIdx + 1);
            await display.update(display.buildAllDoneScreen(allDoneIdx));
            break;
        case 'questList':
            if (questIdx < quests.length + 1) {
                questIdx++;
                await refreshQuestList();
            }
            break;
        case 'questDetail': {
            const maxIdx = 1;
            if (detailIdx < maxIdx) {
                detailIdx++;
                await display.update(display.buildQuestDetail(quests[questIdx], detailIdx));
            }
            break;
        }
        case 'levelUp':
            levelIdx = Math.min(1, levelIdx + 1);
            await display.update(display.buildLevelUp(player, pendingLevelUp?.oldLevel ?? player.level - 1, levelIdx));
            break;
        case 'rankUp':
            rankUpIdx = Math.min(1, rankUpIdx + 1);
            await display.update(display.buildRankUp(player, pendingRankUp?.oldRank ?? player.rank, rankUpIdx));
            break;
        case 'profile':
            if (profileIdx < 2) {
                profileIdx++;
                await display.update(display.buildProfile(player, myRankPos, profileIdx));
            }
            break;
        case 'ranking': {
            const itemsPerPage = 4;
            const pageItems = ranking.slice(rankingPage * itemsPerPage, (rankingPage + 1) * itemsPerPage);
            if (rankingIdx < pageItems.length) {
                rankingIdx++;
                await display.update(display.buildRanking(ranking, rankingPage, rankingIdx));
            }
            else {
                const totalPages = Math.ceil(ranking.length / itemsPerPage);
                if (rankingPage < totalPages - 1) {
                    rankingPage++;
                    rankingIdx = 0;
                    await display.update(display.buildRanking(ranking, rankingPage, rankingIdx));
                }
            }
            break;
        }
    }
}
main().catch(async (err) => {
    console.error('Errore fatale:', err);
    try {
        await display?.update(display.buildError('Errore di avvio'));
    }
    catch { }
});
