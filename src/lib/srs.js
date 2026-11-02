// Interface stub, so every branch builds. Issue "Spaced-repetition logic" implements it.

/** @returns {{ease: number, intervalDays: number, repetitions: number, dueAt: number}} */
export function newSrsState(now) {
  throw new Error('srs.js: not implemented');
}

/**
 * @param state a card, or any object with the newSrsState fields
 * @param {'again'|'hard'|'good'|'easy'} grade
 * @param {number} now epoch milliseconds
 * @returns the next { ease, intervalDays, repetitions, dueAt }
 */
export function review(state, grade, now) {
  throw new Error('srs.js: not implemented');
}

/** @returns the cards with dueAt <= now, most overdue first */
export function dueCards(cards, now) {
  throw new Error('srs.js: not implemented');
}
