import type { ChoiceTone, GameState, SlotId, StatKey, Tendencies } from '../game/models'
import { gameContent } from '../game/content'
import { RULES, SLOTS, STAT_KEYS, TONE_KEYS, deepClone } from '../game/rules'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SaveSnapshot {
  id: string
  name: string
  createdAt: string
  day: number
  identityId: string
  game: GameState
}

export class SaveValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveValidationError'
  }
}

const CURRENT_KEY = 'omw:save:current'
const SNAPSHOTS_KEY = 'omw:save:snapshots'
const CORRUPT_KEY = 'omw:save:corrupt'

export function getDefaultStorage(): KeyValueStorage | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null
    return globalThis.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidStat(key: StatKey, value: unknown): boolean {
  if (!isFiniteNumber(value)) return false
  if (key === 'money') return value >= 0 && value <= RULES.moneyMax
  return value >= RULES.statMin && value <= RULES.statMax
}

function isValidEffect(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.stat === 'string' &&
    STAT_KEYS.includes(value.stat as StatKey) &&
    isFiniteNumber(value.value)
  )
}

const VALID_TONES = new Set<ChoiceTone>(TONE_KEYS)
const VALID_SLOTS = new Set<SlotId>(SLOTS.map((slot) => slot.id))

function emptyTendencies(): Tendencies {
  return { care: 0, focus: 0, rest: 0, connect: 0, risk: 0 }
}

function isValidTone(value: unknown): value is ChoiceTone {
  return typeof value === 'string' && VALID_TONES.has(value as ChoiceTone)
}

function isValidSlot(value: unknown): value is SlotId {
  return typeof value === 'string' && VALID_SLOTS.has(value as SlotId)
}

function migrateV1(value: Record<string, unknown>): Record<string, unknown> {
  const tendencies = emptyTendencies()
  let lastTone: ChoiceTone | null = null
  let toneStreak = 0
  const history = Array.isArray(value.history)
    ? value.history.map((item) => {
        if (!isRecord(item)) return item
        const event = gameContent.events.find((candidate) => candidate.id === item.eventId)
        const tone = isValidTone(item.tone) ? item.tone : 'care'
        tendencies[tone] += 1
        if (tone === lastTone) toneStreak += 1
        else {
          lastTone = tone
          toneStreak = 1
        }
        return { ...item, period: event?.period ?? 'afternoon' }
      })
    : []

  const daySummaries = Array.isArray(value.daySummaries)
    ? value.daySummaries.map((summary) =>
        isRecord(summary)
          ? {
              ...summary,
              slots: Array.isArray(summary.slots) ? summary.slots : [],
              toneCounts: isRecord(summary.toneCounts)
                ? { ...emptyTendencies(), ...summary.toneCounts }
                : emptyTendencies(),
            }
          : summary,
      )
    : []

  return {
    ...value,
    schemaVersion: 2,
    history,
    tendencies,
    lastTone,
    toneStreak,
    daySummaries,
  }
}

function validateSlotSummaries(value: unknown): void {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 4) throw new SaveValidationError('每日时段结算无效')
  for (const slot of value) {
    if (!isRecord(slot) || !isValidSlot(slot.period)) {
      throw new SaveValidationError('每日时段结算无效')
    }
    if (!isFiniteNumber(slot.hours) || slot.hours < 0 || slot.hours > 12) {
      throw new SaveValidationError('每日时段用时无效')
    }
  }
}

function validateTendencies(value: unknown): Tendencies {
  if (!isRecord(value)) throw new SaveValidationError('倾向数据缺失')
  const tendencies = emptyTendencies()
  for (const tone of TONE_KEYS) {
    const amount = value[tone]
    if (!Number.isInteger(amount) || (amount as number) < 0 || (amount as number) > RULES.historyLimit) {
      throw new SaveValidationError('倾向数值无效')
    }
    tendencies[tone] = amount as number
  }
  return tendencies
}

