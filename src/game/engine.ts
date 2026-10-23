import { describeGap, describeRequirement, requirementsMet } from './conditions'
import type {
  Choice,
  ChoiceAvailability,
  ChoiceOutcome,
  ChoiceTone,
  DaySlotSummary,
  DaySummary,
  EchoRecord,
  Effect,
  EndingResult,
  GameContent,
  GameState,
  Identity,
  SlotId,
  Stats,
  StoryEvent,
  Tendencies,
} from './models'
import {
  ALLOWED_DELAYED_CHOICE_IDS,
  RULES,
  SLOTS,
  SLOT_META,
  STAT_KEYS,
  TONE_KEYS,
  clampStat,
  deepClone,
} from './rules'

const EMPTY_TENDENCIES = (): Tendencies => ({
  care: 0,
  focus: 0,
  rest: 0,
  connect: 0,
  risk: 0,
})

export class GameRuleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'GameRuleError'
  }
}

const nowIso = () => new Date().toISOString()

export function createGame(identity: Identity, timestamp = nowIso()): GameState {
  return {
    schemaVersion: 2,
    identityId: identity.id,
    day: 1,
    eventIndex: 0,
    freeHoursLeft: RULES.freeHoursPerDay,
    totalHoursUsed: 0,
    stats: { ...identity.stats },
    tendencies: EMPTY_TENDENCIES(),
    lastTone: null,
    toneStreak: 0,
    history: [],
    flags: {},
    pending: [],
    echoes: [],
    daySummaries: [],
    started: true,
    completed: false,
    endingId: null,
    startedAt: timestamp,
    updatedAt: timestamp,
  }
}

export function getIdentity(state: GameState, content: GameContent): Identity {
  const identity = content.identities.find((item) => item.id === state.identityId)
  if (!identity) {
    throw new GameRuleError('UNKNOWN_IDENTITY', '找不到这个身份。')
  }
  return identity
}

export function getDayEvents(state: GameState, content: GameContent): StoryEvent[] {
  const dayEvents = content.events.filter((event) => event.day === state.day)
  return SLOTS.flatMap((slot) => {
    const candidates = dayEvents.filter((event) => event.period === slot.id)
    const active = candidates.find((event) => requirementsMet(event.conditions, state))
    return active ? [active] : []
  })
}

export function getCurrentEvent(state: GameState, content: GameContent): StoryEvent | null {
  return getDayEvents(state, content)[state.eventIndex] ?? null
}

export function getPeriodHoursUsed(state: GameState, period: SlotId): number {
  return state.history
    .filter((record) => record.day === state.day && record.period === period)
    .reduce((total, record) => total + record.hours, 0)
}

export function getSlotHoursLeft(state: GameState, period: SlotId): number {
  return Math.max(0, SLOT_META[period].budget - getPeriodHoursUsed(state, period))
}

export function getStreakMultiplier(streak: number): number {
  if (streak <= RULES.streakGrace) return 1
  return Math.min(RULES.streakCap, 1 + (streak - RULES.streakGrace) * RULES.streakStep)
}

export function getToneMultiplier(state: GameState, tone: ChoiceTone): number {
  const nextStreak = state.lastTone === tone ? state.toneStreak + 1 : 1
  return getStreakMultiplier(nextStreak)
}

export function getEffectiveEffects(state: GameState, choice: Choice): Effect[] {
  const multiplier = getToneMultiplier(state, choice.tone)
  if (multiplier === 1) return choice.effects
  return choice.effects.map((effect) => {
    if (effect.stat === 'money') return effect
    const abs = Math.max(1, Math.round(Math.abs(effect.value) * multiplier))
    return { stat: effect.stat, value: effect.value < 0 ? -abs : abs }
  })
}

