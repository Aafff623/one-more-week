import { describe, expect, it } from 'vitest'
import { gameContent } from './content'
import {
  GameRuleError,
  advanceToNextEvent,
  applyChoice,
  createGame,
  evaluateEnding,
  finishDay,
  getChoiceAvailability,
  getCurrentEvent,
  getDayEvents,
  getEffectiveEffects,
  getRecordedOutcome,
  getSlotHoursLeft,
  getStreakMultiplier,
  getToneMultiplier,
} from './engine'
import type { GameState, Stats, StoryEvent } from './models'
import { deepClone } from './rules'

const student = gameContent.identities[0]
const timestamp = '2026-10-22T00:00:00.000Z'

function playChoice(state: GameState, choiceIndex = 0): GameState {
  const event = getCurrentEvent(state, gameContent)
  if (!event) throw new Error('no current event')
  return applyChoice(state, gameContent, event.id, event.choices[choiceIndex].id, timestamp).state
}

function playDay(
  state: GameState,
  choiceIndex = 0,
): ReturnType<typeof finishDay> {
  const dayEvents = getDayEvents(state, gameContent)
  for (let index = 0; index < dayEvents.length; index += 1) {
    state = playChoice(state, choiceIndex)
    if (index < dayEvents.length - 1) {
      state = advanceToNextEvent(state, gameContent, timestamp)
    }
  }
  return finishDay(state, gameContent, timestamp)
}

function stateWithStats(patch: Partial<Stats>): GameState {
  const state = createGame(student, timestamp)
  state.stats = { ...state.stats, ...patch }
  return state
}

function findChoice(event: StoryEvent, choiceId: string) {
  const choice = event.choices.find((item) => item.id === choiceId)
  if (!choice) throw new Error(`choice ${choiceId} not found`)
  return choice
}

describe('time model', () => {
  it('starts with a full free-time budget and no completed hours', () => {
    const state = createGame(student, timestamp)
    expect(state.totalHoursUsed).toBe(0)
    expect(state.freeHoursLeft).toBe(12)
    expect(state.day).toBe(1)
    expect(state.history).toHaveLength(0)
  })

  it('spends free hours and keeps fixed hours separate within a day', () => {
    const event = getCurrentEvent(createGame(student, timestamp), gameContent)!
    const choice = event.choices[0]
    const { state } = applyChoice(createGame(student, timestamp), gameContent, event.id, choice.id, timestamp)

    expect(state.freeHoursLeft).toBe(12 - choice.hours)
    expect(state.totalHoursUsed).toBe(choice.hours)
    expect(state.history).toHaveLength(1)
  })

  it('fills a day to exactly 24 hours with automatic rest and keeps the week at 168', () => {
    let state = createGame(student, timestamp)
    for (let day = 1; day <= 7; day += 1) {
      const result = playDay(state, 0)
      state = result.state
      expect(result.daySummary.totalHours).toBe(24)
      expect(result.daySummary.fixedHours).toBe(12)
      expect(result.daySummary.choiceHours + result.daySummary.restHours).toBe(12)
      expect(result.daySummary.slots).toHaveLength(4)
      expect(result.daySummary.slots.map((slot) => slot.period)).toEqual([
        'morning',
        'noon',
        'afternoon',
        'evening',
      ])
      expect(
        Object.values(result.daySummary.toneCounts).reduce((total, count) => total + count, 0),
      ).toBe(4)
      expect(state.totalHoursUsed).toBe(day * 24)
      expect(result.ended).toBe(day === 7)
    }

    expect(state.completed).toBe(true)
    expect(state.totalHoursUsed).toBe(168)
    expect(state.daySummaries).toHaveLength(7)
    expect(state.history).toHaveLength(28)
    expect(state.endingId).not.toBeNull()
  })

  it('rejects a choice that costs more than the slot budget left', () => {
    const state = createGame(student, timestamp)
    state.history.push({
      eventId: 'spent-morning',
      choiceId: 'spent-morning-choice',
      eventTitle: '已用掉的上午',
      choiceTitle: '已经用掉两小时',
      day: 1,
      period: 'morning',
      hours: 2,
      effects: [],
      outcome: '已经发生的事。',
      tone: 'care',
      createdAt: timestamp,
    })
    const event = getCurrentEvent(state, gameContent)!
    const expensive = event.choices.find((choice) => choice.hours > 1)!
    const availability = getChoiceAvailability(state, event, expensive)

    expect(availability.ok).toBe(false)
    expect(availability.reason).toContain('上午只剩')
    expect(() =>
      applyChoice(state, gameContent, event.id, expensive.id, timestamp),
    ).toThrowError(GameRuleError)
  })

  it('does not double-settle the same event', () => {
    const state = createGame(student, timestamp)
    const event = getCurrentEvent(state, gameContent)!
    const choice = event.choices[0]
    const first = applyChoice(state, gameContent, event.id, choice.id, timestamp)
    const availability = getChoiceAvailability(first.state, event, choice)

    expect(availability.ok).toBe(false)
    expect(first.state.history).toHaveLength(1)
    expect(() =>
      applyChoice(first.state, gameContent, event.id, choice.id, timestamp),
    ).toThrowError(GameRuleError)
  })

  it('clamps stats and refuses purchases that would make money negative', () => {
    const state = stateWithStats({ energy: 98 })
    const event = getCurrentEvent(state, gameContent)!
    const sleep = findChoice(event, 'd1-morning-sleep')
    const { state: after, outcome } = applyChoice(state, gameContent, event.id, sleep.id, timestamp)

    expect(after.stats.energy).toBe(100)
    expect(outcome.effects.find((effect) => effect.stat === 'energy')?.value).toBe(2)

    const poor = stateWithStats({ money: 10 })
    const breakfast = findChoice(getCurrentEvent(poor, gameContent)!, 'd1-morning-breakfast')
    expect(getChoiceAvailability(poor, getCurrentEvent(poor, gameContent)!, breakfast).ok).toBe(false)
  })
})

