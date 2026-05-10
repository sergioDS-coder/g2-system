import {
  TextContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'

import type { PlayerProfile, Rank } from './game-engine'
import type { DailyQuest } from './quest-data'
import type { RankingEntry } from './supabase-client'
import type { Lang } from './i18n'
import { t } from './i18n'

const W = 576
const H = 288
const PAD = 6
const LINE = '------------------------------'
export const VERSION = 'v1.3.0'

function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '.'
}

function pad(text: string, len: number): string {
  return text.length >= len ? text.slice(0, len) : text + ' '.repeat(len - text.length)
}

export class G2Display {
  private bridge: EvenAppBridge
  private initialized = false
  private lastContent = ''
  private lang: Lang = 'it'

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
    const container = new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: W, height: H,
      borderWidth: 0, borderColor: 5, paddingLength: PAD,
      containerID: 1, containerName: 'main', content, isEventCapture: 1,
    })
    await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({ containerTotalNum: 1, textObject: [container] })
    )
  }

  buildBootScreen(): string {
    return [
      '============================',
      ' o===|--[ G2 SYSTEM ]--|==>',
      '      ARISE, PLAYER',
      '============================',
      ' Connecting...',
      ` ${VERSION}`,
    ].join('\n')
  }

  buildSetupScreen(): string {
    return [
      '============================',
      ' o===|--[ G2 SYSTEM ]--|==>',
      '      ARISE, PLAYER',
      '============================',
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
        '============================',
        ' o===|--[ G2 SYSTEM ]--|==>',
        ' Select language:',
        '============================',
        ` > ${currentChar.toUpperCase()}`,
        LINE,
        ' ^/v=Change  PRESS=Confirm',
        ' 2x=Cancel',
      ].join('\n')
    }
    if (inputStep === 'privacy') {
      return [
        '============================',
        ' o===|--[ G2 SYSTEM ]--|==>',
        ' Select ranking privacy:',
        '============================',
        ` > ${currentChar.charAt(0).toUpperCase() + currentChar.slice(1)}`,
        LINE,
        ' Public = real name shown',
        ' Anonymous = name hidden',
        ' Private = not in ranking',
        LINE,
        ' ^/v=Change  PRESS=Confirm',
      ].join('\n')
    }
    const disp = nameBuffer + '[' + currentChar + ']'
    return [
      '============================',
      ' o===|--[ G2 SYSTEM ]--|==>',
      ' Enter player name:',
      '============================',
      ' ' + disp,
      ` Lang:${lang.toUpperCase()}  Privacy:${privacy.slice(0,3).toUpperCase()}`,
      LINE,
      ' ^/v=Letter  PRESS=Add',
      ' [LANG] [PRIV] [OK] [ESC]',
    ].join('\n')
  }

  buildDailyMessage(selectedIdx = 0): string {
    const tr = t(this.lang)
    const c = (i: number) => i === selectedIdx ? '>' : ' '
    return [
      '============================',
      ' *** SYSTEM MESSAGE ***',
      '============================',
      ` ${tr.newDay}.`,
      ` ${tr.questsAwait}.`,
      LINE,
      `${c(0)} Accept Quests`,
      `${c(1)} Exit App`,
      LINE,
      '^/v=Nav  [PRESS]=Select',
    ].join('\n')
  }

  buildWarningScreen(expLost: number, selectedIdx = 0): string {
    const c = (i: number) => i === selectedIdx ? '>' : ' '
    return [
      '============================',
      ' *** WARNING ***',
      '============================',
      ' You missed a quest.',
      ` Penalty: -${expLost} EXP`,
      LINE,
      ' Prove your worth today.',
      LINE,
      `${c(0)} Continue to Quests`,
      `${c(1)} Exit App`,
      LINE,
      '^/v=Nav  [PRESS]=Select',
    ].join('\n')
  }

  buildAllDoneScreen(selectedIdx = 0): string {
    const c = (i: number) => i === selectedIdx ? '>' : ' '
    return [
      '============================',
      ' *** SYSTEM ***',
      '============================',
      ' All quests completed!',
      ' Well done, Player.',
      ' New quests tomorrow.',
      LINE,
      `${c(0)} View Profile`,
      `${c(1)} Back to Quests`,
      LINE,
      '^/v=Nav  [PRESS]=Select',
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
      const cursor = i === selectedIdx ? '>' : ' '
      const status = q.completed ? '[X]' : '[ ]'
      const name = q.jollyName ?? ((tr as any)[q.nameKey] ?? q.nameKey)
      const label = `${name} ${q.amount}${q.unit}`
      lines.push(`${cursor}${status} ${truncate(label, 24)}`)
    })

    const profileCursor = selectedIdx === quests.length ? '>' : ' '
    lines.push(`${profileCursor}[>] PROFILE`)

    const exitCursor = selectedIdx === quests.length + 1 ? '>' : ' '
    lines.push(`${exitCursor}[x] EXIT`)

    lines.push(LINE)
    lines.push('^/v=Nav  [PRESS]=Select')
    return lines.join('\n')
  }

  buildQuestDetail(q: DailyQuest, selectedIdx = 0): string {
    const tr = t(this.lang)
    const name = q.jollyName ?? ((tr as any)[q.nameKey] ?? q.nameKey)
    const attrKey = 'attr' + q.attribute.charAt(0).toUpperCase() + q.attribute.slice(1)
    const attr = (tr as any)[attrKey] ?? q.attribute.toUpperCase()
    const status = q.completed ? '[DONE]' : '[PENDING]'
    const jollyTag = q.type === 'jolly' ? '★ JOLLY ' : ''
    const c = (i: number) => i === selectedIdx ? '>' : ' '

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
      '^/v=Nav  [PRESS]=Select',
    ].filter(l => l !== '').join('\n')
  }

  buildLevelUp(player: PlayerProfile, oldLevel: number, selectedIdx = 0): string {
    const c = (i: number) => i === selectedIdx ? '>' : ' '
    return [
      '============================',
      ' *** LEVEL UP! ***',
      '============================',
      ` Lv.${oldLevel}  ->  Lv.${player.level}`,
      ` Rank: ${player.rank}`,
      ` Player: ${truncate(player.name, 18)}`,
      LINE,
      `${c(0)} Continue`,
      `${c(1)} Back to Quests`,
      LINE,
      '^/v=Nav  [PRESS]=Select',
    ].join('\n')
  }

  buildRankUp(player: PlayerProfile, oldRank: Rank, selectedIdx = 0): string {
    const c = (i: number) => i === selectedIdx ? '>' : ' '
    return [
      '============================',
      ' *** RANK UP! ***',
      '============================',
      ` Rank ${oldRank}  ->  Rank ${player.rank}`,
      ` Level: ${player.level}`,
      ` Player: ${truncate(player.name, 18)}`,
      LINE,
      `${c(0)} Continue`,
      `${c(1)} Back to Quests`,
      LINE,
      '^/v=Nav  [PRESS]=Select',
    ].join('\n')
  }

  buildProfile(player: PlayerProfile, rankPosition: number | null, selectedIdx = 0): string {
    const tr = t(this.lang)
    const a = player.attributes
    const rankPos = rankPosition ? `#${rankPosition}` : '-'
    return [
      `== ${truncate(player.name, 16)} ${rankPos} ==`,
      `Lv.${player.level}  Rank: ${player.rank}`,
      LINE,
      `EXP: ${player.expCurrent}`,
      `Total: ${player.expTotal}`,
      LINE,
      `${tr.attrFor}:${a.str} ${tr.attrAgi}:${a.agi} ${tr.attrVit}:${a.vit}`,
      `${tr.attrInt}:${a.int} ${tr.attrEnd}:${a.end}  Q:${player.questsCompleted}`,
      LINE,
      '[PRESS] Ranking',
    '[>] Change Name  [x] Back',
    ].join('\n')
  }

  buildRanking(entries: RankingEntry[], page: number, selectedIdx = 0): string {
    const itemsPerPage = 4
    const start = page * itemsPerPage
    const pageItems = entries.slice(start, start + itemsPerPage)
    const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage))
    const c = (i: number) => i === selectedIdx ? '>' : ' '

    const lines: string[] = [
      `== RANKING (${page + 1}/${totalPages}) ==`,
      LINE,
    ]

    pageItems.forEach((e, i) => {
      const pos = (start + i + 1).toString().padStart(2)
      const name = truncate(e.name, 12)
      const cursor = i === selectedIdx ? '>' : ' '
      lines.push(`${cursor} ${pos}. ${pad(name, 12)} Lv${e.level} ${e.rank}`)
    })

    lines.push(LINE)
    lines.push(`${c(itemsPerPage)} Back to Profile`)
    lines.push(LINE)
    lines.push('^/v=Nav  [PRESS]=Select')
    return lines.join('\n')
  }

  buildError(message: string): string {
    return [
      '== ERROR ==',
      LINE,
      truncate(message, 28),
      LINE,
      '[PRESS] Retry',
    ].join('\n')
  }
}