export function applyEffectsToStats(stats: Stats, effects: Effect[]): { stats: Stats; applied: Effect[] } {
  const next: Stats = { ...stats }
  const applied: Effect[] = []

  for (const effect of effects) {
    if (!STAT_KEYS.includes(effect.stat) || !Number.isFinite(effect.value)) continue
    const before = next[effect.stat]
    const after = clampStat(effect.stat, before + effect.value)
    next[effect.stat] = after
    if (after !== before) applied.push({ stat: effect.stat, value: after - before })
  }

  return { stats: next, applied }
}

function moneyCost(choice: Choice): number {
  return choice.effects
    .filter((effect) => effect.stat === 'money' && effect.value < 0)
    .reduce((total, effect) => total + Math.abs(effect.value), 0)
}

export function getChoiceAvailability(
  state: GameState,
  event: StoryEvent,
  choice: Choice,
): ChoiceAvailability {
  if (state.completed) return { ok: false, reason: '这一周已经结束了。' }
  if (state.history.some((record) => record.eventId === event.id)) {
    return { ok: false, reason: '这件事已经做过了，不能重复结算。' }
  }
  if (!Number.isFinite(choice.hours) || choice.hours <= 0) {
    return { ok: false, reason: '这个选择没有有效的时间成本。' }
  }
  const slotLeft = getSlotHoursLeft(state, event.period)
  if (choice.hours > slotLeft) {
    return {
      ok: false,
      reason: `${SLOT_META[event.period].label}只剩 ${slotLeft} 小时，这个选择需要 ${choice.hours} 小时。`,
    }
  }
  if (!requirementsMet(choice.requires, state)) {
    const unmet = (choice.requires ?? [])
      .filter((requirement) => !requirementsMet([requirement], state))
      .map(describeRequirement)
    return { ok: false, reason: `需要：${unmet.join('、')}` }
  }
  if (state.stats.money < moneyCost(choice)) {
    return { ok: false, reason: '现金不够完成这个选择。' }
  }
  return { ok: true }
}

export function applyChoice(
  state: GameState,
  content: GameContent,
  eventId: string,
  choiceId: string,
  timestamp = nowIso(),
): { state: GameState; outcome: ChoiceOutcome } {
  const current = getCurrentEvent(state, content)
  if (!current || current.id !== eventId) {
    throw new GameRuleError('EVENT_MISMATCH', '这个事件已经不在当前进度里了。')
  }

  const choice = current.choices.find((item) => item.id === choiceId)
  if (!choice) throw new GameRuleError('UNKNOWN_CHOICE', '找不到这个选择。')

  const availability = getChoiceAvailability(state, current, choice)
  if (!availability.ok) {
    throw new GameRuleError('CHOICE_UNAVAILABLE', availability.reason ?? '这个选择暂时不可用。')
  }

  const dayEvents = getDayEvents(state, content)
  const lastEventOfDay = state.eventIndex >= dayEvents.length - 1
  const next = deepClone(state)
  const multiplier = getToneMultiplier(state, choice.tone)
  const immediate = applyEffectsToStats(next.stats, getEffectiveEffects(state, choice))
  next.stats = immediate.stats
  next.freeHoursLeft -= choice.hours
  next.totalHoursUsed += choice.hours
  next.flags = { ...next.flags, ...(choice.setsFlags ?? {}) }
  next.tendencies = {
    ...next.tendencies,
    [choice.tone]: next.tendencies[choice.tone] + 1,
  }
  next.lastTone = choice.tone
  next.toneStreak = state.lastTone === choice.tone ? state.toneStreak + 1 : 1

  const delayedNotes: string[] = []
  const delayedInputs = ALLOWED_DELAYED_CHOICE_IDS.has(choice.id) ? (choice.delayed ?? []) : []
  for (const delayed of delayedInputs) {
    if (!Number.isFinite(delayed.inDays) || delayed.inDays < 1) {
      throw new GameRuleError('INVALID_DELAY', '延迟后果的天数必须大于 0。')
    }
    const triggerDay = next.day + delayed.inDays
    if (triggerDay > RULES.weekDays) {
      throw new GameRuleError('DELAYED_OUT_OF_RANGE', '延迟后果不能落到这一周之外。')
    }
    next.pending.push({
      id: `echo-${next.day}-${choice.id}-${triggerDay}`,
      triggerDay,
      effects: delayed.effects,
      note: delayed.note,
      sourceEventId: current.id,
      sourceChoiceId: choice.id,
      sourceDay: next.day,
    })
    delayedNotes.push(`第 ${triggerDay} 天会回来：${delayed.note}`)
  }

  const record = {
    eventId: current.id,
    choiceId: choice.id,
    eventTitle: current.title,
    choiceTitle: choice.title,
    day: next.day,
    period: current.period,
    hours: choice.hours,
    effects: immediate.applied,
    outcome: choice.outcome,
    tone: choice.tone,
    createdAt: timestamp,
  }
  next.history.push(record)
  next.updatedAt = timestamp

  return {
    state: next,
    outcome: {
      event: current,
      choice,
      record,
      effects: immediate.applied,
      delayedNotes,
      dayComplete: lastEventOfDay,
      lastEventOfDay,
      multiplier,
    },
  }
}

