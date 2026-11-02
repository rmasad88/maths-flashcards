import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dueCards, review } from './srs.js';
import { currentCard, gradeCard, revealAnswer, sessionStatus, startSession } from './quizSession.js';

// srs.js belongs to another issue, so these tests use a fake of it.
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
    session = gradeCard(revealAnswer(session), 'again', NOW).session;
    session = gradeCard(revealAnswer(session), 'easy', NOW).session;

    expect(sessionStatus(session)).toBe('finished');
    expect(currentCard(session)).toBeNull();
    expect(session.reviewed).toBe(2);
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