export function validateGameState(value: unknown): GameState {
  if (!isRecord(value)) throw new SaveValidationError('存档不是有效对象')
  const migrated = value.schemaVersion === 1 ? migrateV1(value) : value
  if (migrated.schemaVersion !== 2) throw new SaveValidationError('存档版本不兼容')
  if (typeof migrated.identityId !== 'string' || migrated.identityId.length === 0) {
    throw new SaveValidationError('缺少身份信息')
  }
  if (!Number.isInteger(migrated.day) || (migrated.day as number) < 1 || (migrated.day as number) > 7) {
    throw new SaveValidationError('天数无效')
  }
  if (
    !Number.isInteger(migrated.eventIndex) ||
    (migrated.eventIndex as number) < 0 ||
    (migrated.eventIndex as number) > RULES.choicesPerDay - 1
  ) {
    throw new SaveValidationError('事件进度无效')
  }
  if (
    !isFiniteNumber(migrated.freeHoursLeft) ||
    migrated.freeHoursLeft < 0 ||
    migrated.freeHoursLeft > RULES.freeHoursPerDay
  ) {
    throw new SaveValidationError('自由时间无效')
  }
  if (
    !isFiniteNumber(migrated.totalHoursUsed) ||
    migrated.totalHoursUsed < 0 ||
    migrated.totalHoursUsed > RULES.totalHours
  ) {
    throw new SaveValidationError('本周时间无效')
  }
  if (!isRecord(migrated.stats)) throw new SaveValidationError('状态数据缺失')
  for (const key of STAT_KEYS) {
    if (!isValidStat(key, migrated.stats[key])) throw new SaveValidationError('状态数值越界')
  }
  if (!Array.isArray(migrated.history) || migrated.history.length > RULES.historyLimit) {
    throw new SaveValidationError('选择记录无效')
  }
  for (const record of migrated.history) {
    if (!isRecord(record)) throw new SaveValidationError('选择记录无效')
    if (typeof record.eventId !== 'string' || typeof record.choiceId !== 'string') {
      throw new SaveValidationError('选择记录缺少事件')
    }
    if (!isValidSlot(record.period) || !isValidTone(record.tone)) {
      throw new SaveValidationError('选择记录缺少时段或倾向')
    }
    if (!Array.isArray(record.effects) || !record.effects.every(isValidEffect)) {
      throw new SaveValidationError('选择效果无效')
    }
  }
  if (!Array.isArray(migrated.pending) || migrated.pending.length > 50) {
    throw new SaveValidationError('延迟后果无效')
  }
  for (const pending of migrated.pending) {
    if (!isRecord(pending) || !Number.isInteger(pending.triggerDay)) {
      throw new SaveValidationError('延迟后果日期无效')
    }
    if (!Array.isArray(pending.effects) || !pending.effects.every(isValidEffect)) {
      throw new SaveValidationError('延迟后果效果无效')
    }
  }
  if (!Array.isArray(migrated.echoes) || migrated.echoes.length > 20) {
    throw new SaveValidationError('回响记录无效')
  }
  if (!Array.isArray(migrated.daySummaries) || migrated.daySummaries.length > 7) {
    throw new SaveValidationError('每日结算无效')
  }
  for (const summary of migrated.daySummaries) {
    if (!isRecord(summary) || !Number.isInteger(summary.day)) {
      throw new SaveValidationError('每日结算无效')
    }
    validateSlotSummaries(summary.slots)
    if (summary.toneCounts !== undefined) validateTendencies(summary.toneCounts)
  }
  if (typeof migrated.started !== 'boolean' || typeof migrated.completed !== 'boolean') {
    throw new SaveValidationError('游戏状态无效')
  }
  if (migrated.endingId !== null && typeof migrated.endingId !== 'string') {
    throw new SaveValidationError('结局数据无效')
  }
  if (typeof migrated.startedAt !== 'string' || typeof migrated.updatedAt !== 'string') {
    throw new SaveValidationError('时间戳无效')
  }
  if (!isRecord(migrated.flags)) throw new SaveValidationError('剧情标记无效')
  validateTendencies(migrated.tendencies)
  if (migrated.lastTone !== null && !isValidTone(migrated.lastTone)) {
    throw new SaveValidationError('倾向记录无效')
  }
  if (
    !Number.isInteger(migrated.toneStreak) ||
    (migrated.toneStreak as number) < 0 ||
    (migrated.toneStreak as number) > RULES.historyLimit
  ) {
    throw new SaveValidationError('连续倾向无效')
  }
  return migrated as unknown as GameState
}

