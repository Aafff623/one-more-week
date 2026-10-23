import { describe, expect, it } from 'vitest'
import type { ChoiceRecord } from './models'
import { selectMoments } from './moments'

function record(index: number): ChoiceRecord {
  return {
    eventId: `event-${index}`,
    choiceId: index === 10 ? 'echo-choice' : `choice-${index}`,
    eventTitle: `事件 ${index}`,
    choiceTitle: `选择 ${index}`,
    day: Math.floor(index / 4) + 1,
    period: ['morning', 'noon', 'afternoon', 'evening'][index % 4] as ChoiceRecord['period'],
    hours: 1,
    effects: [],
    outcome: `结果 ${index}`,
    tone: 'care',
    createdAt: `2026-10-23T00:00:${String(index).padStart(2, '0')}.000Z`,
  }
}

describe('ending moments', () => {
  it('keeps the first and last day in chronological order', () => {
    const history = Array.from({ length: 28 }, (_, index) => record(index))
    const moments = selectMoments(history, new Set(['echo-choice']))

    expect(moments).toHaveLength(4)
    expect(moments[0]).toBe(history[0])
    expect(moments.at(-1)).toBe(history[27])
    expect(moments).toContain(history[10])
    const indexes = moments.map((moment) => history.indexOf(moment))
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b))
  })

  it('does not duplicate a moment when the echo is already selected', () => {
    const history = Array.from({ length: 28 }, (_, index) => record(index))
    const moments = selectMoments(history, new Set(['choice-27']))

    expect(new Set(moments.map((moment) => moment.eventId)).size).toBe(moments.length)
    expect(moments.at(-1)).toBe(history[27])
  })

  it('returns short histories without inventing records', () => {
    const history = Array.from({ length: 3 }, (_, index) => record(index))
    const moments = selectMoments(history, new Set())
    expect(moments).toEqual(history)
  })
})
