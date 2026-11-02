import { newSrsState } from './srs.js';

const CARDS_KEY = 'maths-flashcards:cards';
const REVIEWS_KEY = 'maths-flashcards:reviews';
const GRADES = ['again', 'hard', 'good', 'easy'];

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

function isCard(value) {
  return (
    ['id', 'front', 'back', 'topic'].every((key) => typeof value?.[key] === 'string') &&
    ['createdAt', 'ease', 'intervalDays', 'repetitions', 'dueAt'].every((key) =>
      Number.isFinite(value[key]),
    )
  );
}

function isReview(value) {
  return (
    typeof value?.cardId === 'string' && GRADES.includes(value.grade) && Number.isFinite(value.at)
  );
}

// A stored value that fails its check would vanish on the next read, so it is refused up front.
function assertValid(value, isValid, name) {
  if (!isValid(value)) {
    throw new TypeError(`storage.js: invalid ${name}`);
  }
}

// Not crypto.randomUUID, which browsers only offer on https and localhost.
function newId(now) {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Nothing is cached: every call reads the backend, so results are always fresh copies.
 * Corrupt or missing data reads as empty, and invalid entries in a list are dropped.
 * The next write to that list then replaces what was stored.
 * Writes throw if the backend throws, or if the data would be invalid.
 *
 * @param {Storage} [backend] anything with getItem and setItem; localStorage by default
 * @returns a store: { listCards(), getCard(id), addCard({front, back, topic}, now),
 *   updateCard(id, changes), deleteCard(id), logReview(review), listReviews() }
 *   addCard fills in id, createdAt and the newSrsState fields, and returns the card.
 *   getCard and updateCard return null for an unknown id. updateCard returns the updated card.
 *   deleteCard keeps the card's reviews, so stats history survives; expect orphaned cardIds.
 */
export function createStore(backend) {
  // Looked up on use, because merely touching localStorage throws when site data is blocked.
  const target = () => backend ?? localStorage;

  function read(key, isValid) {
    try {
      const stored = JSON.parse(target().getItem(key));
      return Array.isArray(stored) ? stored.filter(isValid) : [];
    } catch {
      return [];
    }
  }

  function write(key, items) {
    target().setItem(key, JSON.stringify(items));
  }

  const listCards = () => read(CARDS_KEY, isCard);
  const listReviews = () => read(REVIEWS_KEY, isReview);

  return {
    listCards,
    listReviews,

    getCard(id) {
      return listCards().find((card) => card.id === id) ?? null;
    },

    addCard({ front, back, topic }, now = Date.now()) {
      const card = { id: newId(now), front, back, topic, createdAt: now, ...newSrsState(now) };
      assertValid(card, isCard, 'card');
      write(CARDS_KEY, [...listCards(), card]);
      return card;
    },

    updateCard(id, changes) {
      const cards = listCards();
      const index = cards.findIndex((card) => card.id === id);
      if (index === -1) {
        return null;
      }
      const updated = { ...cards[index], ...changes, id };
      assertValid(updated, isCard, 'card');
      cards[index] = updated;
      write(CARDS_KEY, cards);
      return updated;
    },

    deleteCard(id) {
      write(
        CARDS_KEY,
        listCards().filter((card) => card.id !== id),
      );
    },

    logReview(review) {
      assertValid(review, isReview, 'review');
      write(REVIEWS_KEY, [...listReviews(), review]);
    },
  };
}

let store;

/** @returns the app's one store, created on first call and backed by localStorage. */
export function getStore() {
  store ??= createStore();
  return store;
}
