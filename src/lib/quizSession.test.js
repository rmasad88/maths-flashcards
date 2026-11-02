import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dueCards, review } from './srs.js';
import {
  cardsCompleted,
  cardsLeft,
  currentCard,
  gradeCard,
  revealAnswer,
  sessionStatus,
  startSession,
} from './quizSession.js';

// A fake schedule keeps these tests about the session. One test below uses the real one.
vi.mock('./srs.js', () => ({ dueCards: vi.fn(), review: vi.fn() }));

const NOW = 1000;
const first = { id: 'a', front: 'Q1', back: 'A1' };
const second = { id: 'b', front: 'Q2', back: 'A2' };
const notDue = { id: 'c', front: 'Q3', back: 'A3' };
const nextState = { ease: 2.5, intervalDays: 1, repetitions: 1, dueAt: 5000 };

beforeEach(() => {
  vi.mocked(dueCards).mockReset().mockReturnValue([first, second]);
  vi.mocked(review).mockReset().mockReturnValue(nextState);
});

describe('startSession', () => {
  it('queues only what dueCards returns, in that order', () => {
    const cards = [notDue, second, first];
    const session = startSession(cards, NOW);

    expect(dueCards).toHaveBeenCalledWith(cards, NOW);
    expect(session.queue).toEqual([first, second]);
    expect(currentCard(session)).toBe(first);
    expect(sessionStatus(session)).toBe('question');
  });

  it('is empty when nothing is due', () => {
    vi.mocked(dueCards).mockReturnValue([]);
    const session = startSession([notDue], NOW);

    expect(sessionStatus(session)).toBe('empty');
    expect(currentCard(session)).toBeNull();
  });
});

describe('revealAnswer', () => {
  it('moves from the question to the answer without changing the card', () => {
    const session = revealAnswer(startSession([], NOW));

    expect(sessionStatus(session)).toBe('answer');
    expect(currentCard(session)).toBe(first);
  });

  it('does not mutate the session it is given', () => {
    const session = startSession([], NOW);
    revealAnswer(session);

    expect(sessionStatus(session)).toBe('question');
  });
});

describe('gradeCard', () => {
  it('returns the rescheduled state and the review to log', () => {
    const session = revealAnswer(startSession([], NOW));
    const result = gradeCard(session, 'good', NOW + 1);

    expect(review).toHaveBeenCalledWith(first, 'good', NOW + 1);
    expect(result.cardId).toBe('a');
    expect(result.changes).toBe(nextState);
    expect(result.review).toEqual({ cardId: 'a', grade: 'good', at: NOW + 1 });
  });

  it('moves to the next card, hiding its answer', () => {
    const session = revealAnswer(startSession([], NOW));
    const { session: next } = gradeCard(session, 'hard', NOW);

    expect(currentCard(next)).toBe(second);
    expect(sessionStatus(next)).toBe('question');
    expect(next.reviewed).toBe(1);
  });

  it('finishes after the last card', () => {
    let session = startSession([], NOW);
    session = gradeCard(revealAnswer(session), 'hard', NOW).session;
    session = gradeCard(revealAnswer(session), 'easy', NOW).session;

    expect(sessionStatus(session)).toBe('finished');
    expect(currentCard(session)).toBeNull();
    expect(session.reviewed).toBe(2);
  });

  it('sends a card graded again to the end, carrying its updated schedule', () => {
    const session = revealAnswer(startSession([], NOW));
    const { session: next } = gradeCard(session, 'again', NOW);

    expect(currentCard(next)).toBe(second);
    expect(next.queue.at(-1)).toEqual({ ...first, ...nextState });
    expect(sessionStatus(next)).toBe('question');
    expect(session.queue).toHaveLength(2);
  });

  it.each(['hard', 'good', 'easy'])('does not bring back a card graded %s', (grade) => {
    const session = revealAnswer(startSession([], NOW));

    expect(gradeCard(session, grade, NOW).session.queue).toHaveLength(2);
  });

  it('keeps asking an again card until it gets another grade', () => {
    vi.mocked(dueCards).mockReturnValue([first]);
    let session = startSession([], NOW);

    session = gradeCard(revealAnswer(session), 'again', NOW).session;
    expect(sessionStatus(session)).toBe('question');
    expect(currentCard(session).id).toBe('a');

    session = gradeCard(revealAnswer(session), 'again', NOW).session;
    expect(sessionStatus(session)).toBe('question');

    session = gradeCard(revealAnswer(session), 'good', NOW).session;
    expect(sessionStatus(session)).toBe('finished');
    expect(session.reviewed).toBe(3);
  });

  it('reviews a retried card from its updated schedule', () => {
    vi.mocked(dueCards).mockReturnValue([first]);
    const session = gradeCard(revealAnswer(startSession([], NOW)), 'again', NOW).session;
    gradeCard(revealAnswer(session), 'good', NOW + 1);

    expect(review).toHaveBeenLastCalledWith({ ...first, ...nextState }, 'good', NOW + 1);
  });

  it('lets the last grade decide when the card is next due, on the real schedule', async () => {
    const real = await vi.importActual('./srs.js');
    const DAY_MS = 24 * 60 * 60 * 1000;
    vi.mocked(review).mockImplementation(real.review);
    vi.mocked(dueCards).mockReturnValue([{ ...first, ...real.newSrsState(NOW) }]);

    let session = startSession([], NOW);
    session = gradeCard(revealAnswer(session), 'again', NOW).session;
    const { changes } = gradeCard(revealAnswer(session), 'easy', NOW + 60000);

    // Easy on a card with no repetitions is 1 day, times the 1.3 bonus, rounded up.
    expect(changes.dueAt).toBe(NOW + 60000 + 2 * DAY_MS);
    expect(changes.repetitions).toBe(1);
  });
});

describe('cardsLeft and cardsCompleted', () => {
  it('counts each unfinished card once, whatever has repeated', () => {
    let session = startSession([], NOW);
    expect(cardsLeft(session)).toBe(2);
    expect(cardsCompleted(session)).toBe(0);

    session = gradeCard(revealAnswer(session), 'again', NOW).session;
    expect(cardsLeft(session)).toBe(2);
    expect(cardsCompleted(session)).toBe(0);

    session = gradeCard(revealAnswer(session), 'good', NOW).session;
    expect(cardsLeft(session)).toBe(1);
    expect(cardsCompleted(session)).toBe(1);

    session = gradeCard(revealAnswer(session), 'again', NOW).session;
    expect(cardsLeft(session)).toBe(1);
    expect(cardsCompleted(session)).toBe(1);

    session = gradeCard(revealAnswer(session), 'good', NOW).session;
    expect(cardsLeft(session)).toBe(0);
    expect(cardsCompleted(session)).toBe(2);
    expect(session.reviewed).toBe(4);
  });

  it('does not mutate the session it is given', () => {
    const session = revealAnswer(startSession([], NOW));
    gradeCard(session, 'good', NOW);

    expect(currentCard(session)).toBe(first);
    expect(sessionStatus(session)).toBe('answer');
  });

  it('refuses a grade before the answer is revealed', () => {
    const session = startSession([], NOW);

    expect(() => gradeCard(session, 'good', NOW)).toThrow();
    expect(review).not.toHaveBeenCalled();
  });
});
