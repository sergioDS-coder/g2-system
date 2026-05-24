import {
  TextContainerProperty,
  ImageContainerProperty,
  ImageRawDataUpdate,
  CreateStartUpPageContainer,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'

import type { PlayerProfile, Rank } from './game-engine'
import type { DailyQuest } from './quest-data'
import type { RankingEntry } from './supabase-client'
import type { Lang } from './i18n'
import { t } from './i18n'
import { renderQuestImages, IMG_W, IMG_H } from './quest-image'

const W = 576
const H = 288
const PAD = 6
const TEXT_X = IMG_W        // text container starts after image
const TEXT_W = W - IMG_W    // 396px → ~19 chars per line
const SHORT_LINE = '───────────────────'  // fits in narrow text container
const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
export const VERSION = 'v1.8.0'


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

    // textContainerUpgrade expects 1 argument (an object) in SDK 0.0.10
    try {
      await (this.bridge as any).textContainerUpgrade({
        containerID: 1,
        containerName: 'main',
        content: content,
        contentOffset: 0,
        contentLength: content.length
      })
    } catch (e) {
      console.error('Update failed, rebuilding page', e)
      await this._rebuildFullWidth(content)
    }
  }

  /** Show quest detail with real image on the left (180×288) + text on the right */
  async showQuestDetail(q: DailyQuest, selectedIdx = 0): Promise<void> {
    if (!this.initialized) return
    const content = this.buildQuestDetailNarrow(q, selectedIdx)

    if (!this.inImageMode) {
      // Enter image mode: rebuild with 2 image containers + 1 narrow text container
      this.inImageMode = true
      this.lastContent = content
      await this._rebuildWithImages(content)
      // Let the container layout settle before pushing image bytes
      await new Promise(r => setTimeout(r, 250))
      await this._sendQuestImages(q.templateId)
      this.lastImageTemplateId = q.templateId
    } else {
      // Already in image mode: only update text if changed
      if (content !== this.lastContent) {
        this.lastContent = content
        try {
          await (this.bridge as any).textContainerUpgrade({
            containerID: 1, containerName: 'main',
            content, contentOffset: 0, contentLength: content.length
          })
        } catch (e) {
          await this._rebuildWithImages(content)
        }
      }
      // Update image only if quest changed
      if (this.lastImageTemplateId !== q.templateId) {
        await this._sendQuestImages(q.templateId)
        this.lastImageTemplateId = q.templateId
      }
    }
  }

  private async _rebuildFullWidth(content: string): Promise<void> {
    const container = new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: W, height: H,
      borderWidth: 0, borderColor: 5, paddingLength: PAD,
      containerID: 1, containerName: 'main', content, isEventCapture: 1,
    })
    await (this.bridge as any).rebuildPageContainer({ containerTotalNum: 1, textObject: [container] })
  }

  private async _rebuildWithImages(content: string): Promise<void> {
    const imgTop = new ImageContainerProperty({
      xPosition: 0, yPosition: 0, width: IMG_W, height: IMG_H,
      containerID: 2, containerName: 'img-top',
    })
    const imgBot = new ImageContainerProperty({
      xPosition: 0, yPosition: IMG_H, width: IMG_W, height: IMG_H,
      containerID: 3, containerName: 'img-bot',
    })
    const txt = new TextContainerProperty({
      xPosition: TEXT_X, yPosition: 0, width: TEXT_W, height: H,
      borderWidth: 0, borderColor: 5, paddingLength: PAD,
      containerID: 1, containerName: 'main', content, isEventCapture: 1,
    })
    await (this.bridge as any).rebuildPageContainer({
      containerTotalNum: 3,
      imageObject: [imgTop, imgBot],
      textObject: [txt],
    })
  }

  private async _sendQuestImages(templateId: string): Promise<void> {
    const [topData, botData] = await renderQuestImages(templateId)
    await this.bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: 2, containerName: 'img-top', imageData: topData }))
    await this.bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: 3, containerName: 'img-bot', imageData: botData }))
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
    const attrKey = 'attr' + q.attribute.charAt(0).toUpperCase() + q.attribute.slice(1)
    const attr = (tr as any)[attrKey] ?? q.attribute.toUpperCase()
    const jollyTag = q.type === 'jolly' ? '★ ' : ''
    const typeName = q.type.toUpperCase()
    const c = (i: number) => i === selectedIdx ? '▶' : ' '

    return [
      truncate(`${jollyTag}${name.toUpperCase()}`, 18),
      `── ${typeName}`,
      SHORT_LINE,
      `${q.amount} ${q.unit}`,
      attr,
      `+${q.expReward} EXP`,
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
    ].join('\n')
  }

  buildRanking(entries: RankingEntry[], page: number, selectedIdx = 0): string {
    const itemsPerPage = 4
    const start = page * itemsPerPage
    const pageItems = entries.slice(start, start + itemsPerPage)
    const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage))
    const c = (i: number) => i === selectedIdx ? '▶' : ' '

    const lines: string[] = [
      `== RANKING (${page + 1}/${totalPages}) ==`,
      LINE,
    ]

    pageItems.forEach((e, i) => {
      const pos = (start + i + 1).toString().padStart(2)
      const name = truncate(e.name, 12)
      const cursor = i === selectedIdx ? '▶' : ' '
      lines.push(`${cursor} ${pos}. ${pad(name, 12)} Lv${e.level} ${e.rank}`)
    })

    lines.push(LINE)
    lines.push(`${c(itemsPerPage)} Back to Profile`)
    lines.push(LINE)
    lines.push('▲/▼=Nav  [PRESS]=Select')
    return lines.join('\n')
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
