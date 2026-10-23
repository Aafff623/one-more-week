import type { GameState, Requirement, StatKey } from './models'
import { STAT_META } from './rules'

export function requirementMet(requirement: Requirement, state: GameState): boolean {
  if (requirement.type === 'stat') {
    const key = requirement.key as StatKey
    const value = state.stats[key]
    if (value === undefined) return false
    if (requirement.min !== undefined && value < requirement.min) return false
    if (requirement.max !== undefined && value > requirement.max) return false
    return true
  }

  const value = state.flags[requirement.key]
  if (requirement.equals === undefined) return Boolean(value)
  return value === requirement.equals
}

export function requirementsMet(
  requirements: Requirement[] | undefined,
  state: GameState,
): boolean {
  if (!requirements || requirements.length === 0) return true
  return requirements.every((requirement) => requirementMet(requirement, state))
}

export function describeRequirement(requirement: Requirement): string {
  if (requirement.label) return requirement.label

  if (requirement.type === 'flag') {
    return requirement.equals === false
      ? `还没有完成「${requirement.key}」`
      : `已经完成「${requirement.key}」`
  }

  const meta = STAT_META[requirement.key as StatKey]
  const label = meta?.label ?? requirement.key
  if (requirement.min !== undefined && requirement.max !== undefined) {
    return `${label}在 ${requirement.min}–${requirement.max} 之间`
  }
  if (requirement.min !== undefined) return `${label}至少 ${requirement.min}`
  if (requirement.max !== undefined) return `${label}不超过 ${requirement.max}`
  return `${label}满足条件`
}
