import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeStats } from './stats.js';

// Local wall-clock times, so these tests hold in any time zone. Months count from 1 here.
const at = (month, day, hour = 12, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();
const NOW = at(6, 15);

const card = (id, topic, dueAt = NOW + 1000) => ({ id, topic, dueAt });
const review = (cardId, grade, time = NOW) => ({ cardId, grade, at: time });
const reviewsAt = (...times) => times.map((time) => review('a', 'good', time));

describe('computeStats with nothing to count', () => {
  it('handles no cards and no reviews', () => {
    expect(computeStats([], [], NOW)).toEqual({
      total: 0,
      due: 0,
      reviewedToday: 0,
      accuracy: null,
      streakDays: 0,
      byTopic: [],
    });
  });

  it('gives null accuracy and a zero streak to cards with no reviews', () => {
    const stats = computeStats([card('a', 'Algebra')], [], NOW);
    expect(stats.accuracy).toBeNull();
    expect(stats.streakDays).toBe(0);
    expect(stats.byTopic).toEqual([{ topic: 'Algebra', total: 1, accuracy: null }]);
  });
});

describe('computeStats totals', () => {
  it('counts all cards, and as due those with dueAt <= now', () => {
    const cards = [card('a', 'x', NOW - 1), card('b', 'x', NOW), card('c', 'x', NOW + 1)];
    const stats = computeStats(cards, [], NOW);
    expect(stats.total).toBe(3);
    expect(stats.due).toBe(2);
  });

  it('counts reviews from the start to the end of the local day only', () => {
    const reviews = reviewsAt(at(6, 14, 23, 59), at(6, 15, 0, 0), at(6, 15, 23, 59), at(6, 16, 0, 0));
    expect(computeStats([], reviews, NOW).reviewedToday).toBe(2);
  });
});

describe('computeStats accuracy', () => {
  it('counts every grade except "again" as correct', () => {
    const reviews = ['again', 'hard', 'good', 'easy'].map((grade) => review('a', grade));
    expect(computeStats([], reviews, NOW).accuracy).toBe(0.75);
  });

  it('is 0, not null, when every review is "again"', () => {
    expect(computeStats([], [review('a', 'again')], NOW).accuracy).toBe(0);
  });
});

describe('computeStats byTopic', () => {
  it('groups cards and their reviews by topic, sorted by topic', () => {
    const cards = [card('a', 'Calculus'), card('b', 'Algebra'), card('c', 'Calculus'), card('d', 'Primes')];
    const reviews = [review('a', 'good'), review('c', 'again'), review('b', 'easy')];
    expect(computeStats(cards, reviews, NOW).byTopic).toEqual([
      { topic: 'Algebra', total: 1, accuracy: 1 },
      { topic: 'Calculus', total: 2, accuracy: 0.5 },
      { topic: 'Primes', total: 1, accuracy: null },
    ]);
  });

  it('keeps reviews of deleted cards in the overall figures but in no topic', () => {
    const stats = computeStats([card('a', 'Algebra')], [review('gone', 'again'), review('a', 'good')], NOW);
    expect(stats.accuracy).toBe(0.5);
    expect(stats.byTopic).toEqual([{ topic: 'Algebra', total: 1, accuracy: 1 }]);
  });
});

describe('computeStats streak', () => {
  const streak = (reviews, now = NOW) => computeStats([], reviews, now).streakDays;

  it('counts consecutive days ending today', () => {
    expect(streak(reviewsAt(at(6, 13), at(6, 14), at(6, 15)))).toBe(3);
  });

  it('counts a day with several reviews once, in any order', () => {
    expect(streak(reviewsAt(at(6, 15, 9), at(6, 14), at(6, 15, 10)))).toBe(2);
  });

  it('stays alive through today until today has passed', () => {
    expect(streak(reviewsAt(at(6, 13), at(6, 14)))).toBe(2);
  });

  it('is zero once a whole day has been missed', () => {
    expect(streak(reviewsAt(at(6, 12), at(6, 13)))).toBe(0);
  });

  it('stops at a gap', () => {
    expect(streak(reviewsAt(at(6, 10), at(6, 11), at(6, 14), at(6, 15)))).toBe(2);
  });

  it('crosses month and year ends', () => {
    expect(streak(reviewsAt(at(6, 30), at(7, 1)), at(7, 1))).toBe(2);
    const newYear = new Date(2027, 0, 1, 12).getTime();
    expect(streak(reviewsAt(at(12, 31), newYear), newYear)).toBe(2);
  });
});

// process.env.TZ takes effect at once in Node, and Vitest runs each test file in its own process.
describe('computeStats uses local calendar days', () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/New_York';
  });

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it('has really switched zone', () => {
    expect(new Date(Date.UTC(2026, 0, 11, 4, 30)).getDate()).toBe(10);
  });

  it('splits days at local midnight, not UTC midnight', () => {
    // 04:30 and 05:30 UTC on the same UTC day, but either side of midnight in New York.
    const beforeMidnight = new Date(2026, 0, 10, 23, 30).getTime();
    const afterMidnight = new Date(2026, 0, 11, 0, 30).getTime();
    const stats = computeStats([], reviewsAt(beforeMidnight, afterMidnight), new Date(2026, 0, 11, 12).getTime());
    expect(stats.reviewedToday).toBe(1);
    expect(stats.streakDays).toBe(2);
  });

  it('keeps a streak across the 23-hour day when clocks go forward', () => {
    // Clocks go forward on 8 March 2026 in New York.
    const reviews = reviewsAt(
      new Date(2026, 2, 7, 12).getTime(),
      new Date(2026, 2, 8, 12).getTime(),
      new Date(2026, 2, 9, 0, 10).getTime(),
    );
    expect(computeStats([], reviews, new Date(2026, 2, 9, 0, 20).getTime()).streakDays).toBe(3);
  });

  it('keeps a streak across the 25-hour day when clocks go back', () => {
    // Clocks go back on 1 November 2026 in New York.
    const reviews = reviewsAt(
      new Date(2026, 9, 31, 12).getTime(),
      new Date(2026, 10, 1, 12).getTime(),
      new Date(2026, 10, 2, 23, 50).getTime(),
    );
    expect(computeStats([], reviews, new Date(2026, 10, 2, 23, 55).getTime()).streakDays).toBe(3);
  });
});