describe('delayed consequences', () => {
  it('only queues delayed consequences for the few narrative echoes', () => {
    const event = getCurrentEvent(createGame(student, timestamp), gameContent)!
    const work = findChoice(event, 'd1-morning-work')
    const sleep = findChoice(event, 'd1-morning-sleep')

    const worked = applyChoice(createGame(student, timestamp), gameContent, event.id, work.id, timestamp).state
    expect(worked.pending).toHaveLength(0)

    const slept = applyChoice(createGame(student, timestamp), gameContent, event.id, sleep.id, timestamp).state
    expect(slept.pending).toHaveLength(1)
  })

  it('rebuilds delayed notes from queued state instead of the choice definition', () => {
    const event = getCurrentEvent(createGame(student, timestamp), gameContent)!
    const sleep = findChoice(event, 'd1-morning-sleep')
    const applied = applyChoice(createGame(student, timestamp), gameContent, event.id, sleep.id, timestamp)

    const restored = getRecordedOutcome(applied.state, gameContent)
    expect(restored?.delayedNotes).toEqual(applied.outcome.delayedNotes)
    expect(restored?.delayedNotes).toHaveLength(1)
    expect(restored?.multiplier).toBe(applied.outcome.multiplier)
  })

  it('does not invent delayed notes for a choice that never queued one', () => {
    const event = getCurrentEvent(createGame(student, timestamp), gameContent)!
    const work = findChoice(event, 'd1-morning-work')
    const applied = applyChoice(createGame(student, timestamp), gameContent, event.id, work.id, timestamp)

    expect(applied.state.pending).toHaveLength(0)
    expect(applied.outcome.delayedNotes).toEqual([])
    expect(getRecordedOutcome(applied.state, gameContent)?.delayedNotes).toEqual([])
  })

  it('applies a queued effect on the correct day and only once', () => {
    let state = createGame(student, timestamp)
    const dayOneEvent = getCurrentEvent(state, gameContent)!
    const sleep = findChoice(dayOneEvent, 'd1-morning-sleep')
    state = applyChoice(state, gameContent, dayOneEvent.id, sleep.id, timestamp).state
    expect(state.pending).toHaveLength(1)

    state = advanceToNextEvent(state, gameContent, timestamp)
    for (let index = 1; index < 4; index += 1) {
      const event = getCurrentEvent(state, gameContent)!
      state = applyChoice(state, gameContent, event.id, event.choices[0].id, timestamp).state
      if (index < 3) state = advanceToNextEvent(state, gameContent, timestamp)
    }
    const dayOne = finishDay(state, gameContent, timestamp)
    state = dayOne.state

    expect(dayOne.ended).toBe(false)
    expect(state.day).toBe(2)
    expect(state.echoes.length).toBeGreaterThan(0)
    expect(state.pending.every((item) => item.triggerDay > state.day)).toBe(true)
    const energyAfterEcho = state.stats.energy
    expect(dayOne.echoes[0].appliedEffects.length).toBeGreaterThan(0)

    const dayTwo = playDay(state, 0)
    expect(dayTwo.state.echoes.every((echo) => echo.id !== dayOne.echoes[0].id)).toBe(true)
    expect(dayTwo.state.stats.energy).not.toBe(energyAfterEcho)
  })
})