export function getRecordedOutcome(state: GameState, content: GameContent): ChoiceOutcome | null {
  const event = getCurrentEvent(state, content)
  if (!event) return null
  const record = state.history.find((item) => item.eventId === event.id)
  if (!record) return null
  const choice = event.choices.find((item) => item.id === record.choiceId)
  if (!choice) return null
  const events = getDayEvents(state, content)
  const lastEventOfDay = state.eventIndex >= events.length - 1
  return {
    event,
    choice,
    record,
    effects: record.effects,
    delayedNotes: state.pending
      .filter((item) => item.sourceChoiceId === choice.id && item.sourceDay === record.day)
      .map((item) => `第 ${item.triggerDay} 天会回来：${item.note}`),
    dayComplete: lastEventOfDay,
    lastEventOfDay,
    multiplier: getStreakMultiplier(state.toneStreak),
  }
}

export function advanceToNextEvent(
  state: GameState,
  content: GameContent,
  timestamp = nowIso(),
): GameState {
  const dayEvents = getDayEvents(state, content)
  if (state.eventIndex >= dayEvents.length - 1) {
    throw new GameRuleError('NO_MORE_EVENTS', '今天的事件已经全部完成了。')
  }
  const next = deepClone(state)
  next.eventIndex += 1
  next.echoes = []
  next.updatedAt = timestamp
  return next
}

