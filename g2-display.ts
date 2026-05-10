import {
  TextContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'

import type { PlayerProfile, Rank } from './game-engine'
import type { DailyQuest } from './quest-data'
import type { RankingEntry } from './supabase-client'
import type { Lang, Translations } from './i18n'
import { t } from './i18n'

const W = 576
const H = 288
const PAD = 6
const LINE = '------------------------------'

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
  private lang: Lang = 'en'

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
      '   *** G2 SYSTEM BOOT ***',
      '============================',
      ' Connecting...',
      LINE,
    ].join('\n')
  }

  buildSetupScreen(): string {
    const tr = t(this.lang)
    return [
      '============================',
      '   SETUP REQUIRED',
      '============================',
      ' Open on your phone:',
      ' g2-system.netlify.app',
      '      /setup.html',
      LINE,
      ' Then press the touchpad',
      LINE,
      ' [PRESS] Connect  [2x] Exit',
    ].join('\n')
  }

  buildDailyMessage(): string {
    const tr = t(this.lang)
    return [
      '============================',
      ' *** SYSTEM MESSAGE ***',
      '============================',
      ` ${tr.newDay}.`,
      ` ${tr.questsAwait}.`,
      LINE,
      ` ${tr.acceptDaily}`,
      LINE,
      ` [PRESS] Accept  [2x] Exit`,
    ].join('\n')
  }

  buildWarningScreen(expLost: number): string {
    const tr = t(this.lang)
    return [
      '============================',
      ' *** WARNING ***',
      '============================',
      ` ${tr.questMissed}.`,
      ` ${tr.penaltyApplied}:`,
      ` -${expLost} EXP`,
      LINE,
      ' Prove your worth today.',
      LINE,
      ' [PRESS] Continue',
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
      const name = (tr as any)[q.nameKey] ?? q.nameKey
      const label = `${name} ${q.amount}${q.unit}`
      lines.push(`${cursor}${status} ${truncate(label, 24)}`)
    })

    // Voce profilo
    const profileCursor = selectedIdx === quests.length ? '>' : ' '
    lines.push(`${profileCursor}[>] PROFILE`)

    lines.push(LINE)
    lines.push('^/v=Nav  [PRESS]=Select')
    return lines.join('\n')
  }

  buildQuestDetail(q: DailyQuest): string {
    const tr = t(this.lang)
    const name = (tr as any)[q.nameKey] ?? q.nameKey
    const attrKey = 'attr' + q.attribute.charAt(0).toUpperCase() + q.attribute.slice(1)
    const attr = (tr as any)[attrKey] ?? q.attribute.toUpperCase()
    const status = q.completed ? '[DONE]' : '[PENDING]'

    return [
      `== QUEST DETAIL ==`,
      LINE,
      `>> ${name.toUpperCase()}`,
      `   Target: ${q.amount} ${q.unit}`,
      `   Attr: ${attr}  EXP: +${q.expReward}`,
      `   ${status}`,
      LINE,
      q.completed
        ? '[2x] Back'
        : '[PRESS] Done  [2x] Back',
    ].join('\n')
  }

  buildLevelUp(player: PlayerProfile, oldLevel: number): string {
    return [
      '============================',
      ' *** LEVEL UP! ***',
      '============================',
      ` Lv.${oldLevel}  ->  Lv.${player.level}`,
      ` Rank: ${player.rank}`,
      ` Player: ${truncate(player.name, 20)}`,
      LINE,
      ' [PRESS] Continue',
    ].join('\n')
  }

  buildRankUp(player: PlayerProfile, oldRank: Rank): string {
    return [
      '============================',
      ' *** RANK UP! ***',
      '============================',
      ` Rank ${oldRank}  ->  Rank ${player.rank}`,
      ` Level: ${player.level}`,
      ` Player: ${truncate(player.name, 20)}`,
      LINE,
      ' [PRESS] Continue',
    ].join('\n')
  }

  buildProfile(player: PlayerProfile, rankPosition: number | null): string {
    const tr = t(this.lang)
    const a = player.attributes
    const rankPos = rankPosition ? `#${rankPosition}` : '-'
    return [
      `== ${truncate(player.name, 18)} ==`,
      `Lv.${player.level}  Rank:${player.rank}  ${rankPos}`,
      LINE,
      `EXP: ${player.expCurrent} / Total:${player.expTotal}`,
      LINE,
      `${tr.attrFor}:${a.str} ${tr.attrAgi}:${a.agi} ${tr.attrVit}:${a.vit} ${tr.attrInt}:${a.int} ${tr.attrEnd}:${a.end}`,
      LINE,
      `Quests: ${player.questsCompleted}`,
      LINE,
      '[PRESS] Ranking  [2x] Back',
    ].join('\n')
  }

  buildRanking(entries: RankingEntry[], page: number): string {
    const itemsPerPage = 5
    const start = page * itemsPerPage
    const pageItems = entries.slice(start, start + itemsPerPage)
    const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage))

    const lines: string[] = [
      `== RANKING (${page + 1}/${totalPages}) ==`,
      LINE,
    ]

    pageItems.forEach((e, i) => {
      const pos = (start + i + 1).toString().padStart(2)
      const name = truncate(e.name, 12)
      lines.push(`${pos}. ${pad(name, 12)} Lv${e.level} ${e.rank}`)
    })

    lines.push(LINE)
    lines.push('^/v=Scroll  [2x] Back')
    return lines.join('\n')
  }

  buildError(message: string): string {
    return [
      '== ERROR ==',
      LINE,
      truncate(message, 28),
      LINE,
      '[PRESS] Retry  [2x] Exit',
    ].join('\n')
  }
  buildNameInput(nameBuffer: string, currentChar: string): string {
    const display = nameBuffer + currentChar + '_'
    return [
      '============================',
      ' *** SYSTEM ***',
      ' Enter your player name',
      '============================',
      '',
      ` > ${display}`,
      '',
      LINE,
      ' ^/v=Letter  PRESS=Confirm',
      ' 2x=Delete   Hold=Done',
      LINE,
      ' When done: hold touchpad',
    ].join('\n')
  }

  buildNameConfirm(name: string): string {
    return [
      '============================',
      ' *** SYSTEM ***',
      '============================',
      '',
      ` Player: ${name}`,
      '',
      ' Confirm this name?',
      LINE,
      ' [PRESS] Yes  [2x] No',
    ].join('\n')
  }

  buildAllDoneScreen(): string {
    return [
      '============================',
      ' *** SYSTEM ***',
      '============================',
      '',
      ' All quests completed!',
      '',
      ' Rest, Player.',
      ' New quests tomorrow.',
      '',
      LINE,
      ' [PRESS] Profile  [2x] Exit',
    ].join('\n')
  }

}

// Metodi aggiunti per name input e all done