function validateSnapshot(value: unknown): SaveSnapshot {
  if (!isRecord(value)) throw new SaveValidationError('存档快照不是有效对象')
  if (typeof value.id !== 'string' || typeof value.name !== 'string') {
    throw new SaveValidationError('快照缺少标识')
  }
  if (typeof value.createdAt !== 'string') throw new SaveValidationError('快照缺少时间')
  return {
    id: value.id,
    name: value.name.slice(0, 80),
    createdAt: value.createdAt,
    day: Number(value.day) || 1,
    identityId: String(value.identityId || ''),
    game: validateGameState(value.game),
  }
}

export class SaveRepository {
  constructor(private readonly storage: KeyValueStorage | null = getDefaultStorage()) {}

  get available(): boolean {
    return this.storage !== null
  }

  private requireStorage(): KeyValueStorage {
    if (!this.storage) throw new SaveValidationError('当前浏览器不允许本地存档')
    return this.storage
  }

  loadCurrent(): GameState | null {
    const storage = this.storage
    if (!storage) return null
    const raw = storage.getItem(CURRENT_KEY)
    if (!raw) return null
    try {
      return validateGameState(JSON.parse(raw))
    } catch {
      try {
        storage.setItem(CORRUPT_KEY, raw)
        storage.removeItem(CURRENT_KEY)
      } catch {
        // If the storage is already broken, there is nothing else to preserve.
      }
      return null
    }
  }

  saveCurrent(state: GameState): void {
    const storage = this.requireStorage()
    validateGameState(state)
    storage.setItem(CURRENT_KEY, JSON.stringify(state))
  }

  clearCurrent(): void {
    this.storage?.removeItem(CURRENT_KEY)
  }

  listSnapshots(): SaveSnapshot[] {
    const raw = this.storage?.getItem(SNAPSHOTS_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((item) => {
          try {
            return validateSnapshot(item)
          } catch {
            return null
          }
        })
        .filter((item): item is SaveSnapshot => item !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, RULES.snapshotLimit)
    } catch {
      return []
    }
  }

  private writeSnapshots(snapshots: SaveSnapshot[]): void {
    const storage = this.requireStorage()
    storage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots.slice(0, RULES.snapshotLimit)))
  }

  createSnapshot(state: GameState, name: string): SaveSnapshot {
    const snapshot: SaveSnapshot = {
      id: `save-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim().slice(0, 80) || `第 ${state.day} 天`,
      createdAt: new Date().toISOString(),
      day: state.day,
      identityId: state.identityId,
      game: deepClone(state),
    }
    const snapshots = [snapshot, ...this.listSnapshots()].slice(0, RULES.snapshotLimit)
    this.writeSnapshots(snapshots)
    return snapshot
  }

  restoreSnapshot(id: string): GameState | null {
    const snapshot = this.listSnapshots().find((item) => item.id === id)
    return snapshot ? deepClone(snapshot.game) : null
  }

  deleteSnapshot(id: string): void {
    this.writeSnapshots(this.listSnapshots().filter((item) => item.id !== id))
  }

  exportJson(state: GameState, snapshots: SaveSnapshot[] = this.listSnapshots()): string {
    return JSON.stringify(
      {
        product: 'One More Week',
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        state,
        snapshots,
      },
      null,
      2,
    )
  }

  importJson(raw: string): { game: GameState; snapshots: SaveSnapshot[] } {
    if (raw.length > 2_000_000) throw new SaveValidationError('存档文件过大')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new SaveValidationError('不是有效的 JSON 文件')
    }
    if (!isRecord(parsed)) throw new SaveValidationError('存档格式不正确')
    if (parsed.product && parsed.product !== 'One More Week') {
      throw new SaveValidationError('这不是《再来一周》的存档')
    }
    const game = validateGameState(parsed.state ?? parsed)
    const rawSnapshots = Array.isArray(parsed.snapshots) ? parsed.snapshots : []
    if (rawSnapshots.length > RULES.snapshotLimit) {
      throw new SaveValidationError('存档快照数量过多')
    }
    const snapshots = rawSnapshots.map(validateSnapshot)
    return { game, snapshots }
  }

  saveImported(game: GameState, snapshots: SaveSnapshot[]): void {
    this.saveCurrent(game)
    this.writeSnapshots(snapshots)
  }
}
