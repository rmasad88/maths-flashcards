// Interface stub, so every branch builds. Issue "Stats page" implements it.

/**
 * Accuracy counts every grade except "again" as correct, as a fraction from 0 to 1, or null with no reviews.
 *
 * @returns {{total: number, due: number, reviewedToday: number, accuracy: number|null,
 *   streakDays: number, byTopic: Array<{topic: string, total: number, accuracy: number|null}>}}
 */
export function computeStats(cards, reviews, now) {
  throw new Error('stats.js: not implemented');
}
