import type { ChoiceOutcome, GameState } from './models'
import {
  localPetComment as sharedLocalPetComment,
  lowestStat as sharedLowestStat,
} from '../../shared/pet-fallback.mjs'

export interface PetPayload {
  day: number
  period: string
  eventTitle: string
  choiceTitle: string
  tone: string
  toneStreak: number
  stats: Record<string, number>
  tendencies: Record<string, number>
  lowestStat: string
}

export const localPetComment = sharedLocalPetComment
export const lowestStat = sharedLowestStat

export function petPayload(state: GameState, outcome: ChoiceOutcome): PetPayload {
  return {
    day: state.day,
    period: outcome.event.period,
    eventTitle: outcome.event.title,
    choiceTitle: outcome.record.choiceTitle,
    tone: outcome.record.tone,
    toneStreak: state.toneStreak,
    stats: { ...state.stats },
    tendencies: { ...state.tendencies },
    lowestStat: sharedLowestStat(state.stats),
  }
}
