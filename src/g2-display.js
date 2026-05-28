import { TextContainerProperty, ImageContainerProperty, ImageRawDataUpdate, CreateStartUpPageContainer, RebuildPageContainer, TextContainerUpgrade, } from '@evenrealities/even_hub_sdk';
import { getClassAbilityName } from './game-engine';
import { getArtifact } from './artifact-data';
import { t } from './i18n';
import { renderQuestImages, renderWelcomeImage, renderWildQuestImage, IMG_W, IMG_H } from './quest-image';
import { renderArtifactImage, renderClassImage } from './artifact-image';
const W = 576;
const H = 288;
const PAD = 6;
const TEXT_X = IMG_W; // text container starts after image
const TEXT_W = W - IMG_W; // 396px → ~19 chars per line
const SHORT_LINE = '───────────────────'; // fits in narrow text container
const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
export const VERSION = 'v2.0.1';
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
            value: 'it'
        });
        Object.defineProperty(this, "inImageMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "lastImageTemplateId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.bridge = bridge;
    }
    setLang(lang) {
        this.lang = lang;
    }
    async initPage() {
        const content = this.buildBootScreen();
        const container = new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: H,
            borderWidth: 0, borderColor: 5, paddingLength: PAD,
            containerID: 1, containerName: 'main', content, isEventCapture: 1,
        });
        await this.bridge.createStartUpPageContainer(new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [container] }));
        this.lastContent = content;
        await new Promise(r => setTimeout(r, 800));
        this.initialized = true;
    }
    async update(content) {
        if (!this.initialized)
            return;
        if (content === this.lastContent)
            return;
        this.lastContent = content;
        // If coming out of image mode, must rebuild with full-width text container
        if (this.inImageMode) {
            this.inImageMode = false;
            this.lastImageTemplateId = null;
            await this._rebuildFullWidth(content);
            return;
        }
        try {
            await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
                containerID: 1, containerName: 'main',
                content, contentOffset: 0, contentLength: content.length,
            }));
        }
        catch (e) {
            console.error('Update failed, rebuilding page', e);
            await this._rebuildFullWidth(content);
        }
    }
    /** Quest list with Wild Quest card on the left + narrow list on the right */
    async showQuestList(quests, selectedIdx) {
        if (!this.initialized)
            return;
        const content = this.buildQuestListNarrow(quests, selectedIdx);
        await this._renderImageScreen(content, 'wild_quest', () => renderWildQuestImage());
    }
    /** Quest list text for narrow right column (~19 chars/line) */
    buildQuestListNarrow(quests, selectedIdx) {
        const tr = t(this.lang);
        const done = quests.filter(q => q.completed).length;
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        const lines = [
            `QUESTS ${done}/${quests.length}`,
            SHORT_LINE,
        ];
        quests.forEach((q, i) => {
            const status = q.completed ? '●' : '○';
            const name = q.jollyName ?? (tr[q.nameKey] ?? q.nameKey);
            const label = truncate(`${name} ${q.amount}${q.unit}`, 16);
            lines.push(`${c(i)}${status} ${label}`);
        });
        lines.push(SHORT_LINE);
        lines.push(`${c(quests.length)} ★ Profile`);
        lines.push(`${c(quests.length + 1)} ✕ Exit`);
        lines.push('▲/▼  [P]=Seleziona');
        return lines.join('\n');
    }
    /** Show quest detail with real image on the left (180×288) + text on the right */
    async showQuestDetail(q, selectedIdx = 0) {
        if (!this.initialized)
            return;
        const content = this.buildQuestDetailNarrow(q, selectedIdx);
        await this._renderImageScreen(content, q.id, () => renderQuestImages(q.templateId, this._questCardInfo(q)));
    }
    async _rebuildFullWidth(content) {
        await this.bridge.rebuildPageContainer(new RebuildPageContainer({
            containerTotalNum: 1,
            textObject: [new TextContainerProperty({
                    xPosition: 0, yPosition: 0, width: W, height: H,
                    borderWidth: 0, borderColor: 5, paddingLength: PAD,
                    containerID: 1, containerName: 'main', content, isEventCapture: 1,
                })],
        }));
    }
    async _rebuildWithImages(content) {
        return this.bridge.rebuildPageContainer(new RebuildPageContainer({
            containerTotalNum: 3,
            imageObject: [
                new ImageContainerProperty({ xPosition: 0, yPosition: 0, width: IMG_W, height: IMG_H, containerID: 2, containerName: 'img-top' }),
                new ImageContainerProperty({ xPosition: 0, yPosition: IMG_H, width: IMG_W, height: IMG_H, containerID: 3, containerName: 'img-bot' }),
            ],
            textObject: [new TextContainerProperty({
                    xPosition: TEXT_X, yPosition: 0, width: TEXT_W, height: H,
                    borderWidth: 0, borderColor: 5, paddingLength: PAD,
                    containerID: 1, containerName: 'main', content, isEventCapture: 1,
                })],
        }));
    }
    async _sendImages(top, bot) {
        await this.bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: 2, containerName: 'img-top', imageData: top }));
        await this.bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: 3, containerName: 'img-bot', imageData: bot }));
    }
    /** Unified image-screen renderer. The text update is fast and always applied;
     *  the heavy PNG encode (renderImages) runs ONLY when the image actually changes,
     *  so in-screen navigation (swipe) is a text-only update and stays responsive. */
    async _renderImageScreen(content, imageKey, renderImages) {
        if (!this.inImageMode) {
            this.inImageMode = true;
            this.lastContent = content;
            const ok = await this._rebuildWithImages(content);
            if (ok) {
                const [top, bot] = await renderImages();
                await this._sendImages(top, bot);
                this.lastImageTemplateId = imageKey;
            }
            return;
        }
        if (content !== this.lastContent) {
            this.lastContent = content;
            try {
                await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
                    containerID: 1, containerName: 'main',
                    content, contentOffset: 0, contentLength: content.length,
                }));
            }
            catch {
                await this._rebuildWithImages(content);
            }
        }
        if (this.lastImageTemplateId !== imageKey) {
            const [top, bot] = await renderImages();
            await this._sendImages(top, bot);
            this.lastImageTemplateId = imageKey;
        }
    }
    _questCardInfo(q) {
        const tr = t(this.lang);
        const attrKey = 'attr' + q.attribute.charAt(0).toUpperCase() + q.attribute.slice(1);
        const attr = tr[attrKey] ?? q.attribute.toUpperCase();
        return {
            type: q.type === 'jolly' ? 'JOLLY' : q.type.toUpperCase(),
            attr,
            exp: q.expReward,
            amount: q.amount,
            unit: q.unit,
        };
    }
    /** Greeting screen: shows the player's rank card image on the left + message on the right */
    async showDailyMessage(rank, level, selectedIdx = 0) {
        if (!this.initialized)
            return;
        const content = this.buildDailyMessageNarrow(rank, level, selectedIdx);
        await this._renderImageScreen(content, 'welcome_' + rank, () => renderWelcomeImage(rank));
    }
    /** Profile screen: class icon on the left (or rank card if no class) + stats on the right */
    async showProfile(player, rankPosition, selectedIdx = 0) {
        if (!this.initialized)
            return;
        const content = this.buildProfileNarrow(player, rankPosition, selectedIdx);
        const cls = player.playerClass;
        const imageKey = cls ? 'class_' + cls : 'rank_' + player.rank;
        const renderImages = cls
            ? () => renderClassImage(cls)
            : () => renderWelcomeImage(player.rank);
        await this._renderImageScreen(content, imageKey, renderImages);
    }
    /** Narrow greeting text (right of the rank image, ~19 chars/line) */
    buildDailyMessageNarrow(rank, level, selectedIdx = 0) {
        const tr = t(this.lang);
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        return [
            '*** SYSTEM ***',
            SHORT_LINE,
            `RANK ${rank} · LV.${level}`,
            `${tr.newDay}.`,
            SHORT_LINE,
            `${c(0)} Accetta Quest`,
            `${c(1)} Esci`,
            SHORT_LINE,
            '▲/▼  [P]=Seleziona',
        ].join('\n');
    }
    /** Profile text for narrow right column (~19 chars/line). Compact layout, always fits screen. */
    buildProfileNarrow(player, rankPosition, selectedIdx = 0) {
        const tr = t(this.lang);
        const a = player.attributes;
        const rankPos = rankPosition ? `#${rankPosition}` : '-';
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        const name = truncate(player.name, 13);
        const cls = player.playerClass;
        const clsKey = cls ? ('class' + cls.charAt(0).toUpperCase() + cls.slice(1).replace('_', '')) : null;
        const className = cls ? (clsKey && tr[clsKey] ? tr[clsKey] : cls) : '-';
        const artCount = (player.artifacts ?? []).length;
        const artLabel = artCount > 0 ? `Artifacts(${artCount})` : 'Artifacts';
        return [
            `${name} ${rankPos}`,
            `Lv.${player.level} · ${player.rank}`,
            SHORT_LINE,
            `EXP:${player.expCurrent}/${player.expTotal}`,
            `F:${a.str} A:${a.agi} V:${a.vit}`,
            `I:${a.int} E:${a.end} Q:${player.questsCompleted}`,
            `Cls:${truncate(className, 13)}`,
            SHORT_LINE,
            `${c(0)} ${artLabel}`,
            `${c(1)} Ranking`,
            `${c(2)} Name`,
            `${c(3)} Back`,
        ].join('\n');
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
    /** Quest detail for narrow text container (right of image, ~19 chars/line) */
    buildQuestDetailNarrow(q, selectedIdx = 0) {
        const tr = t(this.lang);
        const name = q.jollyName ?? (tr[q.nameKey] ?? q.nameKey);
        const jollyTag = q.type === 'jolly' ? '★ ' : '';
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        return [
            truncate(`${jollyTag}${name.toUpperCase()}`, 18),
            SHORT_LINE,
            `▸ ${q.amount} ${q.unit}`,
            q.completed ? '● COMPLETATA' : '○ IN ATTESA',
            SHORT_LINE,
            q.completed
                ? `${c(0)} Indietro`
                : `${c(0)} Completa`,
            q.completed ? '' : `${c(1)} Indietro`,
            SHORT_LINE,
            '▲/▼  [P]=Seleziona',
        ].filter(l => l !== '').join('\n');
    }
    /** Legacy full-width quest detail (used as fallback if image mode fails) */
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
        const cls = player.playerClass;
        const clsKey = cls ? ('class' + cls.charAt(0).toUpperCase() + cls.slice(1).replace('_', '')) : null;
        const className = cls ? (clsKey && tr[clsKey] ? tr[clsKey] : cls) : '-';
        const abilityName = cls ? getClassAbilityName(cls) : '-';
        return [
            `== ${truncate(player.name, 16)} ${rankPos} ==`,
            `Lv.${player.level}  Rank: ${player.rank}`,
            LINE,
            `EXP: ${player.expCurrent} / ${player.expTotal} total`,
            LINE,
            `${tr.attrFor}:${a.str} ${tr.attrAgi}:${a.agi} ${tr.attrVit}:${a.vit}`,
            `${tr.attrInt}:${a.int} ${tr.attrEnd}:${a.end}  Q:${player.questsCompleted}`,
            `Cls: ${className}  Abi: ${abilityName}`,
            LINE,
            `${c(0)} Global Ranking`,
            `${c(1)} Change Name`,
            `${c(2)} Back`,
        ].join('\n');
    }
    buildRanking(entries, page, selectedIdx, debugError) {
        const itemsPerPage = 4;
        const start = page * itemsPerPage;
        const pageItems = entries.slice(start, start + itemsPerPage);
        const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage));
        const c = (i) => i === selectedIdx ? '▶' : ' ';
        const backIdx = pageItems.length;
        const lines = [
            `== RANKING (${page + 1}/${totalPages}) ==`,
            LINE,
        ];
        if (entries.length === 0) {
            if (debugError === 'not_configured') {
                lines.push(' Err: URL/Key missing');
                lines.push(' Set VITE_SUPABASE_URL');
                lines.push(' in .env and rebuild');
            }
            else if (debugError?.startsWith('http_')) {
                lines.push(` Err: ${debugError}`);
                lines.push(' Check RLS policies');
                lines.push(' or API key in .env');
            }
            else if (debugError === 'network_err') {
                lines.push(' Err: network error');
                lines.push(' Check device Wi-Fi');
            }
            else {
                lines.push(' No connection.');
                lines.push(' Check network');
            }
        }
        else {
            pageItems.forEach((e, i) => {
                const pos = (start + i + 1).toString().padStart(2);
                const name = truncate(e.name, 12);
                lines.push(`${c(i)} ${pos}. ${pad(name, 12)} Lv${e.level} ${e.rank}`);
            });
        }
        lines.push(LINE);
        lines.push(`${c(entries.length === 0 ? 0 : backIdx)} Indietro`);
        lines.push('▲/▼=Nav  [P]=Seleziona');
        return lines.join('\n');
    }
    buildArtifactList(player) {
        const tr = t(this.lang);
        const artifacts = player.artifacts ?? [];
        const lines = [
            `== Artifacts (${artifacts.length}) ==`,
            LINE,
        ];
        if (artifacts.length === 0) {
            lines.push(tr.noArtifacts ?? 'No artifacts yet');
        }
        else {
            for (const id of artifacts) {
                const art = getArtifact(id);
                if (art) {
                    const nameKey = ('artifact' + id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(''));
                    const displayName = tr[nameKey] ?? id;
                    lines.push('· ' + truncate(displayName, 17));
                }
            }
        }
        lines.push(LINE, '▶ Back', '▲/▼  [P]=Indietro');
        return lines.join('\n');
    }
    buildRankingDetail(entry, pos) {
        return [
            `== ${truncate(entry.name, 16)} ==`,
            `#${pos} · ${entry.rank}`,
            LINE,
            `Lv.${entry.level}`,
            `EXP: ${entry.expTotal}`,
            `Quests: ${entry.questsCompleted}`,
            LINE,
            `▶ Back`,
            '[P]=Indietro',
        ].join('\n');
    }
    async showArtifactReward(artifactId) {
        if (!this.initialized)
            return;
        const content = this.buildArtifactRewardNarrow(artifactId);
        await this._renderImageScreen(content, 'artifact_' + artifactId, () => renderArtifactImage(artifactId));
    }
    buildArtifactRewardNarrow(artifactId) {
        const tr = t(this.lang);
        const nameKey = ('artifact' + artifactId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(''));
        const displayName = tr[nameKey] ?? artifactId;
        return [
            '★ ' + tr.jollyReward,
            SHORT_LINE,
            '',
            tr.artifact + ':',
            truncate(displayName, 18),
            '',
            SHORT_LINE,
            tr.pressToContinue,
        ].join('\n');
    }
    buildArtifactReward(artifactId) {
        const tr = t(this.lang);
        const nameKey = ('artifact' + artifactId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(''));
        const displayName = tr[nameKey] ?? artifactId;
        return [
            '╔══ ' + tr.jollyReward + ' ══╗',
            '║',
            `║  ${tr.artifact} ottenuto!`,
            '║',
            `║  ${truncate(displayName, 20)}`,
            '║',
            '╚══════════════════════════╝',
            tr.pressToContinue,
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
