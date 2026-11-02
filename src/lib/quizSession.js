import { dueCards, review } from './srs.js';

/**
 * @typedef {Object} QuizSession
 * @property {Array} queue the cards to quiz, in order; a card graded "again" is added again at the end
 * @property {number} reviewed how many grades have been given, which is also the current queue position
 * @property {boolean} revealed whether the current card's answer is showing
 */

/**
 * Starts a session on the cards due at `now`. Each due card is asked until it gets a grade other than "again".
 *
 * @returns {QuizSession}
 */
export function startSession(cards, now) {
  return { queue: dueCards(cards, now), reviewed: 0, revealed: false };
}

/** @returns the card being asked, or null when there is none */
export function currentCard(session) {
  return session.queue[session.reviewed] ?? null;
}

/** @returns {'empty'|'question'|'answer'|'finished'} */
export function sessionStatus(session) {
  if (session.queue.length === 0) {
    return 'empty';
  }
  if (session.reviewed === session.queue.length) {
    return 'finished';
  }
  return session.revealed ? 'answer' : 'question';
}

/** @returns {number} how many cards still need a grade other than "again"; each is queued once ahead */
export function cardsLeft(session) {
  return session.queue.length - session.reviewed;
}

/** @returns {number} how many different cards have had a grade other than "again" */
export function cardsCompleted(session) {
  return new Set(session.queue.map((card) => card.id)).size - cardsLeft(session);
}

/** @returns {QuizSession} the session with the current card's answer showing */
export function revealAnswer(session) {
  return { ...session, revealed: true };
}

/**
 * Grades the current card. Saving is left to the caller, so this stays pure.
 *
 * @param {QuizSession} session must be showing an answer
 * @param {'again'|'hard'|'good'|'easy'} grade
 * @param {number} now epoch milliseconds
 * @returns {{session: QuizSession, cardId: string, changes: Object, review: Object}}
 *   the next session, plus the card's new schedule and the review to log
 */
export function gradeCard(session, grade, now) {
  if (sessionStatus(session) !== 'answer') {
    throw new Error('gradeCard: no answer is showing');
  }
  const card = currentCard(session);
  const changes = review(card, grade, now);
  const queue = grade === 'again' ? [...session.queue, { ...card, ...changes }] : session.queue;
  return {
    session: { ...session, queue, reviewed: session.reviewed + 1, revealed: false },
    cardId: card.id,
    changes,
    review: { cardId: card.id, grade, at: now },
  };
}
