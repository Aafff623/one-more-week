import {
  GameRuleError,
  advanceToNextEvent,
  applyChoice,
  createGame,
  evaluateEnding,
  finishDay,
  getCurrentEvent,
  getRecordedOutcome,
} from './engine'
import type {
  ChoiceOutcome,
  DaySummary,
  EndingResult,
  GameContent,
  GameState,
} from './models'

export type GamePhase = 'choice' | 'consequence' | 'daySummary'

export interface RunView {
  game: GameState | null
  phase: GamePhase
  outcome: ChoiceOutcome | null
  daySummary: DaySummary | null
  ending: EndingResult | null
}

export interface RunRepository {
  loadCurrent(): GameState | null
  saveCurrent(state: GameState): void
  clearCurrent(): void
}

export interface RunSessionOptions {
  content: GameContent
  repository: RunRepository
  autoSave: () => boolean
}

export interface RunResult {
  view: RunView
  saveWarning?: string
}

export interface RunSession {
  view(): RunView
  bootstrap(): RunResult
  start(identityId: string): RunResult
  choose(choiceId: string): RunResult
  advance(): RunResult
  dismissDaySummary(): RunResult
  resume(state?: GameState): RunResult
  load(state: GameState, options?: { persist?: boolean }): RunResult
  reset(): RunResult
}

export function createRunSession(options: RunSessionOptions): RunSession {
  let state: GameState | null = null
  let phase: GamePhase = 'choice'
  let outcome: ChoiceOutcome | null = null
  let daySummary: DaySummary | null = null
  let ending: EndingResult | null = null

  function view(): RunView {
    return { game: state, phase, outcome, daySummary, ending }
  }

  function warning(error: unknown, prefix: string): string {
    return error instanceof Error && error.message
      ? `${prefix}：${error.message}`
      : `${prefix}，请检查浏览器存储空间。`
  }

  function autosave(): string | undefined {
    if (!state || !options.autoSave()) return undefined
    try {
      options.repository.saveCurrent(state)
      return undefined
    } catch (error) {
      return warning(error, '自动存档失败')
    }
  }

  function persistCurrent(): string | undefined {
    if (!state) return undefined
    try {
      options.repository.saveCurrent(state)
      return undefined
    } catch (error) {
      return warning(error, '保存失败')
    }
  }

  function open(current: GameState | null): void {
    state = current
    outcome = null
    daySummary = null
    ending = null
    phase = 'choice'
    if (!current) return
    ending = current.completed ? evaluateEnding(current, options.content.endings) : null
    outcome = getRecordedOutcome(current, options.content)
    if (outcome) phase = 'consequence'
  }

  function result(saveWarning?: string): RunResult {
    return { view: view(), saveWarning }
  }

  return {
    view,

    bootstrap() {
      open(options.repository.loadCurrent())
      return result()
    },

    start(identityId) {
      const identity = options.content.identities.find((item) => item.id === identityId)
      if (!identity) throw new GameRuleError('UNKNOWN_IDENTITY', '找不到这个身份。')
      state = createGame(identity)
      phase = 'choice'
      outcome = null
      daySummary = null
      ending = null
      return result(autosave())
    },

    choose(choiceId) {
      if (!state) throw new GameRuleError('NO_GAME', '还没有开始这一周。')
      const event = getCurrentEvent(state, options.content)
      if (!event) throw new GameRuleError('NO_EVENT', '当前没有可执行的事件。')
      const applied = applyChoice(state, options.content, event.id, choiceId)
      state = applied.state
      outcome = applied.outcome
      phase = 'consequence'
      daySummary = null
      return result(autosave())
    },

    advance() {
      if (!state || !outcome) {
        throw new GameRuleError('NO_OUTCOME', '还没有可以继续的选择。')
      }
      if (!outcome.lastEventOfDay) {
        state = advanceToNextEvent(state, options.content)
        phase = 'choice'
        outcome = null
        daySummary = null
        return result(autosave())
      }
      const finished = finishDay(state, options.content)
      state = finished.state
      phase = 'daySummary'
      outcome = null
      daySummary = finished.daySummary
      if (finished.ended) ending = evaluateEnding(finished.state, options.content.endings)
      return result(autosave())
    },

    dismissDaySummary() {
      phase = 'choice'
      daySummary = null
      return result()
    },

    resume(provided) {
      open(provided ?? options.repository.loadCurrent())
      return result()
    },

    load(next, { persist = true } = {}) {
      open(next)
      return result(persist ? persistCurrent() : undefined)
    },

    reset() {
      options.repository.clearCurrent()
      open(null)
      return result()
    },
  }
}