export function finishDay(
  state: GameState,
  content: GameContent,
  timestamp = nowIso(),
): { state: GameState; daySummary: DaySummary; echoes: EchoRecord[]; ended: boolean } {
  const dayEvents = getDayEvents(state, content)
  const completedIds = new Set(
    state.history.filter((record) => record.day === state.day).map((record) => record.eventId),
  )
  const missing = dayEvents.filter((event) => !completedIds.has(event.id))
  if (missing.length > 0) {
    throw new GameRuleError('DAY_NOT_COMPLETE', '今天还有事件没有完成。')
  }

  const next = deepClone(state)
  const restHours = next.freeHoursLeft
  const energyGain = Math.min(
    RULES.restEnergyCap,
    Math.floor(restHours / 2) * RULES.restEnergyPerTwoHours,
  )
  const moodGain = Math.min(
    RULES.restMoodCap,
    Math.floor(restHours / 4) * RULES.restMoodPerFourHours,
  )
  const rest = applyEffectsToStats(next.stats, [
    { stat: 'energy', value: energyGain },
    { stat: 'mood', value: moodGain },
  ])
  next.stats = rest.stats
  next.totalHoursUsed += RULES.fixedHoursPerDay + restHours

  const dayRecords = next.history.filter((record) => record.day === state.day)
  const slots: DaySlotSummary[] = dayEvents.map((event) => {
    const record = dayRecords.find((item) => item.eventId === event.id)
    const hours = record?.hours ?? 0
    return {
      period: event.period,
      label: SLOT_META[event.period].label,
      timeLabel: event.timeLabel,
      eventTitle: event.title,
      choiceTitle: record?.choiceTitle ?? '',
      hours,
      restHours: Math.max(0, SLOT_META[event.period].budget - hours),
    }
  })
  const toneCounts = EMPTY_TENDENCIES()
  for (const record of dayRecords) {
    toneCounts[record.tone] += 1
  }
  for (const tone of TONE_KEYS) {
    for (const threshold of [3, 5, 7]) {
      if (next.tendencies[tone] >= threshold) next.flags[`tone_${tone}_${threshold}`] = true
    }
  }

  const daySummary: DaySummary = {
    day: next.day,
    fixedHours: RULES.fixedHoursPerDay,
    choiceHours: slots.reduce((total, slot) => total + slot.hours, 0),
    restHours,
    totalHours: RULES.hoursPerDay,
    restEffects: rest.applied,
    slots,
    toneCounts,
  }
  next.daySummaries.push(daySummary)

  if (next.day >= RULES.weekDays) {
    next.completed = true
    next.endingId = evaluateEnding(next, content.endings).ending.id
    next.updatedAt = timestamp
    return { state: next, daySummary, echoes: [], ended: true }
  }

  next.day += 1
  next.eventIndex = 0
  next.freeHoursLeft = RULES.freeHoursPerDay

  const due = next.pending.filter((item) => item.triggerDay <= next.day)
  next.pending = next.pending.filter((item) => item.triggerDay > next.day)
  const echoes: EchoRecord[] = []
  for (const item of due) {
    const result = applyEffectsToStats(next.stats, item.effects)
    next.stats = result.stats
    echoes.push({
      id: item.id,
      note: item.note,
      effects: item.effects,
      appliedEffects: result.applied,
      sourceDay: item.sourceDay,
      sourceEventId: item.sourceEventId,
      sourceChoiceId: item.sourceChoiceId,
    })
  }
  next.echoes = echoes
  next.updatedAt = timestamp

  return { state: next, daySummary, echoes, ended: false }
}

export function evaluateEnding(state: GameState, endings: GameContent['endings']): EndingResult {
  for (const ending of endings) {
    if (ending.fallback) continue
    if (requirementsMet(ending.conditions, state)) {
      const matched = ending.conditions.map(describeRequirement)
      const explanation =
        matched.length > 0
          ? `这一周的${matched.join('、')}，把故事推向了这里。`
          : ending.description
      return { ending, matched, explanation }
    }
  }

  const fallback = endings.find((ending) => ending.fallback)
  if (!fallback) throw new GameRuleError('NO_FALLBACK_ENDING', '缺少兜底结局。')
  const closest = endings
    .filter((ending) => !ending.fallback)
    .map((ending) => {
      const matched = ending.conditions.filter((condition) => requirementsMet([condition], state)).length
      return {
        ending,
        matched,
        ratio: ending.conditions.length > 0 ? matched / ending.conditions.length : 0,
        unmet: ending.conditions
          .filter((condition) => !requirementsMet([condition], state))
          .map((condition) => describeGap(condition, state)),
      }
    })
    .sort((a, b) => b.ratio - a.ratio || b.matched - a.matched)[0]

  return {
    ending: fallback,
    matched: [],
    explanation: closest
      ? `这一周没有触发一个明确的结局。你走到的位置，离「${closest.ending.title}」最近。`
      : fallback.description,
    closest: closest ? { ending: closest.ending, unmet: closest.unmet } : undefined,
  }
}

export function getTimeView(state: GameState) {
  const fixedHours = state.daySummaries.reduce((total, day) => total + day.fixedHours, 0)
  const choiceHours = state.history.reduce((total, record) => total + record.hours, 0)
  const restHours = state.daySummaries.reduce((total, day) => total + day.restHours, 0)
  return {
    fixedHours,
    choiceHours,
    restHours,
    totalUsed: state.totalHoursUsed,
    remaining: Math.max(0, RULES.totalHours - state.totalHoursUsed),
  }
}
