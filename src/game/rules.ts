import type { ChoiceTone, SlotId, StatKey } from './models'

export const RULES = {
  weekDays: 7,
  hoursPerDay: 24,
  fixedHoursPerDay: 12,
  freeHoursPerDay: 12,
  totalHours: 168,
  choicesPerDay: 4,
  historyLimit: 28,
  statMin: 0,
  statMax: 100,
  moneyMax: 9_999_999,
  restEnergyPerTwoHours: 1,
  restEnergyCap: 3,
  restMoodPerFourHours: 1,
  restMoodCap: 1,
  streakGrace: 2,
  streakStep: 0.1,
  streakCap: 1.5,
  choiceGainScale: 0.35,
  snapshotLimit: 8,
} as const

export interface SlotMeta {
  id: SlotId
  label: string
  english: string
  budget: number
  range: string
}

export const SLOTS: SlotMeta[] = [
  { id: 'morning', label: '上午', english: 'MORNING', budget: 3, range: '08:00–11:30' },
  { id: 'noon', label: '中午', english: 'NOON', budget: 2, range: '12:00–13:30' },
  { id: 'afternoon', label: '下午', english: 'AFTERNOON', budget: 4, range: '14:00–18:00' },
  { id: 'evening', label: '晚上', english: 'EVENING', budget: 3, range: '19:00–23:00' },
]

export const SLOT_META: Record<SlotId, SlotMeta> = Object.fromEntries(
  SLOTS.map((slot) => [slot.id, slot]),
) as Record<SlotId, SlotMeta>

export const TONE_META: Record<ChoiceTone, { label: string; color: string }> = {
  care: { label: '照顾', color: 'var(--coral)' },
  focus: { label: '专注', color: 'var(--green)' },
  rest: { label: '休整', color: 'var(--cyan)' },
  connect: { label: '连接', color: 'var(--purple)' },
  risk: { label: '回避', color: 'var(--lime)' },
}

export const TONE_KEYS: ChoiceTone[] = ['care', 'focus', 'rest', 'connect', 'risk']

// Only these five choices still leave a delayed echo; the rest resolve immediately.
export const ALLOWED_DELAYED_CHOICE_IDS = new Set([
  'd1-morning-sleep',
  'd3-mistake-hide',
  'd4-money-gig',
  'd5-friday-out',
  'd6-nextweek-full',
])


export const STAT_META: Record<
  StatKey,
  { label: string; english: string; icon: string; color: string; max: number }
> = {
  energy: { label: '精力', english: 'Energy', icon: 'ϟ', color: 'var(--cyan)', max: 100 },
  mood: { label: '心情', english: 'Mood', icon: '♡', color: 'var(--coral)', max: 100 },
  growth: { label: '成长', english: 'Growth', icon: '✳', color: 'var(--green)', max: 100 },
  relationships: {
    label: '人际',
    english: 'Relationships',
    icon: '⌘',
    color: 'var(--purple)',
    max: 100,
  },
  money: { label: '金钱', english: 'Money', icon: '¥', color: 'var(--lime)', max: 9_999_999 },
}

export const STAT_KEYS: StatKey[] = ['energy', 'mood', 'growth', 'relationships', 'money']

export function clampStat(key: StatKey, value: number): number {
  if (key === 'money') {
    return Math.max(0, Math.min(RULES.moneyMax, Math.round(value)))
  }
  return Math.max(RULES.statMin, Math.min(RULES.statMax, Math.round(value)))
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)
}

export function effectLabel(effect: { stat: StatKey; value: number }): string {
  const meta = STAT_META[effect.stat]
  const sign = effect.value > 0 ? '+' : ''
  const value = effect.stat === 'money' ? formatMoney(effect.value) : String(effect.value)
  return `${meta.label} ${sign}${value}`
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
