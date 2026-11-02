// A simplified SM-2 schedule, as pure functions.

const STARTING_EASE = 2.5;
const MINIMUM_EASE = 1.3;
const EASY_BONUS = 1.3;
const EASE_CHANGE = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };

/** @returns {{ease: number, intervalDays: number, repetitions: number, dueAt: number}} */
export function newSrsState(now) {
  return { ease: STARTING_EASE, intervalDays: 0, repetitions: 0, dueAt: now };
}

function goodInterval({ ease, intervalDays, repetitions }) {
  // Ties with hard whenever repetitions is 0: on a new card and straight after "again".
  if (repetitions === 0) return 1;
  if (repetitions === 1) return 6;
  // At low ease, rounding alone could leave a short interval stuck at the same length.
  return Math.max(intervalDays + 1, Math.round(intervalDays * ease));
}

function nextInterval(state, grade) {
  // One day, with no same-session retry as classic SM-2 has; a session must re-queue the card itself.
  if (grade === 'again') return 1;
  // Hard repeats the last gap, so it never shortens the interval or passes good.
  if (grade === 'hard') return Math.max(1, state.intervalDays);
  if (grade === 'good') return goodInterval(state);
  // Rounding up keeps easy strictly longer than good, even at one day.
  return Math.ceil(goodInterval(state) * EASY_BONUS);
}

function startOfLocalDayAfter(now, days) {
  const date = new Date(now);
  // Calendar arithmetic: Date rolls over months and finds the day's first moment across clock changes.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/**
 * dueAt is the start of the local day intervalDays days after now.
 *
 * @param state a card, or any object with the newSrsState fields
 * @param {'again'|'hard'|'good'|'easy'} grade
 * @param {number} now epoch milliseconds
 * @returns the next { ease, intervalDays, repetitions, dueAt }
 */
export function review(state, grade, now) {
  if (!Object.hasOwn(EASE_CHANGE, grade)) {
    throw new Error(`srs.js: unknown grade "${grade}"`);
  }
  const intervalDays = nextInterval(state, grade);
  return {
    ease: Math.max(MINIMUM_EASE, state.ease + EASE_CHANGE[grade]),
    intervalDays,
    repetitions: grade === 'again' ? 0 : state.repetitions + 1,
    dueAt: startOfLocalDayAfter(now, intervalDays),
  };
}

/** @returns the cards with dueAt <= now, most overdue first */
export function dueCards(cards, now) {
  return cards.filter((card) => card.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
}
