import type { GameState, Requirement, StatKey } from './models'
import { STAT_META } from './rules'

export function requirementMet(requirement: Requirement, state: GameState): boolean {
  if (requirement.type === 'stat') {
    const key = requirement.key as StatKey
    const value = state.stats[key]
    const tolerance = Math.max(0, requirement.tolerance ?? 0)
    if (value === undefined) return false
    if (requirement.min !== undefined && value < requirement.min - tolerance) return false
    if (requirement.max !== undefined && value > requirement.max + tolerance) return false
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

export function describeGap(requirement: Requirement, state: GameState): string {
  if (requirement.type === 'stat') {
    const key = requirement.key as StatKey
    const value = state.stats[key]
    const meta = STAT_META[key]
    const label = meta?.label ?? requirement.key
    const tolerance = Math.max(0, requirement.tolerance ?? 0)
    if (requirement.min !== undefined && value < requirement.min - tolerance) {
      return `${label} ${value}，需要至少 ${requirement.min - tolerance}`
    }
    if (requirement.max !== undefined && value > requirement.max + tolerance) {
      return `${label} ${value}，需要不超过 ${requirement.max + tolerance}`
    }
  }
  return describeRequirement(requirement)
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
  const tolerance = Math.max(0, requirement.tolerance ?? 0)
  if (requirement.min !== undefined && requirement.max !== undefined) {
    return `${label}在 ${requirement.min - tolerance}–${requirement.max + tolerance} 之间`
  }
  if (requirement.min !== undefined) return `${label}至少 ${requirement.min - tolerance}`
  if (requirement.max !== undefined) return `${label}不超过 ${requirement.max + tolerance}`
  return `${label}满足条件`
}
