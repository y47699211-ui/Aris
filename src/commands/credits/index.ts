/**
 * Credits command - shows the user's Aris bot chat credit balance.
 *
 * Every new user is seeded with 1000 credits the first time they read their
 * balance (see src/services/credits/index.ts).
 */
import type { Command } from '../../commands.js'

const credits = {
  type: 'local',
  name: 'credits',
  description: 'Show your remaining Aris credits',
  isHidden: false,
  supportsNonInteractive: true,
  load: () => import('./cost.js'),
} satisfies Command

export default credits
