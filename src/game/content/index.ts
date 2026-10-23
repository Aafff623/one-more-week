import type { GameContent } from '../models'
import { endings } from './endings'
import { events } from './events'
import { extraEvents } from './events-extra'
import { identities } from './identities'

export const gameContent: GameContent = {
  identities,
  events: [...events, ...extraEvents],
  endings,
}
