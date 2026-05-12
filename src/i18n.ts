// i18n.ts - Traduzioni per 10 lingue

export type Lang = 'it' | 'en' | 'fr' | 'de' | 'es' | 'ja' | 'ko' | 'zh' | 'pt' | 'ru'

export const LANGUAGES: Record<Lang, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  pt: 'Português',
  ru: 'Русский',
}

export interface Translations {
  systemBoot: string
  systemMessage: string
  newDay: string
  questsAwait: string
  acceptDaily: string
  dailyQuests: string
  questDetail: string
  inProgress: string
  pending: string
  completed: string
  start: string
  complete: string
  skip: string
  back: string
  exit: string
  player: string
  level: string
  rank: string
  exp: string
  questsTotal: string
  ranking: string
  globalRanking: string
  reward: string
  levelUp: string
  rankUp: string
  warning: string
  questMissed: string
  penaltyApplied: string
  expLost: string
  noQuests: string
  setupRequired: string
  setupInstructions: string
  pressToContinue: string
  pressToStart: string
  pressToComplete: string
  doublePressBack: string
  swipeNavigate: string
  questCorsa: string
  questFlessioni: string
  questAddominali: string
  questPlank: string
  questYoga: string
  questScale: string
  questCamminata: string
  questMeditazione: string
  questLettura: string
  questStudio: string
  questScrittura: string
  questNoScreen: string
  questSonno: string
  attrFor: string
  attrAgi: string
  attrVit: string
  attrInt: string
  attrEnd: string
  classFighter: string
  classMage: string
  classRanger: string
  questOf: string
  selectLanguage: string
  selectPrivacy: string
  enterName: string
  privacyPublic: string
  privacyAnon: string
  privacyPrivate: string
}

const it: Translations = {
  systemBoot: 'SISTEMA AVVIATO',
  systemMessage: 'MESSAGGIO DEL SISTEMA',
  newDay: 'Un nuovo giorno è iniziato',
  questsAwait: 'Le quest di oggi ti attendono',
  acceptDaily: 'Pronto, Player?',
  dailyQuests: 'QUEST GIORNALIERE',
  questDetail: 'DETTAGLIO QUEST',
  inProgress: 'IN CORSO',
  pending: 'IN ATTESA',
  completed: 'COMPLETATA',
  start: 'Inizia',
  complete: 'Completa',
  skip: 'Salta',
  back: 'Indietro',
  exit: 'Esci',
  player: 'PLAYER',
  level: 'Livello',
  rank: 'Rank',
  exp: 'EXP',
  questsTotal: 'Quest totali',
  ranking: 'CLASSIFICA',
  globalRanking: 'CLASSIFICA GLOBALE',
  reward: 'RICOMPENSA',
  levelUp: 'LIVELLO AUMENTATO!',
  rankUp: 'RANK AUMENTATO!',
  warning: 'AVVERTIMENTO',
  questMissed: 'Hai mancato una quest',
  penaltyApplied: 'Penalità applicata',
  expLost: 'EXP persi',
  noQuests: 'Nessuna quest disponibile',
  setupRequired: 'CONFIGURAZIONE',
  setupInstructions: 'Apri /setup.html nel browser',
  pressToContinue: '[PRESS] Continua',
  pressToStart: '[PRESS] Inizia',
  pressToComplete: '[PRESS] Completata',
  doublePressBack: '[2x] Indietro',
  swipeNavigate: '^/v Naviga',
  questCorsa: 'Corsa',
  questFlessioni: 'Flessioni',
  questAddominali: 'Addominali',
  questPlank: 'Plank',
  questYoga: 'Yoga',
  questScale: 'Salita scale',
  questCamminata: 'Camminata',
  questMeditazione: 'Meditazione',
  questLettura: 'Lettura',
  questStudio: 'Studio',
  questScrittura: 'Scrittura',
  questNoScreen: 'Senza schermi',
  questSonno: 'Sonno',
  attrFor: 'FOR',
  attrAgi: 'AGI',
  attrVit: 'VIT',
  attrInt: 'INT',
  attrEnd: 'RES',
  classFighter: 'Guerriero',
  classMage: 'Mago',
  classRanger: 'Ranger',
  questOf: 'di',
  selectLanguage: 'Seleziona lingua:',
  selectPrivacy: 'Privacy classifica:',
  enterName: 'Inserisci nome:',
  privacyPublic: 'Pubblico: nome visibile',
  privacyAnon: 'Anonimo: nome nascosto',
  privacyPrivate: 'Privato: non in classifica',
}

