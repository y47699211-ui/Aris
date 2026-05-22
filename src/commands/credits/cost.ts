import chalk from 'chalk'
import {
  formatArisCredits,
  getArisCredits,
  INITIAL_CREDITS,
} from '../../services/credits/index.js'
import type { LocalCommandCall } from '../../types/command.js'

export const call: LocalCommandCall = async () => {
  const balance = getArisCredits()
  const headline = chalk.bold(
    `Aris credits remaining: ${formatArisCredits(balance)}`,
  )
  const detail = chalk.dim(
    `Every new user starts with ${INITIAL_CREDITS.toLocaleString('en-US')} credits.\n` +
      `Credits are decremented as Aris consumes API spend (1 USD ≈ 1,000 credits).`,
  )
  return { type: 'text', value: `${headline}\n${detail}` }
}
