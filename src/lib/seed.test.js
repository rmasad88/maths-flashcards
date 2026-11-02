import { describe, expect, it, vi } from 'vitest';
import katex from 'katex';
import { parseMaths } from '../components/Maths.jsx';
import { STARTER_DECK, seedIfEmpty } from './seed.js';

function fakeStore(cards = []) {
  return {
    listCards: () => cards,
    addCard: vi.fn(),
  };
}

describe('seedIfEmpty', () => {
  it('adds the whole deck to an empty store, passing the time through', () => {
    const store = fakeStore();
    seedIfEmpty(store, 1234);

    expect(store.addCard).toHaveBeenCalledTimes(STARTER_DECK.length);
    for (const card of STARTER_DECK) {
      expect(store.addCard).toHaveBeenCalledWith(card, 1234);
    }
  });

  it('leaves a store that already has cards alone', () => {
    const store = fakeStore([{ id: 'mine' }]);
    seedIfEmpty(store, 1234);

    expect(store.addCard).not.toHaveBeenCalled();
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