const en: Translations = {
  systemBoot: 'SYSTEM BOOT',
  systemMessage: 'SYSTEM MESSAGE',
  newDay: 'A new day has begun',
  questsAwait: 'Today\'s quests await',
  acceptDaily: 'Ready, Player?',
  dailyQuests: 'DAILY QUESTS',
  questDetail: 'QUEST DETAIL',
  inProgress: 'IN PROGRESS',
  pending: 'PENDING',
  completed: 'COMPLETED',
  start: 'Start',
  complete: 'Complete',
  skip: 'Skip',
  back: 'Back',
  exit: 'Exit',
  player: 'PLAYER',
  level: 'Level',
  rank: 'Rank',
  exp: 'EXP',
  questsTotal: 'Total quests',
  ranking: 'RANKING',
  globalRanking: 'GLOBAL RANKING',
  reward: 'REWARD',
  levelUp: 'LEVEL UP!',
  rankUp: 'RANK UP!',
  warning: 'WARNING',
  questMissed: 'You missed a quest',
  penaltyApplied: 'Penalty applied',
  expLost: 'EXP lost',
  noQuests: 'No quests available',
  setupRequired: 'SETUP',
  setupInstructions: 'Open /setup.html in browser',
  pressToContinue: '[PRESS] Continue',
  pressToStart: '[PRESS] Start',
  pressToComplete: '[PRESS] Done',
  doublePressBack: '[2x] Back',
  swipeNavigate: '^/v Navigate',
  questCorsa: 'Run',
  questFlessioni: 'Push-ups',
  questAddominali: 'Sit-ups',
  questPlank: 'Plank',
  questYoga: 'Yoga',
  questScale: 'Stair climb',
  questCamminata: 'Walk',
  questMeditazione: 'Meditation',
  questLettura: 'Reading',
  questStudio: 'Study',
  questScrittura: 'Writing',
  questNoScreen: 'No screens',
  questSonno: 'Sleep',
  attrFor: 'STR',
  attrAgi: 'AGI',
  attrVit: 'VIT',
  attrInt: 'INT',
  attrEnd: 'END',
  classFighter: 'Fighter',
  classMage: 'Mage',
  classRanger: 'Ranger',
  questOf: 'of',
  selectLanguage: 'Select language:',
  selectPrivacy: 'Ranking privacy:',
  enterName: 'Enter player name:',
  privacyPublic: 'Public: real name shown',
  privacyAnon: 'Anonymous: name hidden',
  privacyPrivate: 'Private: not in ranking',
}

const fr: Translations = {
  ...en,
  systemBoot: 'SYSTÈME ACTIVÉ',
  systemMessage: 'MESSAGE SYSTÈME',
  newDay: 'Une nouvelle journée a commencé',
  questsAwait: 'Les quêtes du jour vous attendent',
  acceptDaily: 'Prêt, Joueur?',
  dailyQuests: 'QUÊTES DU JOUR',
  questDetail: 'DÉTAIL DE LA QUÊTE',
  inProgress: 'EN COURS',
  pending: 'EN ATTENTE',
  completed: 'TERMINÉE',
  start: 'Commencer',
  complete: 'Terminer',
  skip: 'Passer',
  back: 'Retour',
  exit: 'Quitter',
  player: 'JOUEUR',
  level: 'Niveau',
  rank: 'Rang',
  ranking: 'CLASSEMENT',
  globalRanking: 'CLASSEMENT GLOBAL',
  reward: 'RÉCOMPENSE',
  levelUp: 'NIVEAU SUPÉRIEUR!',
  rankUp: 'RANG SUPÉRIEUR!',
  warning: 'AVERTISSEMENT',
  questMissed: 'Vous avez raté une quête',
  setupRequired: 'CONFIGURATION',
  setupInstructions: 'Ouvrir /setup.html',
  pressToContinue: '[PRESS] Continuer',
  pressToStart: '[PRESS] Démarrer',
  pressToComplete: '[PRESS] Fait',
  doublePressBack: '[2x] Retour',
  swipeNavigate: '^/v Naviguer',
  questCorsa: 'Course',
  questFlessioni: 'Pompes',
  questAddominali: 'Abdos',
  questYoga: 'Yoga',
  questScale: 'Escaliers',
  questCamminata: 'Marche',
  questMeditazione: 'Méditation',
  questLettura: 'Lecture',
  questStudio: 'Étude',
  questOf: 'de',
}

