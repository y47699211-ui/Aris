/**
 * Aris bot chat credits.
 *
 * Every user starts with INITIAL_CREDITS (1000) credits. This module is the
 * canonical place to read, decrement, and persist the user's credit balance.
 *
 * The balance lives on the global config under `arisCredits`. We treat an
 * undefined balance as "user has not been seeded yet" and seed it lazily on
 * first read so that existing config files written before this feature
 * existed are automatically topped up to 1000 credits.
 */

import {
  getGlobalConfig,
  saveGlobalConfig,
  type GlobalConfig,
} from '../../utils/config.js'

/** Default credits granted to every new Aris user. */
export const INITIAL_CREDITS = 1000

/**
 * Returns the user's current Aris credit balance.
 *
 * If the user has never been seeded, seeds them with INITIAL_CREDITS and
 * persists the change before returning.
 */
export function getArisCredits(): number {
  const config = getGlobalConfig()
  if (
    config.arisCreditsInitialized === true &&
    typeof config.arisCredits === 'number'
  ) {
    return config.arisCredits
  }
  return seedInitialCredits(config)
}

/**
 * Seeds the user with INITIAL_CREDITS and returns the seeded balance.
 *
 * Idempotent: subsequent calls re-read the persisted balance instead of
 * resetting it.
 */
function seedInitialCredits(config: GlobalConfig): number {
  const seeded = INITIAL_CREDITS
  saveGlobalConfig({
    ...config,
    arisCredits: seeded,
    arisCreditsInitialized: true,
  })
  return seeded
}

/**
 * Decrements the user's credit balance by `amount` and persists. Returns the
 * new balance, clamped to zero so balances never go negative.
 *
 * Pass a positive `amount` to spend credits.
 */
export function spendArisCredits(amount: number): number {
  if (amount <= 0) {
    return getArisCredits()
  }
  const current = getArisCredits()
  const next = Math.max(0, current - amount)
  const config = getGlobalConfig()
  saveGlobalConfig({
    ...config,
    arisCredits: next,
    arisCreditsInitialized: true,
  })
  return next
}

/**
 * Adds `amount` credits to the user's balance (e.g. to apply a top-up or
 * promotional grant). Returns the new balance.
 */
export function grantArisCredits(amount: number): number {
  if (amount <= 0) {
    return getArisCredits()
  }
  const current = getArisCredits()
  const next = current + amount
  const config = getGlobalConfig()
  saveGlobalConfig({
    ...config,
    arisCredits: next,
    arisCreditsInitialized: true,
  })
  return next
}

/**
 * Convenience for UI surfaces: returns true if the user has at least
 * `required` credits remaining.
 */
export function hasArisCredits(required = 1): boolean {
  return getArisCredits() >= required
}

/**
 * Formats a credit balance for display, e.g. `"1,000 credits"`.
 */
export function formatArisCredits(balance: number = getArisCredits()): string {
  const formatted = balance.toLocaleString('en-US')
  return `${formatted} credit${balance === 1 ? '' : 's'}`
}
