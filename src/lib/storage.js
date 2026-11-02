// Interface stub, so every branch builds. Issue "Card storage and card manager" implements it.

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} front LaTeX allowed, in $...$ or $$...$$
 * @property {string} back LaTeX allowed, in $...$ or $$...$$
 * @property {string} topic
 * @property {number} createdAt epoch milliseconds
 * @property {number} ease
 * @property {number} intervalDays
 * @property {number} repetitions
 * @property {number} dueAt epoch milliseconds
 */

/**
 * @typedef {Object} Review
 * @property {string} cardId
 * @property {'again'|'hard'|'good'|'easy'} grade
 * @property {number} at epoch milliseconds
 */

/**
 * @param {Storage} [backend] anything with getItem and setItem; localStorage by default
 * @returns a store: { listCards(), getCard(id), addCard({front, back, topic}, now),
 *   updateCard(id, changes), deleteCard(id), logReview(review), listReviews() }
 *   addCard fills in id, createdAt and the newSrsState fields, and returns the card.
 */
export function createStore(backend) {
  throw new Error('storage.js: not implemented');
}

/** @returns the app's one store, created on first call and backed by localStorage. */
export function getStore() {
  throw new Error('storage.js: not implemented');
}
