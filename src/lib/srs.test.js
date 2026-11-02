import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dueCards, newSrsState, review } from './srs.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 15, 12);

// Pins the local time zone, so expected instants can be written in UTC, whatever the machine's zone.
function useTimeZone(zone) {
  let previous;
  beforeAll(() => {
    previous = process.env.TZ;
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  });
}

useTimeZone('America/New_York');

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
    // 15 days after 15 January, at midnight in New York (UTC-5).
    expect(review(overdue, 'good', NOW).dueAt).toBe(Date.UTC(2026, 0, 30, 5));
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
    expect(next.dueAt).toBe(Date.UTC(2026, 0, 16, 5));
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

describe('dueAt counts local calendar days', () => {
  // Hard repeats the last interval, so this schedules a card a chosen number of days ahead.
  const dueIn = (intervalDays, now) =>
    review({ ease: 2.5, intervalDays, repetitions: 3, dueAt: now }, 'hard', now).dueAt;

  it('makes a card graded at 21:00 with a one-day interval due from local midnight', () => {
    // 21:00 EST on 15 January is 02:00 UTC on the 16th; midnight EST on the 16th is 05:00 UTC.
    const next = review(newSrsState(NOW), 'again', Date.UTC(2026, 0, 16, 2));
    expect(next.dueAt).toBe(Date.UTC(2026, 0, 16, 5));
  });

  it('gives the same due time at any time of the graded day', () => {
    const due = Date.UTC(2026, 0, 16, 5);
    // 00:00 and 23:59 EST on 15 January.
    expect(dueIn(1, Date.UTC(2026, 0, 15, 5))).toBe(due);
    expect(dueIn(1, Date.UTC(2026, 0, 16, 4, 59))).toBe(due);
  });

  it('rolls over the end of a month and a year', () => {
    // Noon EST on 20 December 2026, plus 15 days, is 4 January 2027.
    expect(dueIn(15, Date.UTC(2026, 11, 20, 17))).toBe(Date.UTC(2027, 0, 4, 5));
  });

  it('uses the local day, not the UTC day, east of Greenwich', () => {
    // No clock changes in Tokyo (UTC+9): 05:00 on 16 January is still the 15th in UTC.
    process.env.TZ = 'Asia/Tokyo';
    try {
      expect(dueIn(1, Date.UTC(2026, 0, 15, 20))).toBe(Date.UTC(2026, 0, 16, 15));
    } finally {
      process.env.TZ = 'America/New_York';
    }
  });

  describe('across a daylight-saving change in New York', () => {
    it('keeps midnight when the clocks go forward, on the short 8 March 2026', () => {
      // Graded 21:00 EST on 7 March: midnight on the 8th is EST, on the 9th it is EDT (UTC-4).
      const graded = Date.UTC(2026, 2, 8, 2);
      expect(dueIn(1, graded)).toBe(Date.UTC(2026, 2, 8, 5));
      expect(dueIn(2, graded)).toBe(Date.UTC(2026, 2, 9, 4));
      // Noon EST on 5 March, six days on.
      expect(dueIn(6, Date.UTC(2026, 2, 5, 17))).toBe(Date.UTC(2026, 2, 11, 4));
    });

    it('keeps midnight when the clocks go back, on the long 1 November 2026', () => {
      // Graded 21:00 EDT on 31 October: midnight on 1 November is EDT, on the 2nd it is EST.
      const graded = Date.UTC(2026, 10, 1, 1);
      expect(dueIn(1, graded)).toBe(Date.UTC(2026, 10, 1, 4));
      expect(dueIn(2, graded)).toBe(Date.UTC(2026, 10, 2, 5));
      // 23:00 EST on 1 November, the last hour of the long day.
      expect(dueIn(1, Date.UTC(2026, 10, 2, 4))).toBe(Date.UTC(2026, 10, 2, 5));
    });
  });

  describe('where the clocks change at midnight, in Havana', () => {
    useTimeZone('America/Havana');

    it('uses the first moment of a day that has no midnight', () => {
      // On 8 March 2026 Havana jumps from 00:00 to 01:00, which is 05:00 UTC.
      expect(dueIn(1, Date.UTC(2026, 2, 8, 2))).toBe(Date.UTC(2026, 2, 8, 5));
    });

    it('uses the first of two midnights', () => {
      // On 1 November 2026 Havana goes back from 01:00 to 00:00: 04:00 UTC, then 05:00 UTC.
      expect(dueIn(1, Date.UTC(2026, 10, 1, 1))).toBe(Date.UTC(2026, 10, 1, 4));
    });
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
