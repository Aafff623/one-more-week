import { describe, expect, it } from 'vitest'
import { gameContent } from './content'
import {
  advanceToNextEvent,
  applyChoice,
  createGame,
  evaluateEnding,
  finishDay,
  getChoiceAvailability,
  getDayEvents,
} from './engine'
import type { GameState } from './models'
import { deepClone } from './rules'

const student = gameContent.identities[0]
const timestamp = '2026-10-22T00:00:00.000Z'

function stateForDay(day: number, flags: Record<string, boolean | number> = {}): GameState {
  const state = createGame(student, timestamp)
  state.day = day
  state.flags = { ...flags }
  return state
}

describe('content integrity', () => {
  it('has four identities and enough endings', () => {
    expect(gameContent.identities).toHaveLength(4)
    expect(gameContent.endings.length).toBeGreaterThanOrEqual(3)
    expect(gameContent.endings.some((ending) => ending.fallback)).toBe(true)
  })

  it('has exactly four active events for every day in the default state', () => {
    for (let day = 1; day <= 7; day += 1) {
      const events = getDayEvents(stateForDay(day), gameContent)
      expect(events, `day ${day}`).toHaveLength(4)
      expect(events.map((event) => event.order)).toEqual([1, 2, 3, 4])
      expect(events.map((event) => event.period)).toEqual([
        'morning',
        'noon',
        'afternoon',
        'evening',
      ])
    }
  })

  it('switches day six morning to the crash event when energy is very low', () => {
    const state = stateForDay(6)
    state.stats.energy = 8
    const events = getDayEvents(state, gameContent)

    expect(events).toHaveLength(4)
    expect(events.find((event) => event.period === 'morning')?.id).toBe('d6-crash')
    expect(getDayEvents(stateForDay(6), gameContent).find((event) => event.period === 'morning')?.id).toBe(
      'd6-body',
    )
  })

  it('switches the day five message event when the friend flag is set', () => {
    const defaultEvents = getDayEvents(stateForDay(5), gameContent)
    const warmEvents = getDayEvents(stateForDay(5, { helpedFriend: true }), gameContent)

    expect(defaultEvents.find((event) => event.period === 'afternoon')?.id).toBe(
      'd5-message-default',
    )
    expect(warmEvents.find((event) => event.period === 'afternoon')?.id).toBe(
      'd5-message-warm',
    )
    expect(warmEvents).toHaveLength(4)
  })

  it('keeps event and choice ids unique', () => {
    const eventIds = gameContent.events.map((event) => event.id)
    expect(new Set(eventIds).size).toBe(eventIds.length)
    const choiceIds = gameContent.events.flatMap((event) => event.choices.map((choice) => choice.id))
    expect(new Set(choiceIds).size).toBe(choiceIds.length)
  })

  it('gives every event three meaningful, affordable choices', () => {
    for (const event of gameContent.events) {
      expect(event.choices, event.id).toHaveLength(3)
      expect(event.narrative.length, event.id).toBeGreaterThan(20)
      expect(event.prompt.length, event.id).toBeGreaterThan(3)
      expect(event.imageKey.startsWith('/images/'), event.id).toBe(true)

      for (const choice of event.choices) {
        expect(Number.isInteger(choice.hours), choice.id).toBe(true)
        expect(choice.hours, choice.id).toBeGreaterThan(0)
        expect(choice.hours, choice.id).toBeLessThanOrEqual(12)
        expect(choice.effects.length, choice.id).toBeGreaterThanOrEqual(2)
        expect(choice.outcome.length, choice.id).toBeGreaterThan(10)
        const hasNegative = choice.effects.some((effect) => effect.value < 0)
        const delayedNegative = (choice.delayed ?? []).some((delayed) =>
          delayed.effects.some((effect) => effect.value < 0),
        )
        expect(hasNegative || delayedNegative, `${choice.id} needs a real tradeoff`).toBe(true)

        for (const delayed of choice.delayed ?? []) {
          expect(delayed.inDays, choice.id).toBeGreaterThanOrEqual(1)
          expect(event.day + delayed.inDays, choice.id).toBeLessThanOrEqual(7)
          expect(delayed.note.length, choice.id).toBeGreaterThan(4)
        }
      }

      const minHours = Math.min(...event.choices.map((choice) => choice.hours))
      expect(minHours, `${event.id} needs an affordable option`).toBeLessThanOrEqual(9)
    }
  })

  it('finishes each day with exactly 24 hours and the whole week with 168', () => {
    let state = createGame(student, timestamp)
    for (let day = 1; day <= 7; day += 1) {
      const events = getDayEvents(state, gameContent)
      for (const event of events) {
        const choice = event.choices.find(
          (item) => getChoiceAvailability(state, event, item).ok,
        )
        expect(choice, `${event.id} needs an available choice`).toBeTruthy()
        state = applyChoice(state, gameContent, event.id, choice!.id, timestamp).state
        if (event !== events[events.length - 1]) {
          state = advanceToNextEvent(state, gameContent, timestamp)
        }
      }
      const result = finishDay(state, gameContent, timestamp)
      state = result.state
      expect(state.totalHoursUsed).toBe(day * 24)
    }
    expect(state.totalHoursUsed).toBe(168)
    expect(state.completed).toBe(true)
  })

  it('has a reachable state for each non-fallback ending', () => {
    const base = createGame(student, timestamp)
    const make = (patch: Partial<typeof base.stats>) => {
      const state = deepClone(base)
      state.stats = { ...state.stats, ...patch }
      return state
    }
    const cases = [
      { expected: 'connector', stats: { relationships: 80, mood: 70 } },
      { expected: 'explorer', stats: { growth: 80, mood: 50, relationships: 50 } },
      {
        expected: 'balanced',
        stats: { energy: 70, mood: 70, relationships: 60, growth: 60 },
      },
      { expected: 'burned-out', stats: { energy: 30, growth: 70 } },
    ]
    for (const testCase of cases) {
      expect(evaluateEnding(make(testCase.stats), gameContent.endings).ending.id).toBe(
        testCase.expected,
      )
    }
  })
})