describe('tendencies and slot budgets', () => {
  it('keeps the first two matching choices normal and amplifies the third', () => {
    expect(getStreakMultiplier(1)).toBe(1)
    expect(getStreakMultiplier(2)).toBe(1)
    expect(getStreakMultiplier(3)).toBe(1.1)
    expect(getStreakMultiplier(6)).toBe(1.4)
    expect(getStreakMultiplier(20)).toBe(1.5)

    const state = createGame(student, timestamp)
    state.lastTone = 'care'
    state.toneStreak = 2
    const focusChoice = gameContent.events
      .flatMap((event) => event.choices)
      .find((choice) => choice.id === 'd5-friday-work')!
    const baseGrowth = focusChoice.effects.find((effect) => effect.stat === 'growth')!.value
    const repeated = { ...state, lastTone: 'focus' as const, toneStreak: 2 }
    const amplified = getEffectiveEffects(repeated, focusChoice).find(
      (effect) => effect.stat === 'growth',
    )!.value

    expect(getToneMultiplier(state, 'care')).toBe(1.1)
    expect(getSlotHoursLeft(state, 'morning')).toBe(3)
    expect(amplified).toBeGreaterThan(baseGrowth)
  })

  it('counts a repeated tone and records the period on the history record', () => {
    const event = getCurrentEvent(createGame(student, timestamp), gameContent)!
    const breakfast = findChoice(event, 'd1-morning-breakfast')
    const state = applyChoice(createGame(student, timestamp), gameContent, event.id, breakfast.id, timestamp).state

    expect(state.tendencies.care).toBe(1)
    expect(state.toneStreak).toBe(1)
    expect(state.history[0].period).toBe('morning')
    expect(getSlotHoursLeft(state, 'morning')).toBe(2)
  })
})

describe('ending evaluation', () => {
  it('finds the connector ending', () => {
    const result = evaluateEnding(stateWithStats({ relationships: 80, mood: 70 }), gameContent.endings)
    expect(result.ending.id).toBe('connector')
    expect(result.matched.length).toBe(2)
  })

  it('finds the explorer ending', () => {
    const result = evaluateEnding(stateWithStats({ growth: 80, relationships: 50, mood: 50 }), gameContent.endings)
    expect(result.ending.id).toBe('explorer')
  })

  it('finds the balanced ending', () => {
    const result = evaluateEnding(
      stateWithStats({ energy: 70, mood: 70, relationships: 60, growth: 60 }),
      gameContent.endings,
    )
    expect(result.ending.id).toBe('balanced')
  })

  it('finds the burned-out ending', () => {
    const result = evaluateEnding(stateWithStats({ energy: 30, growth: 70 }), gameContent.endings)
    expect(result.ending.id).toBe('burned-out')
  })

  it('prioritises burnout over exploration when both conditions match', () => {
    const result = evaluateEnding(
      stateWithStats({ energy: 30, growth: 80, relationships: 50, mood: 50 }),
      gameContent.endings,
    )
    expect(result.ending.id).toBe('burned-out')
  })

  it('falls back to the keeper ending', () => {
    const result = evaluateEnding(
      stateWithStats({ energy: 50, mood: 50, growth: 50, relationships: 50 }),
      gameContent.endings,
    )
    expect(result.ending.id).toBe('week-keeper')
    expect(result.ending.fallback).toBe(true)
  })

  it('shows the nearest ending and the exact gap for a fallback', () => {
    const balancedGap = evaluateEnding(
      stateWithStats({ energy: 49, mood: 70, growth: 62, relationships: 64 }),
      gameContent.endings,
    )
    expect(balancedGap.ending.id).toBe('week-keeper')
    expect(balancedGap.closest?.ending.id).toBe('balanced')
    expect(balancedGap.closest?.unmet).toContain('精力 49，需要至少 50')
    expect(balancedGap.explanation).toContain('平衡生活者')

    const restGap = evaluateEnding(
      stateWithStats({ energy: 100, mood: 97, growth: 21, relationships: 47 }),
      gameContent.endings,
    )
    expect(restGap.closest?.ending.id).toBe('connector')
    expect(restGap.closest?.unmet).toContain('人际 47，需要至少 75')

    const balanced = evaluateEnding(
      stateWithStats({ energy: 50, mood: 73, growth: 64, relationships: 62 }),
      gameContent.endings,
    )
    expect(balanced.ending.id).toBe('balanced')
  })

  it('uses the selected identity and current event', () => {
    const state = createGame(student, timestamp)
    expect(getCurrentEvent(state, gameContent)?.id).toBe('d1-morning')
    expect(deepClone(state).identityId).toBe('student')
  })
})
