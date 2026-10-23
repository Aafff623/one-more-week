import { describe, expect, it } from 'vitest'
import { gameContent } from './content'
import { getChoiceAvailability, getCurrentEvent } from './engine'
import type { GameState } from './models'
import { deepClone } from './rules'
import {
  createRunSession,
  type RunRepository,
  type RunSession,
} from './session'

class MemoryRepository implements RunRepository {
  current: GameState | null = null
  saved = 0
  failSaves = false

  loadCurrent(): GameState | null {
    return this.current ? deepClone(this.current) : null
  }

  saveCurrent(state: GameState): void {
    if (this.failSaves) throw new Error('配额已满')
    this.current = deepClone(state)
    this.saved += 1
  }

  clearCurrent(): void {
    this.current = null
  }
}

function makeSession(repository = new MemoryRepository(), autoSave = true) {
  const session = createRunSession({
    content: gameContent,
    repository,
    autoSave: () => autoSave,
  })
  return { session, repository }
}

function chooseFirstAvailable(session: RunSession): void {
  const state = session.view().game
  if (!state) throw new Error('game has not started')
  const event = getCurrentEvent(state, gameContent)
  if (!event) throw new Error('no current event')
  const choice = event.choices.find(
    (item) => getChoiceAvailability(state, event, item).ok,
  )
  if (!choice) throw new Error(`no available choice for ${event.id}`)
  session.choose(choice.id)
}

function chooseById(session: RunSession, choiceId: string): void {
  const state = session.view().game
  if (!state) throw new Error('game has not started')
  session.choose(choiceId)
}

describe('run session', () => {
  it('starts a run, autosaves, and resumes at the recorded consequence', () => {
    const { session, repository } = makeSession()
    expect(session.bootstrap().view.game).toBeNull()

    const started = session.start('student')
    expect(started.view.phase).toBe('choice')
    expect(started.view.game?.day).toBe(1)
    expect(repository.saved).toBe(1)

    chooseFirstAvailable(session)
    const chosen = session.view()
    expect(chosen.phase).toBe('consequence')
    expect(chosen.outcome?.record.choiceId).toBeTruthy()

    const resumed = makeSession(repository).session.bootstrap()
    expect(resumed.view.phase).toBe('consequence')
    expect(resumed.view.outcome?.record.choiceId).toBe(chosen.outcome?.record.choiceId)
  })

  it('rebuilds delayed notes from queued state after a reload', () => {
    const { session, repository } = makeSession()
    session.start('student')
    chooseById(session, 'd1-morning-sleep')
    expect(session.view().outcome?.delayedNotes).toHaveLength(1)

    const resumed = makeSession(repository).session.bootstrap()
    expect(resumed.view.outcome?.delayedNotes).toEqual(
      session.view().outcome?.delayedNotes,
    )
  })

  it('does not invent a delayed note for a choice that never queued one', () => {
    const { session, repository } = makeSession()
    session.start('student')
    chooseById(session, 'd1-morning-work')
    expect(session.view().outcome?.delayedNotes).toEqual([])

    const resumed = makeSession(repository).session.bootstrap()
    expect(resumed.view.phase).toBe('consequence')
    expect(resumed.view.outcome?.record.choiceId).toBe('d1-morning-work')
    expect(resumed.view.outcome?.delayedNotes).toEqual([])
  })

  it('moves through the day summary, next day, and the final ending', () => {
    const { session } = makeSession()
    session.start('student')

    for (let day = 1; day <= 7; day += 1) {
      for (let index = 0; index < 4; index += 1) {
        chooseFirstAvailable(session)
        const advanced = session.advance()
        expect(advanced.view.phase).toBe(index === 3 ? 'daySummary' : 'choice')
      }
      if (day < 7) {
        const dismissed = session.dismissDaySummary()
        expect(dismissed.view.phase).toBe('choice')
        expect(dismissed.view.game?.day).toBe(day + 1)
      }
    }

    expect(session.view().game?.completed).toBe(true)
    expect(session.view().ending?.ending.id).toBeTruthy()
  })

  it('skips autosave when the preference is off', () => {
    const { session, repository } = makeSession(new MemoryRepository(), false)
    session.start('student')
    chooseFirstAvailable(session)
    expect(repository.saved).toBe(0)
  })

  it('keeps the run playable when autosave fails', () => {
    const repository = new MemoryRepository()
    repository.failSaves = true
    const { session } = makeSession(repository)

    const started = session.start('student')
    expect(started.saveWarning).toContain('自动存档失败')
    expect(started.view.game?.day).toBe(1)

    chooseFirstAvailable(session)
    expect(session.view().phase).toBe('consequence')
    expect(session.view().game?.history).toHaveLength(1)
  })

  it('loads a supplied state and clears the current save on reset', () => {
    const first = makeSession()
    first.session.start('student')
    chooseFirstAvailable(first.session)
    const snapshot = deepClone(first.session.view().game!)

    const second = makeSession()
    const loaded = second.session.load(snapshot, { persist: false })
    expect(loaded.view.phase).toBe('consequence')
    expect(loaded.view.outcome?.record.choiceId).toBe(snapshot.history[0].choiceId)

    second.repository.current = deepClone(snapshot)
    const reset = second.session.reset()
    expect(reset.view.game).toBeNull()
    expect(second.repository.current).toBeNull()
  })

  it('resumes from an explicitly supplied in-memory state', () => {
    const { session } = makeSession()
    session.start('student')
    chooseFirstAvailable(session)
    const inMemory = session.view().game!

    const resumed = session.resume(inMemory)
    expect(resumed.view.phase).toBe('consequence')
    expect(resumed.view.outcome?.record.choiceId).toBe(inMemory.history[0].choiceId)
  })
})
