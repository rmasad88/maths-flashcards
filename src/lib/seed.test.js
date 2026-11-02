import { describe, expect, it, vi } from 'vitest';
import katex from 'katex';
import { parseMaths } from '../components/Maths.jsx';
import { STARTER_DECK, seedIfEmpty } from './seed.js';
import { createStore } from './storage.js';

const CARDS_KEY = 'maths-flashcards:cards';
const BACKUP_KEY = 'maths-flashcards:cards:backup';
const FLAG_KEY = 'maths-flashcards:seeded';
const NOW = 1234;
const fields = { front: 'mine', back: 'b', topic: 't' };

function fakeBackend(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

// Each load of the app makes a new store on what is still in the browser, then seeds.
function load(backend, now = NOW) {
  const store = createStore(backend);
  seedIfEmpty(store, now);
  return store;
}

function failWritesTo(backend, failingKey) {
  const setItem = backend.setItem;
  backend.setItem = (key, value) => {
    if (key === failingKey) {
      throw new Error('quota exceeded');
    }
    setItem(key, value);
  };
  return () => {
    backend.setItem = setItem;
  };
}

describe('seedIfEmpty', () => {
  it('saves the whole deck on first run in one write, then sets the flag', () => {
    const backend = fakeBackend();
    const writes = [];
    const setItem = backend.setItem;
    backend.setItem = (key, value) => {
      writes.push(key);
      setItem(key, value);
    };

    const store = load(backend);

    expect(writes).toEqual([CARDS_KEY, FLAG_KEY]);
    expect(store.listCards().map((card) => card.front)).toEqual(
      STARTER_DECK.map((card) => card.front),
    );
    expect(store.listCards()[0].createdAt).toBe(NOW);
    expect(store.isSeeded()).toBe(true);
  });

  it('does not seed twice', () => {
    const backend = fakeBackend();
    load(backend);
    expect(load(backend).listCards()).toHaveLength(STARTER_DECK.length);
  });

  it('leaves zero cards after deleting every card and reloading', () => {
    const backend = fakeBackend();
    const store = load(backend);
    for (const card of store.listCards()) {
      store.deleteCard(card.id);
    }
    expect(load(backend).listCards()).toEqual([]);
  });

  it('does not replace damaged cards once the flag is set, and writes nothing', () => {
    const backend = fakeBackend({ [CARDS_KEY]: '{bad', [FLAG_KEY]: 'true' });
    const setItem = vi.spyOn(backend, 'setItem');

    const store = load(backend);

    expect(store.listCards()).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
    expect(backend.getItem(CARDS_KEY)).toBe('{bad');
  });

  it('still backs up damaged cards on a later write once the flag is set', () => {
    const backend = fakeBackend({ [CARDS_KEY]: '{bad', [FLAG_KEY]: 'true' });
    load(backend).addCard(fields, NOW);
    expect(backend.getItem(BACKUP_KEY)).toBe('{bad');
  });

  it('backs up damaged cards when seeding over them with no flag', () => {
    const backend = fakeBackend({ [CARDS_KEY]: '{bad' });
    const store = load(backend);
    expect(backend.getItem(BACKUP_KEY)).toBe('{bad');
    expect(store.listCards()).toHaveLength(STARTER_DECK.length);
  });

  it('leaves no partial deck and no flag when the save fails, and tries again next load', () => {
    const backend = fakeBackend();
    const restore = failWritesTo(backend, CARDS_KEY);

    expect(() => load(backend)).toThrow('quota exceeded');
    expect(backend.getItem(CARDS_KEY)).toBeNull();
    expect(backend.getItem(FLAG_KEY)).toBeNull();

    restore();
    const store = load(backend);
    expect(store.listCards()).toHaveLength(STARTER_DECK.length);
    expect(store.isSeeded()).toBe(true);
  });

  it('does not duplicate the deck when only the flag failed to save', () => {
    const backend = fakeBackend();
    const restore = failWritesTo(backend, FLAG_KEY);

    expect(() => load(backend)).toThrow('quota exceeded');

    restore();
    const store = load(backend);
    expect(store.listCards()).toHaveLength(STARTER_DECK.length);
    expect(store.isSeeded()).toBe(true);
  });

  it('does not seed or set the flag while the stored cards cannot be read', () => {
    const backend = fakeBackend();
    const setItem = vi.spyOn(backend, 'setItem');
    const getItem = backend.getItem;
    backend.getItem = (key) => {
      if (key === CARDS_KEY) {
        throw new Error('access denied');
      }
      return getItem(key);
    };

    expect(() => load(backend)).toThrow('access denied');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not seed a store that already holds cards, and sets the flag', () => {
    const backend = fakeBackend();
    const mine = createStore(backend).addCard(fields, NOW);

    const store = load(backend);

    expect(store.listCards()).toEqual([mine]);
    expect(store.isSeeded()).toBe(true);
  });

  it('keeps zero cards after deleting the only card of a store that had no flag', () => {
    const backend = fakeBackend();
    const mine = createStore(backend).addCard(fields, NOW);
    load(backend).deleteCard(mine.id);
    expect(load(backend).listCards()).toEqual([]);
  });
});

describe('STARTER_DECK', () => {
  it('has about 20 cards', () => {
    expect(STARTER_DECK.length).toBeGreaterThanOrEqual(18);
    expect(STARTER_DECK.length).toBeLessThanOrEqual(24);
  });

  it('covers every topic in the syllabus', () => {
    expect([...new Set(STARTER_DECK.map((card) => card.topic))].sort()).toEqual([
      'Eigenvalues and SVD',
      'Finite differences',
      'Interpolation and quadrature',
      'Linear algebra',
      'ODE time-stepping and stability',
      'Taylor series and truncation error',
    ]);
  });

  it('gives every card only a front, a back and a topic, with no repeated fronts', () => {
    for (const card of STARTER_DECK) {
      expect(Object.keys(card).sort()).toEqual(['back', 'front', 'topic']);
      expect(card.front.trim()).not.toBe('');
      expect(card.back.trim()).not.toBe('');
    }
    expect(new Set(STARTER_DECK.map((card) => card.front)).size).toBe(STARTER_DECK.length);
  });

  it('states the sign convention on every card with a signed error term', () => {
    const signed = STARTER_DECK.filter((card) => /\$-\\frac/.test(card.back));

    expect(signed).toHaveLength(4);
    for (const card of signed) {
      expect(card.back).toContain('exact minus approximation');
    }
  });

  it('says the QR least-squares card holds for the thin factorisation', () => {
    const qr = STARTER_DECK.find((card) => card.front.includes('QR'));

    expect(qr.back).toMatch(/thin/);
  });

  const sides = STARTER_DECK.flatMap((card) => [
    ['front', card.front],
    ['back', card.back],
  ]);

  it.each(sides)('%s renders without a KaTeX error: %s', (_side, text) => {
    // A JavaScript escape such as "\theta" becomes a tab plus "heta", which KaTeX accepts silently.
    expect(text).not.toMatch(/[\u0000-\u001f]/);

    for (const segment of parseMaths(text)) {
      if (segment.type === 'maths') {
        expect(() =>
          katex.renderToString(segment.value, {
            displayMode: segment.display,
            throwOnError: true,
          }),
        ).not.toThrow();
      } else {
        // A stray $ or backslash here means maths that was never typeset.
        expect(segment.value).not.toMatch(/[$\\]/);
      }
    }
  });
});
