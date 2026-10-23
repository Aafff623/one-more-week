export type StatKey = 'energy' | 'mood' | 'growth' | 'relationships' | 'money'

export type SlotId = 'morning' | 'noon' | 'afternoon' | 'evening'

export type Stats = Record<StatKey, number>

export interface Effect {
  stat: StatKey
  value: number
}

export interface Requirement {
  type: 'stat' | 'flag'
  key: string
  min?: number
  max?: number
  equals?: boolean | number | string
  label?: string
  tolerance?: number
}

export interface DelayedEffectInput {
  inDays: number
  effects: Effect[]
  note: string
}

export interface DelayedEffect {
  id: string
  triggerDay: number
  effects: Effect[]
  note: string
  sourceEventId: string
  sourceChoiceId: string
  sourceDay: number
}

export type ChoiceTone = 'care' | 'focus' | 'rest' | 'connect' | 'risk'

export type Tendencies = Record<ChoiceTone, number>

export interface Choice {
  id: string
  title: string
  detail: string
  hours: number
  effects: Effect[]
  outcome: string
  tone: ChoiceTone
  hint?: string
  setsFlags?: Record<string, boolean | number>
  delayed?: DelayedEffectInput[]
  requires?: Requirement[]
}

export interface StoryEvent {
  id: string
  day: number
  order: number
  period: SlotId
  weekday: string
  date: string
  timeLabel: string
  location: string
  category: string
  title: string
  imageKey: string
  narrative: string
  prompt: string
  choices: Choice[]
  conditions?: Requirement[]
}

export interface Identity {
  id: string
  name: string
  english: string
  imageKey: string
  tags: string[]
  description: string
  quote: string
  intro: string
  stats: Stats
}

export interface ChoiceRecord {
  eventId: string
  choiceId: string
  eventTitle: string
  choiceTitle: string
  day: number
  period: SlotId
  hours: number
  effects: Effect[]
  outcome: string
  tone: ChoiceTone
  createdAt: string
}

export interface EchoRecord {
  id: string
  note: string
  effects: Effect[]
  appliedEffects: Effect[]
  sourceDay: number
  sourceEventId: string
  sourceChoiceId: string
}

export interface DaySlotSummary {
  period: SlotId
  label: string
  timeLabel: string
  eventTitle: string
  choiceTitle: string
  hours: number
  restHours: number
}

export interface DaySummary {
  day: number
  fixedHours: number
  choiceHours: number
  restHours: number
  totalHours: number
  restEffects: Effect[]
  slots: DaySlotSummary[]
  toneCounts: Tendencies
}

export interface GameState {
  schemaVersion: 2
  identityId: string
  day: number
  eventIndex: number
  freeHoursLeft: number
  totalHoursUsed: number
  stats: Stats
  tendencies: Tendencies
  lastTone: ChoiceTone | null
  toneStreak: number
  history: ChoiceRecord[]
  flags: Record<string, boolean | number>
  pending: DelayedEffect[]
  echoes: EchoRecord[]
  daySummaries: DaySummary[]
  started: boolean
  completed: boolean
  endingId: string | null
  startedAt: string
  updatedAt: string
}

export interface EndingDefinition {
  id: string
  title: string
  english: string
  icon: string
  description: string
  why: string
  reflection: string
  accent: 'lime' | 'cyan' | 'coral' | 'purple'
  conditions: Requirement[]
  fallback?: boolean
}

export interface EndingGap {
  ending: EndingDefinition
  unmet: string[]
}

export interface EndingResult {
  ending: EndingDefinition
  matched: string[]
  explanation: string
  closest?: EndingGap
}

export interface GameContent {
  identities: Identity[]
  events: StoryEvent[]
  endings: EndingDefinition[]
}

export interface ChoiceAvailability {
  ok: boolean
  reason?: string
}

export interface AppliedEffects {
  stats: Stats
  applied: Effect[]
}

export interface ChoiceOutcome {
  event: StoryEvent
  choice: Choice
  record: ChoiceRecord
  effects: Effect[]
  delayedNotes: string[]
  dayComplete: boolean
  lastEventOfDay: boolean
  multiplier: number
}
