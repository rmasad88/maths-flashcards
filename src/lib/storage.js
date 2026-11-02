import { newSrsState } from './srs.js';

const CARDS_KEY = 'maths-flashcards:cards';
const REVIEWS_KEY = 'maths-flashcards:reviews';
const SEEDED_KEY = 'maths-flashcards:seeded';
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

function newCard({ front, back, topic }, now) {
  const card = { id: newId(now), front, back, topic, createdAt: now, ...newSrsState(now) };
  assertValid(card, isCard, 'card');
  return card;
}

// True when a stored value holds nothing worth keeping, so it must not replace a good backup.
function isEmptyValue(raw) {
  if (raw === null || raw.trim() === '') {
    return true;
  }
  try {
    // Object() turns null, a number or a boolean into an object with no keys.
    return Object.keys(Object(JSON.parse(raw))).length === 0;
  } catch {
    return false;
  }
}

/**
 * Nothing is cached: every call reads the backend, so results are always fresh copies.
 * List reads never throw: corrupt or missing data reads as empty, and invalid entries are dropped.
 * Writes throw if the backend throws, if the stored value could not be read, or if the data would
 * be invalid. A write that would replace damaged data first copies the whole stored value to
 * `<key>:backup`, one per list, which holds the latest damage found. Nothing restores it yet.
 *
 * @param {Storage} [backend] anything with getItem and setItem; localStorage by default
 * @returns a store: { listCards(), getCard(id), addCard({front, back, topic}, now),
 *   addCards(list, now), updateCard(id, changes), deleteCard(id), logReview(review),
 *   listReviews(), isSeeded(), markSeeded() }
 *   addCard fills in id, createdAt and the newSrsState fields, and returns the card.
 *   addCards does the same for a list in one write, so it saves all of them or none.
 *   isSeeded throws if the flag cannot be read, because a wrong answer could replace stored cards.
 *   getCard and updateCard return null for an unknown id. updateCard returns the updated card.
 *   deleteCard keeps the card's reviews, so stats history survives; expect orphaned cardIds.
 */
export function createStore(backend) {
  // Looked up on use, because merely touching localStorage throws when site data is blocked.
  const target = () => backend ?? localStorage;

  // Returns the usable items, the raw stored value, and whether reading it lost anything.
  function parse(raw, isValid) {
    try {
      const stored = JSON.parse(raw);
      const items = Array.isArray(stored) ? stored.filter(isValid) : [];
      return { items, damaged: !Array.isArray(stored) || items.length < stored.length };
    } catch {
      return { items: [], damaged: true };
    }
  }

  function read(key, isValid) {
    try {
      return parse(target().getItem(key), isValid).items;
    } catch {
      return [];
    }
  }

  // Applies change to the list and saves the result. A null result means nothing to save.
  function rewrite(key, isValid, change) {
    // Unlike read, this lets a failed getItem throw: the stored value may be fine, so keep it.
    const raw = target().getItem(key);
    const { items, damaged } = parse(raw, isValid);
    const next = change(items);
    if (next === null) {
      return;
    }
    if (damaged && !isEmptyValue(raw)) {
      target().setItem(`${key}:backup`, raw);
    }
    target().setItem(key, JSON.stringify(next));
  }

  const listCards = () => read(CARDS_KEY, isCard);
  const listReviews = () => read(REVIEWS_KEY, isReview);

  return {
    listCards,
    listReviews,

    getCard(id) {
      return listCards().find((card) => card.id === id) ?? null;
    },

    addCard(fields, now = Date.now()) {
      const card = newCard(fields, now);
      rewrite(CARDS_KEY, isCard, (cards) => [...cards, card]);
      return card;
    },

    addCards(list, now = Date.now()) {
      const added = list.map((fields) => newCard(fields, now));
      rewrite(CARDS_KEY, isCard, (cards) => [...cards, ...added]);
      return added;
    },

    updateCard(id, changes) {
      let updated = null;
      rewrite(CARDS_KEY, isCard, (cards) => {
        const index = cards.findIndex((card) => card.id === id);
        if (index === -1) {
          return null;
        }
        updated = { ...cards[index], ...changes, id };
        assertValid(updated, isCard, 'card');
        cards[index] = updated;
        return cards;
      });
      return updated;
    },

    deleteCard(id) {
      rewrite(CARDS_KEY, isCard, (cards) => {
        const remaining = cards.filter((card) => card.id !== id);
        return remaining.length === cards.length ? null : remaining;
      });
    },

    logReview(review) {
      assertValid(review, isReview, 'review');
      rewrite(REVIEWS_KEY, isReview, (reviews) => [...reviews, review]);
    },

    // Any stored value counts, so a damaged flag can never bring the deck back.
    isSeeded() {
      return target().getItem(SEEDED_KEY) !== null;
    },

    markSeeded() {
      target().setItem(SEEDED_KEY, 'true');
    },
  };
}

let store;

/** @returns the app's one store, created on first call and backed by localStorage. */
export function getStore() {
  store ??= createStore();
  return store;
}
