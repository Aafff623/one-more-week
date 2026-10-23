import type { Effect, StatKey } from '../models'
import { RULES } from '../rules'

export const fx = (...pairs: [StatKey, number][]): Effect[] =>
  pairs.map(([stat, value]) => ({
    stat,
    value:
      stat !== 'money' && value > 0
        ? Math.max(1, Math.round(value * RULES.choiceGainScale))
        : value,
  }))
