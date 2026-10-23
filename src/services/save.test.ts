import { describe, expect, it } from 'vitest'
import { createGame } from '../game/engine'
import { gameContent } from '../game/content'
import { SaveRepository, SaveValidationError, type KeyValueStorage } from './SaveRepository'

const student = gameContent.identities[0]
const timestamp = '2026-10-22T00:00:00.000Z'

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }
}

function repository() {
  const storage = new MemoryStorage()
  return { storage, repo: new SaveRepository(storage) }
}

describe('SaveRepository', () => {
  it('round-trips the current game state', () => {
    const { repo } = repository()
    const state = createGame(student, timestamp)
    state.stats.mood = 71
    state.history.push({
      eventId: 'd1-morning',
      choiceId: 'd1-morning-breakfast',
      eventTitle: '闹钟响过第三次',
      choiceTitle: '去楼下吃一顿不慌的早餐',
      day: 1,
      period: 'morning',
      hours: 1,
      effects: [{ stat: 'mood', value: 7 }],
      outcome: '热豆浆和刚出炉的面包让清晨慢了下来。',
      tone: 'care',
      createdAt: timestamp,
    })

    repo.saveCurrent(state)

    expect(repo.loadCurrent()).toEqual(state)
  })

  it('preserves a corrupt save aside and returns no game', () => {
    const { storage, repo } = repository()
    storage.setItem('omw:save:current', '{"schemaVersion":1,"day":99}')

    expect(repo.loadCurrent()).toBeNull()
    expect(storage.getItem('omw:save:current')).toBeNull()
    expect(storage.getItem('omw:save:corrupt')).toContain('"day":99')
  })

  it('migrates a v1 save into the four-slot schema', () => {
    const { storage, repo } = repository()
    const state = createGame(student, timestamp)
    state.eventIndex = 3
    state.history.push({
      eventId: 'd1-morning',
      choiceId: 'd1-morning-breakfast',
      eventTitle: '闹钟响过第三次',
      choiceTitle: '去楼下吃一顿不慌的早餐',
      day: 1,
      period: 'morning',
      hours: 1,
      effects: [{ stat: 'mood', value: 4 }],
      outcome: '热豆浆和刚出炉的面包让清晨慢了下来。',
      tone: 'care',
      createdAt: timestamp,
    })
    const legacy = JSON.parse(JSON.stringify(state))
    legacy.schemaVersion = 1
    delete legacy.tendencies
    delete legacy.lastTone
    delete legacy.toneStreak
    delete legacy.history[0].period
    storage.setItem('omw:save:current', JSON.stringify(legacy))

    const loaded = repo.loadCurrent()

    expect(loaded?.schemaVersion).toBe(2)
    expect(loaded?.eventIndex).toBe(3)
    expect(loaded?.tendencies.care).toBe(1)
    expect(loaded?.lastTone).toBe('care')
    expect(loaded?.toneStreak).toBe(1)
    expect(loaded?.history[0].period).toBe('morning')
  })

  it('creates, restores, deletes and caps snapshots', () => {
    const { repo } = repository()
    const state = createGame(student, timestamp)

    for (let index = 0; index < 10; index += 1) {
      repo.createSnapshot(state, `快照 ${index + 1}`)
    }

    const snapshots = repo.listSnapshots()
    expect(snapshots).toHaveLength(8)
    expect(snapshots[0].name).toBe('快照 10')

    const restored = repo.restoreSnapshot(snapshots[0].id)!
    expect(restored).toEqual(state)
    restored.stats.energy = 1
    expect(repo.restoreSnapshot(snapshots[0].id)!.stats.energy).toBe(state.stats.energy)

    repo.deleteSnapshot(snapshots[0].id)
    expect(repo.listSnapshots()).toHaveLength(7)
    expect(repo.restoreSnapshot(snapshots[0].id)).toBeNull()
  })

  it('exports and imports a complete save file', () => {
    const { repo } = repository()
    const state = createGame(student, timestamp)
    repo.createSnapshot(state, '导出前')

    const raw = repo.exportJson(state)
    const imported = repo.importJson(raw)

    expect(imported.game).toEqual(state)
    expect(imported.snapshots).toHaveLength(1)
    expect(imported.snapshots[0].name).toBe('导出前')

    const next = repository()
    next.repo.saveImported(imported.game, imported.snapshots)
    expect(next.repo.loadCurrent()).toEqual(state)
    expect(next.repo.listSnapshots()).toHaveLength(1)
  })

  it('rejects foreign, malformed, oversized and out-of-range saves', () => {
    const { repo } = repository()
    const state = createGame(student, timestamp)

    expect(() => repo.importJson('not json')).toThrow(SaveValidationError)
    expect(() =>
      repo.importJson(JSON.stringify({ product: 'Another Week', state })),
    ).toThrow('这不是《再来一周》的存档')
    expect(() =>
      repo.importJson(
        JSON.stringify({ product: 'One More Week', state: { ...state, stats: { ...state.stats, energy: 120 } } }),
      ),
    ).toThrow('状态数值越界')

    const snapshot = {
      id: 'save-1',
      name: '快照',
      createdAt: timestamp,
      day: 1,
      identityId: student.id,
      game: state,
    }
    expect(() =>
      repo.importJson(
        JSON.stringify({
          product: 'One More Week',
          state,
          snapshots: Array.from({ length: 9 }, (_, index) => ({ ...snapshot, id: `save-${index}` })),
        }),
      ),
    ).toThrow('存档快照数量过多')
  })

  it('reports unavailable storage without crashing', () => {
    const repo = new SaveRepository(null)

    expect(repo.available).toBe(false)
    expect(repo.loadCurrent()).toBeNull()
    expect(() => repo.saveCurrent(createGame(student, timestamp))).toThrow(
      '当前浏览器不允许本地存档',
    )
  })
})
