import { describe, expect, it } from 'vitest';
import { dueCards, newSrsState, review } from './srs.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 15, 12);

// Applies grades in turn, one review per interval, and returns every state on the way.
function reviewInSequence(grades, start = newSrsState(NOW)) {
  const states = [];
  let state = start;
  for (const grade of grades) {
    state = review(state, grade, state.dueAt);
    states.push(state);
  }
  return states;
}

describe('newSrsState', () => {
  it('is due straight away, with the starting ease', () => {
    expect(newSrsState(NOW)).toEqual({ ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: NOW });
  });
});

describe('review with good', () => {
  it('grows the interval over repeated reviews, keeping the ease', () => {
    const states = reviewInSequence(['good', 'good', 'good', 'good', 'good']);
    expect(states.map((s) => s.intervalDays)).toEqual([1, 6, 15, 38, 95]);
    expect(states.map((s) => s.repetitions)).toEqual([1, 2, 3, 4, 5]);
    expect(states.every((s) => s.ease === 2.5)).toBe(true);
  });

  it('sets dueAt from now, not from the old dueAt', () => {
    const overdue = { ease: 2.5, intervalDays: 6, repetitions: 2, dueAt: NOW - 30 * DAY };
    expect(review(overdue, 'good', NOW).dueAt).toBe(NOW + 15 * DAY);
  });

  it('still grows a one-day interval at the minimum ease, where rounding would stall it', () => {
    const state = { ease: 1.3, intervalDays: 1, repetitions: 5, dueAt: NOW };
    expect(review(state, 'good', NOW).intervalDays).toBe(2);
  });
});

describe('review with again', () => {
  const learnt = { ease: 2.5, intervalDays: 95, repetitions: 5, dueAt: NOW };

  it('resets repetitions and the interval, and lowers the ease', () => {
    const next = review(learnt, 'again', NOW);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.dueAt).toBe(NOW + DAY);
    expect(next.ease).toBeCloseTo(2.3);
  });

  it('restarts the interval sequence afterwards', () => {
    const [, ...after] = reviewInSequence(['again', 'good', 'good'], learnt);
    expect(after.map((s) => s.intervalDays)).toEqual([1, 6]);
  });
});

describe('minimum ease', () => {
  it.each(['again', 'hard'])('never goes below 1.3 on repeated %s', (grade) => {
    const states = reviewInSequence(Array(20).fill(grade));
    expect(states.at(-1).ease).toBe(1.3);
    expect(states.every((s) => s.ease >= 1.3)).toBe(true);
  });

  it('lets easy raise the ease back up from the minimum', () => {
    const state = { ease: 1.3, intervalDays: 6, repetitions: 2, dueAt: NOW };
    expect(review(state, 'easy', NOW).ease).toBeCloseTo(1.45);
  });
});

describe('hard and easy compared with good', () => {
  const allGrades = (state) => ({
    hard: review(state, 'hard', NOW),
    good: review(state, 'good', NOW),
    easy: review(state, 'easy', NOW),
  });

  it('orders the intervals hard < good < easy on a learnt card', () => {
    const { hard, good, easy } = allGrades({
      ease: 2.5,
      intervalDays: 6,
      repetitions: 2,
      dueAt: NOW,
    });
    expect([hard.intervalDays, good.intervalDays, easy.intervalDays]).toEqual([6, 15, 20]);
  });

  it('orders them on the second review too', () => {
    const { hard, good, easy } = allGrades({
      ease: 2.5,
      intervalDays: 1,
      repetitions: 1,
      dueAt: NOW,
    });
    expect([hard.intervalDays, good.intervalDays, easy.intervalDays]).toEqual([1, 6, 8]);
  });

  it('gives hard and good the one-day minimum on the first review, and easy more', () => {
    const { hard, good, easy } = allGrades(newSrsState(NOW));
    expect([hard.intervalDays, good.intervalDays, easy.intervalDays]).toEqual([1, 1, 2]);
  });

  it('ties hard and good straight after again too, with hard still lowering the ease', () => {
    const lapsed = review({ ease: 2.5, intervalDays: 95, repetitions: 5, dueAt: NOW }, 'again', NOW);
    const { hard, good, easy } = allGrades(lapsed);
    expect([hard.intervalDays, good.intervalDays, easy.intervalDays]).toEqual([1, 1, 2]);
    expect(hard.ease).toBeLessThan(good.ease);
  });

  it('orders them at the minimum ease, where rounding could tie them', () => {
    const { hard, good, easy } = allGrades({
      ease: 1.3,
      intervalDays: 1,
      repetitions: 4,
      dueAt: NOW,
    });
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
    expect(good.intervalDays).toBeLessThan(easy.intervalDays);
  });

  it('lowers the ease on hard, raises it on easy, and counts both as a repetition', () => {
    const { hard, good, easy } = allGrades({
      ease: 2.5,
      intervalDays: 6,
      repetitions: 2,
      dueAt: NOW,
    });
    expect(hard.ease).toBeCloseTo(2.35);
    expect(good.ease).toBe(2.5);
    expect(easy.ease).toBeCloseTo(2.65);
    expect([hard.repetitions, good.repetitions, easy.repetitions]).toEqual([3, 3, 3]);
  });
});

describe('review contract', () => {
  it('does not mutate the input, and returns only the schedule fields of a card', () => {
    const card = Object.freeze({
      id: 'c1',
      front: 'f',
      back: 'b',
      topic: 't',
      createdAt: NOW,
      ease: 2.5,
      intervalDays: 6,
      repetitions: 2,
      dueAt: NOW,
    });
    for (const grade of ['again', 'hard', 'good', 'easy']) {
      const next = review(card, grade, NOW);
      expect(Object.keys(next).sort()).toEqual(['dueAt', 'ease', 'intervalDays', 'repetitions']);
    }
    expect(card.intervalDays).toBe(6);
  });

  it('throws on an unknown grade rather than scheduling with NaN', () => {
    expect(() => review(newSrsState(NOW), 'perfect', NOW)).toThrow(/perfect/);
  });
});

describe('dueCards', () => {
  const card = (id, dueAt) => Object.freeze({ id, dueAt });

  it('returns the due cards, most overdue first', () => {
    const cards = [card('a', NOW - DAY), card('b', NOW - 3 * DAY), card('c', NOW - 2 * DAY)];
    expect(dueCards(cards, NOW).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('includes a card due exactly now and leaves out future cards', () => {
    const cards = [card('later', NOW + 1), card('now', NOW)];
    expect(dueCards(cards, NOW).map((c) => c.id)).toEqual(['now']);
  });

  it('returns an empty list when nothing is due', () => {
    expect(dueCards([], NOW)).toEqual([]);
    expect(dueCards([card('later', NOW + DAY)], NOW)).toEqual([]);
  });

  it('does not reorder or mutate the input array', () => {
    const cards = Object.freeze([card('a', NOW - DAY), card('b', NOW - 2 * DAY)]);
    expect(dueCards(cards, NOW).map((c) => c.id)).toEqual(['b', 'a']);
    expect(cards.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
