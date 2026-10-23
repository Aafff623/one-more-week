import { defineStore } from 'pinia'
import { nextTick } from 'vue'
import { gameContent } from '../game/content'
import {
  GameRuleError,
  getCurrentEvent,
  getDayEvents,
  getIdentity,
  getTimeView,
} from '../game/engine'
import type {
  ChoiceOutcome,
  DaySummary,
  EndingResult,
  GameState,
  Identity,
} from '../game/models'
import {
  createRunSession,
  type GamePhase,
  type RunResult,
  type RunSession,
} from '../game/session'
import { SaveRepository, SaveValidationError, type SaveSnapshot } from '../services/SaveRepository'
import { useSettingsStore } from './settings'
import { useUiStore } from './ui'

export type Screen =
  | 'cover'
  | 'intro'
  | 'identity'
  | 'game'
  | 'ending'
  | 'share'
  | 'settings'
  | 'saves'

const repository = new SaveRepository()
let session: RunSession | null = null

function ensureSession(): RunSession {
  if (!session) {
    session = createRunSession({
      content: gameContent,
      repository,
      autoSave: () => useSettingsStore().autoSave,
    })
  }
  return session
}

export const useGameStore = defineStore('game', {
  state: () => ({
    game: null as GameState | null,
    screen: 'cover' as Screen,
    returnScreen: 'cover' as Screen,
    selectedIdentityId: 'student',
    phase: 'choice' as GamePhase,
    lastOutcome: null as ChoiceOutcome | null,
    lastDaySummary: null as DaySummary | null,
    ending: null as EndingResult | null,
    snapshots: [] as SaveSnapshot[],
    storageAvailable: true,
    booted: false,
  }),

  getters: {
    identity(state): Identity | null {
      return state.game ? getIdentity(state.game, gameContent) : null
    },
    currentEvent(state) {
      return state.game ? getCurrentEvent(state.game, gameContent) : null
    },
    dayEvents(state) {
      return state.game ? getDayEvents(state.game, gameContent) : []
    },
    timeView(state) {
      return state.game ? getTimeView(state.game) : null
    },
    hasProgress(state): boolean {
      return Boolean(state.game?.started && !state.game.completed)
    },
    selectedIdentity(state): Identity {
      return (
        gameContent.identities.find((identity) => identity.id === state.selectedIdentityId) ??
        gameContent.identities[0]
      )
    },
  },

  actions: {
    bootstrap() {
      this.applyRun(ensureSession().bootstrap())
      this.storageAvailable = repository.available
      this.snapshots = repository.listSnapshots()
      this.selectedIdentityId = this.game?.identityId ?? 'student'
      this.screen = 'cover'
      this.booted = true
    },

    applyRun(result: RunResult) {
      this.game = result.view.game
      this.phase = result.view.phase
      this.lastOutcome = result.view.outcome
      this.lastDaySummary = result.view.daySummary
      this.ending = result.view.ending
      if (result.saveWarning) useUiStore().notify(result.saveWarning)
    },

    setScreen(screen: Screen) {
      this.screen = screen
      this.scrollTop()
    },

    start(identityId: string) {
      try {
        this.applyRun(ensureSession().start(identityId))
        this.selectedIdentityId = identityId
        this.screen = 'game'
        this.scrollTop()
      } catch (error) {
        this.reportError(error, '开始游戏失败')
      }
    },

    continueGame() {
      try {
        this.applyRun(ensureSession().resume(this.game ?? undefined))
        this.screen = 'game'
        this.scrollTop()
      } catch (error) {
        this.reportError(error, '继续游戏失败')
      }
    },

    choose(choiceId: string) {
      try {
        this.applyRun(ensureSession().choose(choiceId))
        this.scrollTop()
      } catch (error) {
        this.reportError(error, '这个选择暂时不能执行')
      }
    },

    continueAfterChoice() {
      try {
        this.applyRun(ensureSession().advance())
        this.scrollTop()
      } catch (error) {
        this.reportError(error, '结算这一天时出了问题')
      }
    },

    continueAfterDay() {
      if (!this.game) return
      if (this.game.completed) {
        this.screen = 'ending'
        this.scrollTop()
        return
      }
      this.applyRun(ensureSession().dismissDaySummary())
      this.scrollTop()
    },

    viewEnding() {
      if (!this.game?.completed) return
      if (!this.ending) {
        this.applyRun(ensureSession().load(this.game, { persist: false }))
      }
      this.screen = 'ending'
      this.scrollTop()
    },

    openShare() {
      if (!this.ending) return
      this.returnScreen = 'ending'
      this.screen = 'share'
      this.scrollTop()
    },

    openSettings() {
      this.returnScreen = this.screen
      this.screen = 'settings'
      this.scrollTop()
    },

    openSaves() {
      this.returnScreen = this.screen
      this.screen = 'saves'
      this.refreshSnapshots()
      this.scrollTop()
    },

    closeOverlay() {
      this.screen = this.returnScreen
      this.scrollTop()
    },

    restart() {
      const ui = useUiStore()
      try {
        this.applyRun(ensureSession().reset())
        this.screen = 'identity'
        this.refreshSnapshots()
        ui.notify('当前进度已清空；阅读偏好和存档快照仍然保留。')
        this.scrollTop()
      } catch (error) {
        this.reportError(error, '清空进度失败')
      }
    },

    saveNow() {
      if (!this.game) return
      try {
        repository.saveCurrent(this.game)
        useUiStore().notify('已保存当前进度。')
      } catch (error) {
        this.reportError(error, '保存失败')
      }
    },

    refreshSnapshots() {
      this.snapshots = repository.listSnapshots()
    },

    createSnapshot(name: string) {
      if (!this.game) return
      const ui = useUiStore()
      try {
        repository.createSnapshot(this.game, name)
        this.refreshSnapshots()
        ui.notify('已创建存档快照。')
      } catch (error) {
        this.reportError(error, '创建快照失败')
      }
    },

    restoreSnapshot(id: string) {
      const ui = useUiStore()
      try {
        const state = repository.restoreSnapshot(id)
        if (!state) {
          ui.notify('找不到这个存档。')
          return
        }
        this.applyRun(ensureSession().load(state))
        this.screen = state.completed ? 'ending' : 'game'
        this.refreshSnapshots()
        ui.notify('存档已恢复。')
        this.scrollTop()
      } catch (error) {
        this.reportError(error, '恢复存档失败')
      }
    },

    deleteSnapshot(id: string) {
      const ui = useUiStore()
      try {
        repository.deleteSnapshot(id)
        this.refreshSnapshots()
        ui.notify('存档快照已删除。')
      } catch (error) {
        this.reportError(error, '删除存档失败')
      }
    },

    exportJson(): string {
      if (!this.game) return ''
      try {
        return repository.exportJson(this.game, this.snapshots)
      } catch (error) {
        this.reportError(error, '导出存档失败')
        return ''
      }
    },

    importJson(raw: string): boolean {
      const ui = useUiStore()
      try {
        const result = repository.importJson(raw)
        repository.saveImported(result.game, result.snapshots)
        this.applyRun(ensureSession().load(result.game, { persist: false }))
        this.snapshots = result.snapshots
        this.screen = result.game.completed ? 'ending' : 'game'
        ui.notify('存档已导入。')
        this.scrollTop()
        return true
      } catch (error) {
        this.reportError(error, '导入失败：文件不是有效的《再来一周》存档')
        return false
      }
    },

    scrollTop() {
      if (typeof window === 'undefined') return
      const settings = useSettingsStore()
      void nextTick().then(() => {
        window.scrollTo({ top: 0, behavior: settings.reduceMotion ? 'auto' : 'smooth' })
      })
    },

    reportError(error: unknown, fallback: string) {
      const ui = useUiStore()
      if (error instanceof GameRuleError || error instanceof SaveValidationError) {
        ui.notify(error.message)
        return
      }
      console.error(error)
      ui.notify(fallback)
    },
  },
})