const de: Translations = {
  ...en,
  systemBoot: 'SYSTEM GESTARTET',
  systemMessage: 'SYSTEMNACHRICHT',
  newDay: 'Ein neuer Tag hat begonnen',
  questsAwait: 'Die Quests des Tages warten',
  acceptDaily: 'Bereit, Spieler?',
  dailyQuests: 'TAGESQUESTS',
  player: 'SPIELER',
  level: 'Stufe',
  rank: 'Rang',
  ranking: 'RANGLISTE',
  globalRanking: 'GLOBALE RANGLISTE',
  reward: 'BELOHNUNG',
  levelUp: 'STUFE AUFGESTIEGEN!',
  rankUp: 'RANG AUFGESTIEGEN!',
  warning: 'WARNUNG',
  setupRequired: 'EINSTELLUNGEN',
  setupInstructions: 'Öffne /setup.html im Browser',
  pressToContinue: '[PRESS] Weiter',
  pressToStart: '[PRESS] Starten',
  pressToComplete: '[PRESS] Fertig',
  doublePressBack: '[2x] Zurück',
  questCorsa: 'Laufen',
  questFlessioni: 'Liegestütze',
  questAddominali: 'Sit-ups',
  questYoga: 'Yoga',
  questCamminata: 'Spaziergang',
  questMeditazione: 'Meditation',
  questLettura: 'Lesen',
  questStudio: 'Lernen',
  questOf: 'von',
}

const es: Translations = {
  ...en,
  systemBoot: 'SISTEMA INICIADO',
  systemMessage: 'MENSAJE DEL SISTEMA',
  newDay: 'Un nuevo día ha comenzado',
  questsAwait: 'Las misiones de hoy te esperan',
  acceptDaily: '¿Listo, Jugador?',
  dailyQuests: 'MISIONES DIARIAS',
  player: 'JUGADOR',
  level: 'Nivel',
  rank: 'Rango',
  ranking: 'CLASIFICACIÓN',
  globalRanking: 'CLASIFICACIÓN GLOBAL',
  reward: 'RECOMPENSA',
  levelUp: '¡NIVEL AUMENTADO!',
  rankUp: '¡RANGO AUMENTADO!',
  warning: 'ADVERTENCIA',
  setupRequired: 'CONFIGURACIÓN',
  setupInstructions: 'Abre /setup.html en el teléfono',
  pressToContinue: '[PRESS] Continuar',
  pressToStart: '[PRESS] Empezar',
  pressToComplete: '[PRESS] Hecho',
  doublePressBack: '[2x] Atrás',
  questCorsa: 'Correr',
  questFlessioni: 'Flexiones',
  questAddominali: 'Abdominales',
  questYoga: 'Yoga',
  questCamminata: 'Caminata',
  questMeditazione: 'Meditación',
  questLettura: 'Lectura',
  questStudio: 'Estudio',
  questOf: 'de',
}

const ja: Translations = {
  ...en,
  systemBoot: 'システム起動',
  systemMessage: 'システムメッセージ',
  newDay: '新しい一日が始まった',
  questsAwait: '今日のクエストが待っている',
  acceptDaily: '準備はいいか、プレイヤー？',
  dailyQuests: 'デイリークエスト',
  player: 'プレイヤー',
  level: 'レベル',
  rank: 'ランク',
  ranking: 'ランキング',
  globalRanking: 'グローバルランキング',
  reward: '報酬',
  levelUp: 'レベルアップ！',
  rankUp: 'ランクアップ！',
  warning: '警告',
  setupRequired: '設定',
  setupInstructions: '電話で /setup.html を開く',
  pressToContinue: '[PRESS] 続ける',
  pressToStart: '[PRESS] 開始',
  pressToComplete: '[PRESS] 完了',
  doublePressBack: '[2x] 戻る',
  questCorsa: 'ランニング',
  questFlessioni: '腕立て',
  questAddominali: '腹筋',
  questYoga: 'ヨガ',
  questCamminata: 'ウォーキング',
  questMeditazione: '瞑想',
  questLettura: '読書',
  questStudio: '勉強',
  questOf: 'の',
}

const ko: Translations = {
  ...en,
  systemBoot: '시스템 시작',
  systemMessage: '시스템 메시지',
  newDay: '새로운 하루가 시작되었다',
  questsAwait: '오늘의 퀘스트가 기다린다',
  acceptDaily: '준비됐나, 플레이어?',
  dailyQuests: '일일 퀘스트',
  player: '플레이어',
  level: '레벨',
  rank: '랭크',
  ranking: '랭킹',
  globalRanking: '글로벌 랭킹',
  reward: '보상',
  levelUp: '레벨 업!',
  rankUp: '랭크 업!',
  warning: '경고',
  setupRequired: '설정',
  setupInstructions: '휴대폰에서 /setup.html 열기',
  pressToContinue: '[PRESS] 계속',
  pressToStart: '[PRESS] 시작',
  pressToComplete: '[PRESS] 완료',
  doublePressBack: '[2x] 뒤로',
  questCorsa: '달리기',
  questFlessioni: '팔굽혀펴기',
  questAddominali: '윗몸일으키기',
  questYoga: '요가',
  questCamminata: '걷기',
  questMeditazione: '명상',
  questLettura: '독서',
  questStudio: '공부',
  questOf: '중',
}

