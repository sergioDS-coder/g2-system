import {
  TextContainerProperty,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'

import type { PlayerProfile, Rank, ClassType } from './game-engine'
import { getClassAbilityName } from './game-engine'
import { type ArtifactId, getArtifact } from './artifact-data'
import type { DailyQuest } from './quest-data'
import type { RankingEntry } from './supabase-client'
import type { Lang } from './i18n'
import { t } from './i18n'
import { renderQuestImages, renderWelcomeImage, type QuestCardInfo, IMG_W, IMG_H } from './quest-image'
import { renderArtifactImage, renderClassImage, ART_IMG_W, ART_IMG_H } from './artifact-image'

const W = 576
const H = 288
const PAD = 6
const TEXT_X = IMG_W        // text container starts after image
const TEXT_W = W - IMG_W    // 396px → ~19 chars per line
const SHORT_LINE = '───────────────────'  // fits in narrow text container
const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
export const VERSION = 'v2.0.1'


function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

function pad(text: string, len: number): string {
  return text.length >= len ? text.slice(0, len) : text + ' '.repeat(len - text.length)
}

export class G2Display {
  private bridge: EvenAppBridge
  private initialized = false
  private lastContent = ''
  private lang: Lang = 'it'
  private inImageMode = false
  private lastImageTemplateId: string | null = null

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge
  }

  setLang(lang: Lang): void {
    this.lang = lang
  }

  async initPage(): Promise<void> {
    const content = this.buildBootScreen()
    const container = new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: W, height: H,
      borderWidth: 0, borderColor: 5, paddingLength: PAD,
      containerID: 1, containerName: 'main', content, isEventCapture: 1,
    })
    await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [container] })
    )
    this.lastContent = content
    await new Promise(r => setTimeout(r, 800))
    this.initialized = true
  }

  async update(content: string): Promise<void> {
    if (!this.initialized || content === this.lastContent) return
    this.lastContent = content

    // If coming out of image mode, must rebuild with full-width text container
    if (this.inImageMode) {
      this.inImageMode = false
      this.lastImageTemplateId = null
      await this._rebuildFullWidth(content)
      return
    }

    try {
      await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
        containerID: 1, containerName: 'main',
        content, contentOffset: 0, contentLength: content.length,
      }))
    } catch (e) {
      console.error('Update failed, rebuilding page', e)
      await this._rebuildFullWidth(content)
    }
  }

  /** Show quest detail with real image on the left (180×288) + text on the right */
  async showQuestDetail(q: DailyQuest, selectedIdx = 0): Promise<void> {
    if (!this.initialized) return
    const content = this.buildQuestDetailNarrow(q, selectedIdx)
    const [topData, botData] = await renderQuestImages(q.templateId, this._questCardInfo(q))

    if (!this.inImageMode) {
      this.inImageMode = true
      this.lastContent = content
      const ok = await this._rebuildWithImages(content)
      if (ok) {
        const [r1, r2] = await this._sendImages(topData, botData)
        this.lastImageTemplateId = q.id
        await this._showImgDiag(content, r1, r2, topData.length, botData.length)
      }
    } else {
      if (content !== this.lastContent) {
        this.lastContent = content
        try {
          await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
            containerID: 1, containerName: 'main',
            content, contentOffset: 0, contentLength: content.length,
          }))
        } catch {
          await this._rebuildWithImages(content)
        }
      }
      if (this.lastImageTemplateId !== q.id) {
        const [r1, r2] = await this._sendImages(topData, botData)
        this.lastImageTemplateId = q.id
        await this._showImgDiag(content, r1, r2, topData.length, botData.length)
      }
    }
  }

  private async _rebuildFullWidth(content: string): Promise<void> {
    await this.bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: 1,
      textObject: [new TextContainerProperty({
        xPosition: 0, yPosition: 0, width: W, height: H,
        borderWidth: 0, borderColor: 5, paddingLength: PAD,
        containerID: 1, containerName: 'main', content, isEventCapture: 1,
      })],
    }))
  }

  private async _rebuildWithImages(content: string): Promise<boolean> {
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
    }))
  }

  private async _sendImages(top: number[], bot: number[]): Promise<[ImageRawDataUpdateResult, ImageRawDataUpdateResult]> {
    const r1 = await this.bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: 2, containerName: 'img-top', imageData: top }))
    const r2 = await this.bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: 3, containerName: 'img-bot', imageData: bot }))
    return [r1, r2]
  }

  /** Appends image-send diagnostic to the text panel so we can read it on the glasses. */
  private async _showImgDiag(
    content: string,
    r1: ImageRawDataUpdateResult, r2: ImageRawDataUpdateResult,
    len1: number, len2: number,
  ): Promise<void> {
    const code = (r: ImageRawDataUpdateResult) =>
      ImageRawDataUpdateResult.isSuccess(r) ? 'OK' :
      ImageRawDataUpdateResult.isImageSizeInvalid(r) ? 'SIZE' :
      ImageRawDataUpdateResult.isImageToGray4Failed(r) ? 'GRAY4' :
      ImageRawDataUpdateResult.isSendFailed(r) ? 'SEND' : 'ERR'
    const kb = (n: number) => (n / 1024).toFixed(1)
    const diag = `${content}\n─\nIMG:${code(r1)} ${code(r2)}\n${kb(len1)}+${kb(len2)}KB`
    this.lastContent = diag
    try {
      await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
        containerID: 1, containerName: 'main',
        content: diag, contentOffset: 0, contentLength: diag.length,
      }))
    } catch { /* ignore */ }
  }

  private _questCardInfo(q: DailyQuest): QuestCardInfo {
    const tr = t(this.lang)
    const attrKey = 'attr' + q.attribute.charAt(0).toUpperCase() + q.attribute.slice(1)
    const attr = (tr as any)[attrKey] ?? q.attribute.toUpperCase()
    return {
      type: q.type === 'jolly' ? 'JOLLY' : q.type.toUpperCase(),
      attr,
      exp: q.expReward,
      amount: q.amount,
      unit: q.unit,
    }
  }

  /** Greeting screen: shows the player's rank card image on the left + message on the right */
  async showDailyMessage(rank: Rank, level: number, selectedIdx = 0): Promise<void> {
    if (!this.initialized) return
    const content = this.buildDailyMessageNarrow(rank, level, selectedIdx)
    const imgs = await renderWelcomeImage(rank)

    const imageKey = 'welcome_' + rank
    if (!this.inImageMode) {
      this.inImageMode = true
      this.lastContent = content
      const ok = await this._rebuildWithImages(content)
      if (ok) {
        const [r1, r2] = await this._sendImages(imgs[0], imgs[1])
        this.lastImageTemplateId = imageKey
        await this._showImgDiag(content, r1, r2, imgs[0].length, imgs[1].length)
      }
    } else {
      if (content !== this.lastContent) {
        this.lastContent = content
        try {
          await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
            containerID: 1, containerName: 'main',
            content, contentOffset: 0, contentLength: content.length,
          }))
        } catch {
          await this._rebuildWithImages(content)
        }
      }
      if (this.lastImageTemplateId !== imageKey) {
        const [r1, r2] = await this._sendImages(imgs[0], imgs[1])
        this.lastImageTemplateId = imageKey
        await this._showImgDiag(content, r1, r2, imgs[0].length, imgs[1].length)
      }
    }
  }

  /** Profile screen: class icon on the left (or rank card if no class) + stats on the right */
  async showProfile(player: PlayerProfile, rankPosition: number | null, selectedIdx = 0, page = 0): Promise<void> {
    if (!this.initialized) return
    const content = this.buildProfileNarrow(player, rankPosition, selectedIdx, page)

    let topData: number[]
    let botData: number[]
    let imageKey: string

    if (player.playerClass) {
      const classImg = await renderClassImage(player.playerClass)
      topData = classImg.slice(0, ART_IMG_W * (ART_IMG_H / 2))
      botData = classImg.slice(ART_IMG_W * (ART_IMG_H / 2))
      imageKey = 'class_' + player.playerClass
    } else {
      const rankImgs = await renderWelcomeImage(player.rank)
      topData = rankImgs[0]
      botData = rankImgs[1]
      imageKey = 'rank_' + player.rank
    }

    if (!this.inImageMode) {
      this.inImageMode = true
      this.lastContent = content
      const ok = await this._rebuildWithImages(content)
      if (ok) {
        const [r1, r2] = await this._sendImages(topData, botData)
        this.lastImageTemplateId = imageKey
        await this._showImgDiag(content, r1, r2, topData.length, botData.length)
      }
    } else {
      if (content !== this.lastContent) {
        this.lastContent = content
        try {
          await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
            containerID: 1, containerName: 'main',
            content, contentOffset: 0, contentLength: content.length,
          }))
        } catch {
          await this._rebuildWithImages(content)
        }
      }
      if (this.lastImageTemplateId !== imageKey) {
        const [r1, r2] = await this._sendImages(topData, botData)
        this.lastImageTemplateId = imageKey
        await this._showImgDiag(content, r1, r2, topData.length, botData.length)
      }
    }
  }

  /** Narrow greeting text (right of the rank image, ~19 chars/line) */
  buildDailyMessageNarrow(rank: Rank, level: number, selectedIdx = 0): string {
    const tr = t(this.lang)
    const c = (i: number) => i === selectedIdx ? '▶' : ' '
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
    ].join('\n')
  }

  /** Profile text for narrow right column (~19 chars/line).
   *  page=0: stats + class/ability  |  page=1: artifacts list */
  buildProfileNarrow(player: PlayerProfile, rankPosition: number | null, selectedIdx = 0, page = 0): string {
    const tr = t(this.lang)
    const a = player.attributes
    const rankPos = rankPosition ? `#${rankPosition}` : '-'
    const c = (i: number) => i === selectedIdx ? '▶' : ' '
    const name = truncate(player.name, 13)

    const cls = player.playerClass
    const clsKey = cls ? ('class' + cls.charAt(0).toUpperCase() + cls.slice(1).replace('_', '')) as keyof typeof tr : null
    const className = cls ? (clsKey && (tr as any)[clsKey] ? (tr as any)[clsKey] : cls) : '-'
    const abilityName = cls ? getClassAbilityName(cls) : '-'

    if (page === 1) {
      const artifacts = player.artifacts ?? []
      const artifactLines: string[] = []
      if (artifacts.length === 0) {
        artifactLines.push(tr.noArtifacts)
      } else {
        for (const id of artifacts) {
          const a2 = getArtifact(id)
          if (a2) {
            const nameKey = ('artifact' + id.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')) as keyof typeof tr
            const displayName = (tr as any)[nameKey] ?? id
            artifactLines.push(truncate(displayName, 18))
          }
        }
      }
      return [
        `${name} ${rankPos}`,
        `── ${tr.artifact} ──`,
        SHORT_LINE,
        ...artifactLines.slice(0, 6),
        SHORT_LINE,
        `▶ Back`,
      ].join('\n')
    }

    // page === 0: stats + class/ability
    return [
      `${name} ${rankPos}`,
      `Lv.${player.level} · ${player.rank}`,
      SHORT_LINE,
      `EXP:${player.expCurrent}/${player.expTotal}`,
      `${tr.attrFor}:${a.str} ${tr.attrAgi}:${a.agi} ${tr.attrVit}:${a.vit}`,
      `${tr.attrInt}:${a.int} ${tr.attrEnd}:${a.end} Q:${player.questsCompleted}`,
      `Cls:${truncate(className, 9)} ${truncate(abilityName, 7)}`,
      SHORT_LINE,
      `${c(0)} Ranking`,
      `${c(1)} Artifacts`,
      `${c(2)} Name`,
      `${c(3)} Back`,
    ].join('\n')
  }

  buildBootScreen(): string {
    return [
      '╭──────────────────────────╮',
      '│    o──|─[ G2 SYSTEM ]─|──▶  │',
      '│       ARISE, PLAYER      │',
      '╰──────────────────────────╯',
      ' Connecting…',
      ` ${VERSION}`,
    ].join('\n')
  }

  buildSetupScreen(): string {
    return [
      '╭──────────────────────────╮',
      '│    o──|─[ G2 SYSTEM ]─|──▶  │',
      '│       ARISE, PLAYER      │',
      '╰──────────────────────────╯',
      ' Enter your name below',
      ' using the touchpad.',
      LINE,
      ' [PRESS] Begin',
      ` ${VERSION}`,
    ].join('\n')
  }

  buildNameInput(nameBuffer: string, currentChar: string, lang: string, privacy: string, inputStep: string): string {
    if (inputStep === 'lang') {
      return [
        '╭──────────────────────────╮',
        '│    o──|─[ G2 SYSTEM ]─|──▶  │',
        '│     Select language:     │',
        '╰──────────────────────────╯',
        ` ▶ ${currentChar.toUpperCase()}`,
        LINE,
        ' ▲/▼=Change  PRESS=Confirm',
        ' 2x=Cancel',
      ].join('\n')
    }
    if (inputStep === 'privacy') {
      return [
        '╭──────────────────────────╮',
        '│    o──|─[ G2 SYSTEM ]─|──▶  │',
        '│ Select ranking privacy:  │',
        '╰──────────────────────────╯',
        ` ▶ ${currentChar.charAt(0).toUpperCase() + currentChar.slice(1)}`,
        LINE,
        ' Public: real name shown',
        ' Anonymous: name hidden',
        ' Private: not in ranking',
        LINE,
        ' ▲/▼=Change  PRESS=Confirm',
      ].join('\n')
    }
    const disp = nameBuffer + '[' + currentChar + ']'
    return [
      '╭──────────────────────────╮',
      '│    o──|─[ G2 SYSTEM ]─|──▶  │',
      '│    Enter player name:    │',
      '╰──────────────────────────╯',
      ' ' + disp,
      ` Lang:${lang.toUpperCase()}  Priv:${privacy.slice(0, 3).toUpperCase()}`,
      LINE,
      ' ▲/▼=Letter  PRESS=Add',
      ' [LANG] [PRIV] [OK] [ESC]',
    ].join('\n')
  }

  buildDailyMessage(selectedIdx = 0): string {
    const tr = t(this.lang)
    const c = (i: number) => i === selectedIdx ? '▶' : ' '
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
    ].join('\n')
  }

  buildWarningScreen(expLost: number, selectedIdx = 0): string {
    const c = (i: number) => i === selectedIdx ? '▶' : ' '
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
    ].join('\n')
  }

  buildAllDoneScreen(selectedIdx = 0): string {
    const c = (i: number) => i === selectedIdx ? '▶' : ' '
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
    ].join('\n')
  }

  buildQuestList(quests: DailyQuest[], selectedIdx: number): string {
    const tr = t(this.lang)
    const done = quests.filter(q => q.completed).length
    const lines: string[] = [
      `== QUESTS (${done}/${quests.length}) ==`,
      LINE,
    ]

    quests.forEach((q, i) => {
      const cursor = i === selectedIdx ? '▶' : ' '
      const status = q.completed ? '●' : '○'
      const name = q.jollyName ?? ((tr as any)[q.nameKey] ?? q.nameKey)
      const label = `${name} ${q.amount}${q.unit}`
      lines.push(`${cursor}${status} ${truncate(label, 24)}`)
    })

    const profileCursor = selectedIdx === quests.length ? '▶' : ' '
    lines.push(`${profileCursor}★ PROFILE`)

    const exitCursor = selectedIdx === quests.length + 1 ? '▶' : ' '
    lines.push(`${exitCursor}✕ EXIT`)

    lines.push(LINE)
    lines.push('▲/▼=Nav  [PRESS]=Select')
    return lines.join('\n')
  }

  /** Quest detail for narrow text container (right of image, ~19 chars/line) */
  buildQuestDetailNarrow(q: DailyQuest, selectedIdx = 0): string {
    const tr = t(this.lang)
    const name = q.jollyName ?? ((tr as any)[q.nameKey] ?? q.nameKey)
    const jollyTag = q.type === 'jolly' ? '★ ' : ''
    const c = (i: number) => i === selectedIdx ? '▶' : ' '

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
    ].filter(l => l !== '').join('\n')
  }

  /** Legacy full-width quest detail (used as fallback if image mode fails) */
  buildQuestDetail(q: DailyQuest, selectedIdx = 0): string {
    const tr = t(this.lang)
    const name = q.jollyName ?? ((tr as any)[q.nameKey] ?? q.nameKey)
    const attrKey = 'attr' + q.attribute.charAt(0).toUpperCase() + q.attribute.slice(1)
    const attr = (tr as any)[attrKey] ?? q.attribute.toUpperCase()
    const status = q.completed ? '● DONE' : '○ PENDING'
    const jollyTag = q.type === 'jolly' ? '★ JOLLY ' : ''
    const c = (i: number) => i === selectedIdx ? '▶' : ' '

    return [
      `== QUEST ==`,
      LINE,
      `${jollyTag}${truncate(name.toUpperCase(), 26)}`,
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
    ].filter(l => l !== '').join('\n')
  }

  buildLevelUp(player: PlayerProfile, oldLevel: number, selectedIdx = 0): string {
    const c = (i: number) => i === selectedIdx ? '▶' : ' '
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
    ].join('\n')
  }

  buildRankUp(player: PlayerProfile, oldRank: Rank, selectedIdx = 0): string {
    const c = (i: number) => i === selectedIdx ? '▶' : ' '
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
    ].join('\n')
  }

  buildProfile(player: PlayerProfile, rankPosition: number | null, selectedIdx = 0): string {
    const tr = t(this.lang)
    const a = player.attributes
    const rankPos = rankPosition ? `#${rankPosition}` : '-'
    const c = (i: number) => i === selectedIdx ? '▶' : ' '

    const cls = player.playerClass
    const clsKey = cls ? ('class' + cls.charAt(0).toUpperCase() + cls.slice(1).replace('_', '')) as keyof typeof tr : null
    const className = cls ? (clsKey && (tr as any)[clsKey] ? (tr as any)[clsKey] : cls) : '-'
    const abilityName = cls ? getClassAbilityName(cls) : '-'

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
    ].join('\n')
  }

  buildRanking(entries: RankingEntry[], page: number, debugError?: string | null): string {
    const itemsPerPage = 4
    const start = page * itemsPerPage
    const pageItems = entries.slice(start, start + itemsPerPage)
    const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage))

    const lines: string[] = [
      `== RANKING (${page + 1}/${totalPages}) ==`,
      LINE,
    ]

    if (entries.length === 0) {
      if (debugError === 'not_configured') {
        lines.push(' Err: URL/Key missing')
        lines.push(' Set VITE_SUPABASE_URL')
        lines.push(' in .env and rebuild')
      } else if (debugError?.startsWith('http_')) {
        lines.push(` Err: ${debugError}`)
        lines.push(' Check RLS policies')
        lines.push(' or API key in .env')
      } else if (debugError === 'network_err') {
        lines.push(' Err: network error')
        lines.push(' Check device Wi-Fi')
      } else {
        lines.push(' No connection.')
        lines.push(' Check network')
      }
    } else {
      pageItems.forEach((e, i) => {
        const pos = (start + i + 1).toString().padStart(2)
        const name = truncate(e.name, 12)
        lines.push(` ${pos}. ${pad(name, 12)} Lv${e.level} ${e.rank}`)
      })
    }

    lines.push(LINE)
    lines.push('▲/▼=Pagina  [P]=Indietro')
    return lines.join('\n')
  }

  async showArtifactReward(artifactId: ArtifactId): Promise<void> {
    if (!this.initialized) return
    const content = this.buildArtifactRewardNarrow(artifactId)
    const imgData = await renderArtifactImage(artifactId)

    if (!this.inImageMode) {
      this.inImageMode = true
      this.lastContent = content
      const ok = await this._rebuildWithImages(content)
      if (ok) {
        await this.bridge.updateImageRawData(new ImageRawDataUpdate({
          containerID: 2, containerName: 'img-top', imageData: imgData.slice(0, ART_IMG_W * 144),
        }))
        await this.bridge.updateImageRawData(new ImageRawDataUpdate({
          containerID: 3, containerName: 'img-bot', imageData: imgData.slice(ART_IMG_W * 144),
        }))
      }
    } else {
      this.lastContent = content
      await this.update(content)
    }
  }

  buildArtifactRewardNarrow(artifactId: ArtifactId): string {
    const tr = t(this.lang)
    const nameKey = ('artifact' + artifactId.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')) as keyof typeof tr
    const displayName = (tr as any)[nameKey] ?? artifactId
    return [
      '★ ' + tr.jollyReward,
      SHORT_LINE,
      '',
      tr.artifact + ':',
      truncate(displayName, 18),
      '',
      SHORT_LINE,
      tr.pressToContinue,
    ].join('\n')
  }

  buildArtifactReward(artifactId: ArtifactId): string {
    const tr = t(this.lang)
    const nameKey = ('artifact' + artifactId.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')) as keyof typeof tr
    const displayName = (tr as any)[nameKey] ?? artifactId
    return [
      '╔══ ' + tr.jollyReward + ' ══╗',
      '║',
      `║  ${tr.artifact} ottenuto!`,
      '║',
      `║  ${truncate(displayName, 20)}`,
      '║',
      '╚══════════════════════════╝',
      tr.pressToContinue,
    ].join('\n')
  }

  buildError(message: string): string {
    return [
      '╭──────────────────────────╮',
      '│        !! ERROR !!       │',
      '╰──────────────────────────╯',
      '',
      truncate(message, 28),
      LINE,
      '[PRESS] Retry',
    ].join('\n')
  }
}
