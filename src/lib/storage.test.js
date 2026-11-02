import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, getStore } from './storage.js';

// srs.js belongs to another issue, so its schedule is faked here.
vi.mock('./srs.js', () => ({
  newSrsState: (now) => ({ ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: now }),
}));

const NOW = 1_000_000;
const CARDS_KEY = 'maths-flashcards:cards';
const REVIEWS_KEY = 'maths-flashcards:reviews';

function fakeBackend(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const fields = { front: 'What is $x^2$?', back: 'x squared', topic: 'Algebra' };
const validCard = {
  ...fields,
  id: 'a',
  createdAt: 1,
  ease: 2.5,
  intervalDays: 0,
  repetitions: 0,
  dueAt: 1,
};
const validReview = { cardId: 'a', grade: 'good', at: 5 };

describe('createStore cards', () => {
  let store;

  beforeEach(() => {
    store = createStore(fakeBackend());
  });

  it('starts empty', () => {
    expect(store.listCards()).toEqual([]);
    expect(store.listReviews()).toEqual([]);
    expect(store.getCard('missing')).toBeNull();
  });

  it('addCard fills in id, createdAt and the newSrsState fields', () => {
    const card = store.addCard(fields, NOW);
    expect(card).toEqual({
      ...fields,
      id: expect.any(String),
      createdAt: NOW,
      ease: 2.5,
      intervalDays: 0,
      repetitions: 0,
      dueAt: NOW,
    });
    expect(store.getCard(card.id)).toEqual(card);
    expect(store.listCards()).toEqual([card]);
  });

  it('addCard gives each card its own id, even at the same instant', () => {
    const first = store.addCard(fields, NOW);
    const second = store.addCard(fields, NOW);
    expect(first.id).not.toBe(second.id);
  });

  it('addCard takes only front, back and topic from its input', () => {
    const card = store.addCard({ ...fields, id: 'mine', ease: 99, extra: true }, NOW);
    expect(card.id).not.toBe('mine');
    expect(card.ease).toBe(2.5);
    expect(card).not.toHaveProperty('extra');
  });

  it('addCard refuses a card it could not read back, and stores nothing', () => {
    expect(() => store.addCard({ front: 'no back or topic' }, NOW)).toThrow(TypeError);
    expect(store.listCards()).toEqual([]);
  });

  it('updateCard merges changes, keeps the rest and returns the card', () => {
    const card = store.addCard(fields, NOW);
    const updated = store.updateCard(card.id, { back: 'new back', dueAt: NOW + 10 });
    expect(updated).toEqual({ ...card, back: 'new back', dueAt: NOW + 10 });
    expect(store.getCard(card.id)).toEqual(updated);
  });

  it('updateCard cannot change the id', () => {
    const card = store.addCard(fields, NOW);
    expect(store.updateCard(card.id, { id: 'other' }).id).toBe(card.id);
    expect(store.getCard('other')).toBeNull();
  });

  it('updateCard returns null for an unknown id and changes nothing', () => {
    const card = store.addCard(fields, NOW);
    expect(store.updateCard('missing', { back: 'x' })).toBeNull();
    expect(store.listCards()).toEqual([card]);
  });

  it('updateCard refuses a change that would make the card unreadable', () => {
    const card = store.addCard(fields, NOW);
    expect(() => store.updateCard(card.id, { dueAt: NaN })).toThrow(TypeError);
    expect(store.getCard(card.id)).toEqual(card);
  });

  it('deleteCard removes only that card', () => {
    const first = store.addCard(fields, NOW);
    const second = store.addCard(fields, NOW);
    store.deleteCard(first.id);
    expect(store.listCards()).toEqual([second]);
    store.deleteCard('missing');
    expect(store.listCards()).toEqual([second]);
  });

  it('deleteCard keeps the review history', () => {
    const card = store.addCard(fields, NOW);
    const review = { cardId: card.id, grade: 'good', at: NOW };
    store.logReview(review);
    store.deleteCard(card.id);
    expect(store.listReviews()).toEqual([review]);
  });

  it('hands out copies, so editing a result does not change what is stored', () => {
    const card = store.addCard(fields, NOW);
    card.front = 'changed';
    store.listCards()[0].back = 'changed';
    expect(store.getCard(card.id)).toMatchObject(fields);
  });
});

describe('createStore reviews', () => {
  it('logReview appends in order', () => {
    const store = createStore(fakeBackend());
    const second = { ...validReview, grade: 'again', at: 6 };
    store.logReview(validReview);
    store.logReview(second);
    expect(store.listReviews()).toEqual([validReview, second]);
  });

  it('logReview refuses a review it could not read back, and stores nothing', () => {
    const store = createStore(fakeBackend());
    expect(() => store.logReview({ ...validReview, grade: 'great' })).toThrow(TypeError);
    expect(store.listReviews()).toEqual([]);
  });
});

describe('createStore persistence', () => {
  it('a new store on the same backend sees everything, as after a reload', () => {
    const backend = fakeBackend();
    const before = createStore(backend);
    const kept = before.addCard(fields, NOW);
    const dropped = before.addCard(fields, NOW);
    before.updateCard(kept.id, { topic: 'Calculus' });
    before.deleteCard(dropped.id);
    before.logReview(validReview);

    const after = createStore(backend);
    expect(after.listCards()).toEqual([{ ...kept, topic: 'Calculus' }]);
    expect(after.listReviews()).toEqual([validReview]);
  });

  it('propagates a failed write, and the store still holds the old data', () => {
    const backend = fakeBackend();
    const store = createStore(backend);
    const card = store.addCard(fields, NOW);
    backend.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(() => store.addCard(fields, NOW)).toThrow('quota exceeded');
    expect(store.listCards()).toEqual([card]);
  });
});

describe('createStore with corrupt or missing data', () => {
  it.each([
    ['invalid JSON', '{not json'],
    ['an empty string', ''],
    ['JSON null', 'null'],
    ['a number', '42'],
    ['an object', '{"id":"a"}'],
  ])('reads %s as empty lists', (_name, stored) => {
    const store = createStore(fakeBackend({ [CARDS_KEY]: stored, [REVIEWS_KEY]: stored }));
    expect(store.listCards()).toEqual([]);
    expect(store.listReviews()).toEqual([]);
    expect(store.getCard('a')).toBeNull();
  });

  it.each([
    ['null', null],
    ['a string', 'card'],
    ['a card with no front', { ...validCard, front: undefined }],
    ['a card with a numeric back', { ...validCard, back: 7 }],
    ['a card with no topic', { ...validCard, topic: undefined }],
    ['a card with no id', { ...validCard, id: undefined }],
    ['a card with a null dueAt', { ...validCard, dueAt: null }],
    ['a card with a string ease', { ...validCard, ease: '2.5' }],
  ])('drops %s from the card list and keeps the good cards', (_name, bad) => {
    const stored = JSON.stringify([bad, validCard]);
    const store = createStore(fakeBackend({ [CARDS_KEY]: stored }));
    expect(store.listCards()).toEqual([validCard]);
  });

  it.each([
    ['null', null],
    ['a review with no cardId', { ...validReview, cardId: undefined }],
    ['a review with an unknown grade', { ...validReview, grade: 'great' }],
    ['a review with no time', { ...validReview, at: undefined }],
  ])('drops %s from the review list and keeps the good reviews', (_name, bad) => {
    const stored = JSON.stringify([bad, validReview]);
    const store = createStore(fakeBackend({ [REVIEWS_KEY]: stored }));
    expect(store.listReviews()).toEqual([validReview]);
  });

  it('corrupt cards do not affect reviews, or the other way round', () => {
    const store = createStore(
      fakeBackend({ [CARDS_KEY]: '{bad', [REVIEWS_KEY]: JSON.stringify([validReview]) }),
    );
    expect(store.listCards()).toEqual([]);
    expect(store.listReviews()).toEqual([validReview]);
  });

  it('can write again after reading corrupt data', () => {
    const backend = fakeBackend({ [CARDS_KEY]: '{bad' });
    const store = createStore(backend);
    const card = store.addCard(fields, NOW);
    expect(createStore(backend).listCards()).toEqual([card]);
  });

  it('reads as empty when the backend itself throws', () => {
    const store = createStore({
      getItem: () => {
        throw new Error('access denied');
      },
      setItem: () => {},
    });
    expect(store.listCards()).toEqual([]);
    expect(store.listReviews()).toEqual([]);
  });
});

describe('default backend', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('createStore uses localStorage when given no backend', () => {
    const card = createStore().addCard(fields, NOW);
    expect(JSON.parse(localStorage.getItem(CARDS_KEY))).toEqual([card]);
  });

  it('getStore returns one store, backed by localStorage', () => {
    expect(getStore()).toBe(getStore());
    const card = getStore().addCard(fields, NOW);
    expect(JSON.parse(localStorage.getItem(CARDS_KEY))).toEqual([card]);
  });
});