const zh: Translations = {
  ...en,
  systemBoot: '系统启动',
  systemMessage: '系统消息',
  newDay: '新的一天开始了',
  questsAwait: '今日的任务等待着你',
  acceptDaily: '准备好了吗,玩家?',
  dailyQuests: '每日任务',
  player: '玩家',
  level: '等级',
  rank: '段位',
  ranking: '排行榜',
  globalRanking: '全球排行榜',
  reward: '奖励',
  levelUp: '升级!',
  rankUp: '段位提升!',
  warning: '警告',
  setupRequired: '设置',
  setupInstructions: '在手机上打开 /setup.html',
  pressToContinue: '[PRESS] 继续',
  pressToStart: '[PRESS] 开始',
  pressToComplete: '[PRESS] 完成',
  doublePressBack: '[2x] 返回',
  questCorsa: '跑步',
  questFlessioni: '俯卧撑',
  questAddominali: '仰卧起坐',
  questYoga: '瑜伽',
  questCamminata: '散步',
  questMeditazione: '冥想',
  questLettura: '阅读',
  questStudio: '学习',
  questOf: '的',
}

const pt: Translations = {
  ...en,
  systemBoot: 'SISTEMA INICIADO',
  newDay: 'Um novo dia começou',
  questsAwait: 'As missões de hoje aguardam',
  acceptDaily: 'Pronto, Jogador?',
  dailyQuests: 'MISSÕES DIÁRIAS',
  player: 'JOGADOR',
  level: 'Nível',
  rank: 'Rank',
  ranking: 'RANKING',
  globalRanking: 'RANKING GLOBAL',
  reward: 'RECOMPENSA',
  levelUp: 'NÍVEL AUMENTOU!',
  rankUp: 'RANK AUMENTOU!',
  warning: 'AVISO',
  setupRequired: 'CONFIGURAÇÃO',
  setupInstructions: 'Abra /setup.html no telefone',
  pressToContinue: '[PRESS] Continuar',
  pressToStart: '[PRESS] Começar',
  pressToComplete: '[PRESS] Feito',
  doublePressBack: '[2x] Voltar',
  questCorsa: 'Corrida',
  questFlessioni: 'Flexões',
  questAddominali: 'Abdominais',
  questYoga: 'Yoga',
  questCamminata: 'Caminhada',
  questMeditazione: 'Meditação',
  questLettura: 'Leitura',
  questStudio: 'Estudo',
  questOf: 'de',
}

const ru: Translations = {
  ...en,
  systemBoot: 'СИСТЕМА АКТИВНА',
  newDay: 'Начался новый день',
  questsAwait: 'Сегодняшние задания ждут',
  acceptDaily: 'Готов, Игрок?',
  dailyQuests: 'ЗАДАНИЯ ДНЯ',
  player: 'ИГРОК',
  level: 'Уровень',
  rank: 'Ранг',
  ranking: 'РЕЙТИНГ',
  globalRanking: 'ГЛОБАЛЬНЫЙ РЕЙТИНГ',
  reward: 'НАГРАДА',
  levelUp: 'ПОВЫШЕНИЕ УРОВНЯ!',
  rankUp: 'ПОВЫШЕНИЕ РАНГА!',
  warning: 'ВНИМАНИЕ',
  setupRequired: 'НАСТРОЙКА',
  setupInstructions: 'Откройте /setup.html на телефоне',
  pressToContinue: '[PRESS] Продолжить',
  pressToStart: '[PRESS] Начать',
  pressToComplete: '[PRESS] Готово',
  doublePressBack: '[2x] Назад',
  questCorsa: 'Бег',
  questFlessioni: 'Отжимания',
  questAddominali: 'Пресс',
  questYoga: 'Йога',
  questCamminata: 'Ходьба',
  questMeditazione: 'Медитация',
  questLettura: 'Чтение',
  questStudio: 'Учёба',
  questOf: 'из',
}

const TRANSLATIONS: Record<Lang, Translations> = {
  it, en, fr, de, es, ja, ko, zh, pt, ru,
}

export function t(lang: Lang): Translations {
  return TRANSLATIONS[lang] ?? TRANSLATIONS.en
}
