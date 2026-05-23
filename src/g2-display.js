import { TextContainerProperty, CreateStartUpPageContainer, ImageContainerProperty, ImageRawDataUpdate, TextContainerUpgrade, RebuildPageContainer, } from '@evenrealities/even_hub_sdk';
import { t } from './i18n';
import { ICONS } from './assets';
const W = 576;
const H = 288;
const PAD = 6;
const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
export const VERSION = 'v1.5.1';
function truncate(text, maxLen) {
    if (!text)
        return '';
    // Since the font is non-monospaced, we use a conservative limit
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen - 1) + '…';
}
function pad(text, len) {
    // Pad with spaces, but note that spaces are thin in the G2 font
    return text.length >= len ? text.slice(0, len) : text + ' '.repeat(len - text.length);
}
const BRIDGE_TIMEOUT = 2500;
export class G2Display {
    constructor(bridge) {
        Object.defineProperty(this, "bridge", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "initialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "lastContent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "lang", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'en'
        });
        Object.defineProperty(this, "currentIcon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.bridge = bridge;
        try {
            this.canvas = document.createElement('canvas');
            if (this.canvas) {
                this.canvas.width = 64;
                this.canvas.height = 64;
            }
        }
        catch (e) {
            console.warn('Canvas not supported in this environment', e);
            this.canvas = null;
        }
    }
    setLang(lang) {
        this.lang = lang;
    }
    getIconAsRaw4Bit(iconName) {
        if (!this.canvas)
            return null;
        const draw = ICONS[iconName];
        if (!draw)
            return null;
        try {
            const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx)
                return null;
            ctx.clearRect(0, 0, 64, 64);
            // Set a black background explicitly (0 in G2 is off)
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 64, 64);
            draw(ctx);
            const imgData = ctx.getImageData(0, 0, 64, 64).data;
            const raw = [];
            for (let i = 0; i < 4096; i += 2) {
                // Pixel 1
                const r1 = imgData[i * 4];
                const g1 = imgData[i * 4 + 1];
                const b1 = imgData[i * 4 + 2];
                // Use perceived luminance for better greyscale
                const lum1 = (r1 * 0.299 + g1 * 0.587 + b1 * 0.114);
                const gray1 = Math.min(15, Math.floor(lum1 / 16));
                // Pixel 2
                const r2 = imgData[(i + 1) * 4];
                const g2 = imgData[(i + 1) * 4 + 1];
                const b2 = imgData[(i + 1) * 4 + 2];
                const lum2 = (r2 * 0.299 + g2 * 0.587 + b2 * 0.114);
                const gray2 = Math.min(15, Math.floor(lum2 / 16));
                // High nibble: Pixel 1, Low nibble: Pixel 2
                raw.push(((gray1 & 0x0F) << 4) | (gray2 & 0x0F));
            }
            return raw;
        }
        catch (e) {
            console.error('[G2Display] Failed to generate raw 4-bit icon', e);
            return null;
        }
    }
    async initPage() {
        console.log('[G2Display] initPage started');
        const content = this.buildBootScreen();
        const textContainer = new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: H,
            borderWidth: 0, borderColor: 5, paddingLength: PAD,
            containerID: 1, containerName: 'main', content, isEventCapture: 1,
        });
        const imageContainer = new ImageContainerProperty({
            xPosition: 480, yPosition: 20, width: 64, height: 64,
            containerID: 2, containerName: 'icon'
        });
        console.log('[G2Display] Creating start up page containers...');
        try {
            const startUpContainer = new CreateStartUpPageContainer({
                containerTotalNum: 2,
                textObject: [textContainer],
                imageObject: [imageContainer]
            });
            const result = await Promise.race([
                this.bridge.createStartUpPageContainer(startUpContainer),
                new Promise((_, reject) => setTimeout(() => reject(new Error('initPage timeout')), 5000))
            ]);
            console.log('[G2Display] createStartUpPageContainer result:', result);
        }
        catch (e) {
            console.error('[G2Display] createStartUpPageContainer failed:', e);
            throw e;
        }
        this.lastContent = content;
        await new Promise(r => setTimeout(r, 800));
        this.initialized = true;
        console.log('[G2Display] initPage completed');
    }
    async update(content) {
        if (!this.initialized) {
            console.warn('[G2Display] Update called before initialization');
            return;
        }
        if (content === this.lastContent)
            return;
        this.lastContent = content;
        console.log('[G2Display] Updating content...');
        try {
            const upgrade = new TextContainerUpgrade({
                containerID: 1,
                containerName: 'main',
                content: content,
                contentOffset: 0,
                contentLength: content.length
            });
            await Promise.race([
                this.bridge.textContainerUpgrade(upgrade),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Update timeout')), BRIDGE_TIMEOUT))
            ]);
        }
        catch (e) {
            console.warn('Update failed or timed out, rebuilding page', e);
            const textContainer = new TextContainerProperty({
                xPosition: 0, yPosition: 0, width: W, height: H,
                borderWidth: 0, borderColor: 5, paddingLength: PAD,
                containerID: 1, containerName: 'main', content, isEventCapture: 1,
            });
            const rebuild = new RebuildPageContainer({
                containerTotalNum: 1,
                textObject: [textContainer]
            });
            try {
                await Promise.race([
                    this.bridge.rebuildPageContainer(rebuild),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Rebuild timeout')), BRIDGE_TIMEOUT))
                ]);
            }
            catch (reErr) {
                console.error('Rebuild also failed:', reErr);
            }
        }
    }
    async updateImage(iconName) {
        if (!this.initialized) {
            console.warn('[G2Display] updateImage called before initialization');
            return;
        }
        if (iconName === this.currentIcon)
            return;
        console.log('[G2Display] Updating image to:', iconName);
        const rawData = this.getIconAsRaw4Bit(iconName);
        if (!rawData) {
            console.warn('[G2Display] Could not get raw data for icon:', iconName);
            return;
        }
        try {
            const update = new ImageRawDataUpdate({
                containerID: 2,
                containerName: 'icon',
                imageData: rawData
            });
            // Timeout di 2 secondi per l'aggiornamento immagine
            await Promise.race([
                this.bridge.updateImageRawData(update),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Image update timeout')), 2000))
            ]);
            this.currentIcon = iconName;
            console.log('[G2Display] Image updated successfully.');
        }
        catch (e) {
            console.error('[G2Display] Image update failed:', e);
        }
    }
    buildBootScreen() {
        const tr = t(this.lang);
        return [
            '╭──────────────────────────╮',
            '│    o──|─[ G2 SYSTEM ]─|──▶  │',
            `│   ${pad(tr.systemBoot, 18)}   │`,
            '╰──────────────────────────╯',
            ' Connecting…',
            ` ${VERSION}`,
        ].join('\n');
    }
    buildSetupScreen() {
        const tr = t(this.lang);
        return [
            '╭──────────────────────────╮',
            '│    o──|─[ G2 SYSTEM ]─|──▶  │',
            '│       ARISE, PLAYER      │',
            '╰──────────────────────────╯',
            ` ${truncate(tr.setupInstructions, 26)}`,
            LINE,
            ` ${tr.pressToStart}`,
            ` ${VERSION}`,
        ].join('\n');
    }
    buildNameInput(nameBuffer, currentChar, lang, privacy, inputStep) {
        const tr = t(this.lang);
        if (inputStep === 'lang') {
            return [
                '╭──────────────────────────╮',
                '│    o──|─[ G2 SYSTEM ]─|──▶  │',
                `│    ${pad(tr.selectLanguage, 18)}    │`,
                '╰──────────────────────────╯',
                ` ▶ ${currentChar.toUpperCase()}`,
                LINE,
                ' ▲/▼=Change  PRESS=Confirm',
                ' 2x=Cancel',
            ].join('\n');
        }
        if (inputStep === 'privacy') {
            return [
                '╭──────────────────────────╮',
                '│    o──|─[ G2 SYSTEM ]─|──▶  │',
                `│    ${pad(tr.selectPrivacy, 18)}    │`,
                '╰──────────────────────────╯',
                ` ▶ ${currentChar.charAt(0).toUpperCase() + currentChar.slice(1)}`,
                LINE,
                ` ${tr.privacyPublic}`,
                ` ${tr.privacyAnon}`,
                ` ${tr.privacyPrivate}`,
                LINE,
                ' ▲/▼=Change  PRESS=Confirm',
            ].join('\n');
        }
        const disp = nameBuffer + '[' + currentChar + ']';
        return [
            '╭──────────────────────────╮',
            '│    o──|─[ G2 SYSTEM ]─|──▶  │',
            `│    ${pad(tr.enterName, 18)}    │`,
            '╰──────────────────────────╯',
            ' ' + disp,
            ` Lang:${lang.toUpperCase()}  Priv:${privacy.slice(0, 3).toUpperCase()}`,
            LINE,
            ' ▲/▼=Letter  PRESS=Add',
            ' [LANG] [PRIV] [OK] [ESC]',
        ].join('\n');
    }
    buildDailyMessage(selectedIdx = 0) {
        const tr = t(this.lang);
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        return [
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '   *** SYSTEM MESSAGE ***',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ` ${tr.newDay}.`,
            ` ${tr.questsAwait}.`,
            LINE,
            `${c(0)} Accept Quests`,
            `${c(1)} Exit App`,
            LINE,
            '▲/▼=Nav  [PRESS]=Select',
        ].join('\n');
    }
    buildWarningScreen(expLost, selectedIdx = 0) {
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        return [
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '      *** WARNING ***',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ' You missed a quest.',
            ` Penalty: -${expLost} EXP`,
            LINE,
            ' Prove your worth today.',
            LINE,
            `${c(0)} Continue to Quests`,
            `${c(1)} Exit App`,
            LINE,
            '▲/▼=Nav  [PRESS]=Select',
        ].join('\n');
    }
    buildAllDoneScreen(selectedIdx = 0) {
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        return [
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '       *** SYSTEM ***',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ' All quests completed!',
            ' Well done, Player.',
            ' New quests tomorrow.',
            LINE,
            `${c(0)} View Profile`,
            `${c(1)} Back to Quests`,
            LINE,
            '▲/▼=Nav  [PRESS]=Select',
        ].join('\n');
    }
    buildQuestList(quests, selectedIdx) {
        const tr = t(this.lang);
        const done = quests.filter(q => q.completed).length;
        const lines = [
            `== QUESTS (${done}/${quests.length}) ==`,
            LINE,
        ];
        quests.forEach((q, i) => {
            const cursor = i === selectedIdx ? '▶' : ' ';
            const status = q.completed ? '●' : '○';
            const name = q.jollyName ?? (tr[q.nameKey] ?? q.nameKey);
            const label = `${name} ${q.amount}${q.unit}`;
            lines.push(`${cursor}${status} ${truncate(label, 24)}`);
        });
        const profileCursor = selectedIdx === quests.length ? '▶' : ' ';
        lines.push(`${profileCursor}★ PROFILE`);
        const exitCursor = selectedIdx === quests.length + 1 ? '▶' : ' ';
        lines.push(`${exitCursor}✕ EXIT`);
        lines.push(LINE);
        lines.push('▲/▼=Nav  [PRESS]=Select');
        return lines.join('\n');
    }
    buildQuestDetail(q, selectedIdx = 0) {
        const tr = t(this.lang);
        const name = q.jollyName ?? (tr[q.nameKey] ?? q.nameKey);
        const attrKey = 'attr' + q.attribute.charAt(0).toUpperCase() + q.attribute.slice(1);
        const attr = tr[attrKey] ?? q.attribute.toUpperCase();
        const status = q.completed ? '● DONE' : '○ PENDING';
        const jollyTag = q.type === 'jolly' ? '★ JOLLY ' : '';
        const nameMax = jollyTag ? 18 : 26;
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        return [
            `== QUEST ==`,
            LINE,
            `${jollyTag}${truncate(name.toUpperCase(), nameMax)}`,
            `Target: ${q.amount} ${q.unit}`,
            `Attr: ${attr}   EXP: +${q.expReward}`,
            `Status: ${status}`,
            LINE,
            q.completed
                ? `${c(0)} Back to Quests`
                : `${c(0)} Mark as Done`,
            q.completed ? '' : `${c(1)} Back to Quests`,
            LINE,
            '▲/▼=Nav  [PRESS]=Select',
        ].filter(l => l !== '').join('\n');
    }
    buildLevelUp(player, oldLevel, selectedIdx = 0) {
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        return [
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '    *** LEVEL UP! ***',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ` Lv.${oldLevel}  ──▶  Lv.${player.level}`,
            ` Rank: ${player.rank}`,
            ` Player: ${truncate(player.name, 18)}`,
            LINE,
            `${c(0)} Continue`,
            `${c(1)} Back to Quests`,
            LINE,
            '▲/▼=Nav  [PRESS]=Select',
        ].join('\n');
    }
    buildRankUp(player, oldRank, selectedIdx = 0) {
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        return [
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '     *** RANK UP! ***',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ` Rank ${oldRank}  ──▶  Rank ${player.rank}`,
            ` Level: ${player.level}`,
            ` Player: ${truncate(player.name, 18)}`,
            LINE,
            `${c(0)} Continue`,
            `${c(1)} Back to Quests`,
            LINE,
            '▲/▼=Nav  [PRESS]=Select',
        ].join('\n');
    }
    buildProfile(player, rankPosition, selectedIdx = 0) {
        const tr = t(this.lang);
        const a = player.attributes;
        const rankPos = rankPosition ? `#${rankPosition}` : '-';
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        return [
            `== ${truncate(player.name, 16)} ${rankPos} ==`,
            `Lv.${player.level}  Rank: ${player.rank}`,
            LINE,
            `EXP: ${player.expCurrent} / ${player.expTotal} total`,
            LINE,
            `${tr.attrFor}:${a.str} ${tr.attrAgi}:${a.agi} ${tr.attrVit}:${a.vit}`,
            `${tr.attrInt}:${a.int} ${tr.attrEnd}:${a.end}  Q:${player.questsCompleted}`,
            LINE,
            `${c(0)} Global Ranking`,
            `${c(1)} Change Name`,
            `${c(2)} Back`,
        ].join('\n');
    }
    buildRanking(entries, page, selectedIdx = 0) {
        const itemsPerPage = 4;
        const start = page * itemsPerPage;
        const pageItems = entries.slice(start, start + itemsPerPage);
        const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage));
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        const lines = [
            `== RANKING (${page + 1}/${totalPages}) ==`,
            LINE,
        ];
        pageItems.forEach((e, i) => {
            const pos = (start + i + 1).toString().padStart(2);
            const name = truncate(e.name, 10);
            const cursor = i === selectedIdx ? '▶' : ' ';
            const rank = e.rank.slice(0, 3).toUpperCase();
            lines.push(`${cursor}${pos}.${pad(name, 10)} L${e.level} ${rank}`);
        });
        lines.push(LINE);
        lines.push(`${c(itemsPerPage)} Back to Profile`);
        lines.push(LINE);
        lines.push('▲/▼=Nav  [PRESS]=Select');
        return lines.join('\n');
    }
    buildLoadingScreen() {
        return [
            '╭──────────────────────────╮',
            '│    o──|─[ G2 SYSTEM ]─|──▶  │',
            '│       LOADING DATA       │',
            '╰──────────────────────────╯',
            '',
            ' Connecting to Hub...',
            ' Please wait...',
        ].join('\n');
    }
    buildError(message) {
        return [
            '╭──────────────────────────╮',
            '│        !! ERROR !!       │',
            '╰──────────────────────────╯',
            '',
            truncate(message, 28),
            LINE,
            '[PRESS] Retry',
        ].join('\n');
    }
}
