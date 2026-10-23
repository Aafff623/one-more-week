import type { ChoiceRecord } from './models'

export function selectMoments(
  history: ChoiceRecord[],
  echoChoiceIds: ReadonlySet<string>,
  limit = 4,
): ChoiceRecord[] {
  if (history.length === 0) return []
  const selected = new Map<string, ChoiceRecord>()
  const add = (record: ChoiceRecord | undefined) => {
    if (!record) return
    selected.set(`${record.eventId}-${record.choiceId}`, record)
  }

  add(history[0])
  add(history[history.length - 1])
  add([...history].reverse().find((record) => echoChoiceIds.has(record.choiceId)))
  add(history[Math.floor((history.length - 1) / 2)])

  const sampled = [
    Math.floor((history.length - 1) / 3),
    Math.floor(((history.length - 1) * 2) / 3),
  ]
  for (const index of sampled) {
    if (selected.size >= limit) break
    add(history[index])
  }

  return [...selected.values()]
    .sort((a, b) => history.indexOf(a) - history.indexOf(b))
    .slice(0, limit)
}
