export interface PetFallbackPayload {
  tone?: string
  toneStreak?: number
  lowestStat?: string
  stats?: Record<string, number>
}

export function localPetComment(payload?: PetFallbackPayload): string

export function lowestStat(stats?: Record<string, number>): string
