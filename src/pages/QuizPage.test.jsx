import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { dueCards, review } from '../lib/srs.js';
import { getStore } from '../lib/storage.js';
import QuizPage from './QuizPage.jsx';

// storage.js and srs.js belong to other issues, so these tests use fakes of them.
vi.mock('../lib/storage.js', () => ({ getStore: vi.fn() }));
vi.mock('../lib/srs.js', () => ({ dueCards: vi.fn(), review: vi.fn() }));

const first = { id: 'a', front: 'Front one', back: 'Back one', dueAt: 1 };
const second = { id: 'b', front: 'Front two', back: 'Back two', dueAt: 2 };
const later = { id: 'c', front: 'Front later', back: 'Back later', dueAt: Infinity };
const nextState = { ease: 2.5, intervalDays: 3, repetitions: 1, dueAt: 9000 };

let store;

function renderWithCards(cards) {
  store.listCards.mockReturnValue(cards);
  return render(<QuizPage />);
}

function revealAndGrade(grade) {
  fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${grade}$`, 'i') }));
}

beforeEach(() => {
  store = { listCards: vi.fn(), updateCard: vi.fn(), logReview: vi.fn() };
  vi.mocked(getStore).mockReset().mockReturnValue(store);
  vi.mocked(dueCards)
    .mockReset()
    .mockImplementation((cards, now) => cards.filter((card) => card.dueAt <= now));
  vi.mocked(review).mockReset().mockReturnValue(nextState);
});

describe('QuizPage', () => {
  it('says so when nothing is due', () => {
    renderWithCards([later]);

    expect(screen.getByText(/nothing is due/i)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Front later')).toBeNull();
  });

  it('shows one due card at a time, with its answer and grades hidden', () => {
    renderWithCards([first, second, later]);

    expect(screen.getByText('Front one')).toBeTruthy();
    expect(screen.queryByText('Front two')).toBeNull();
    expect(screen.queryByText('Back one')).toBeNull();
    expect(screen.queryByRole('button', { name: /^good$/i })).toBeNull();
    expect(screen.getByText(/^2 cards left$/i)).toBeTruthy();
  });

  it('reveals the answer and all four grades on request', () => {
    renderWithCards([first]);
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(screen.getByText('Front one')).toBeTruthy();
    expect(screen.getByText('Back one')).toBeTruthy();
    for (const grade of ['again', 'hard', 'good', 'easy']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${grade}$`, 'i') })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: /show answer/i })).toBeNull();
  });

  it.each(['again', 'hard', 'good', 'easy'])('saves and logs a grade of %s', (grade) => {
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    renderWithCards([first, second]);
    revealAndGrade(grade);
    vi.restoreAllMocks();

    expect(review).toHaveBeenCalledWith(first, grade, 5000);
    expect(store.updateCard).toHaveBeenCalledTimes(1);
    expect(store.updateCard).toHaveBeenCalledWith('a', nextState);
    expect(store.logReview).toHaveBeenCalledTimes(1);
    expect(store.logReview).toHaveBeenCalledWith({ cardId: 'a', grade, at: 5000 });
    expect(store.updateCard.mock.invocationCallOrder[0]).toBeLessThan(
      store.logReview.mock.invocationCallOrder[0],
    );
  });

  // React batches state updates until the click handler ends, so a page that advanced before
  // saving would look the same on the success path. A failing save is what exposes it.
  it.each([
    ['updateCard', /could not save/i, 0],
    ['logReview', /rescheduled.*not logged/i, 1],
  ])('stays on the card and says so when %s throws', (method, message, logCalls) => {
    store[method].mockImplementationOnce(() => {
      throw new Error('storage full');
    });
    renderWithCards([first, second]);
    revealAndGrade('good');

    expect(screen.getByRole('alert').textContent).toMatch(message);
    expect(screen.getByText('Front one')).toBeTruthy();
    expect(screen.getByText('Back one')).toBeTruthy();
    expect(screen.queryByText('Front two')).toBeNull();
    expect(store.logReview).toHaveBeenCalledTimes(logCalls);

    // Grading again retries the save, then clears the message and moves on.
    fireEvent.click(screen.getByRole('button', { name: /^good$/i }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Front two')).toBeTruthy();
  });

  it('moves to the next card with its answer hidden after grading', () => {
    renderWithCards([first, second]);
    revealAndGrade('good');

    expect(screen.getByText('Front two')).toBeTruthy();
    expect(screen.queryByText('Back two')).toBeNull();
    expect(screen.queryByText('Front one')).toBeNull();
    expect(screen.getByText(/^1 card left$/i)).toBeTruthy();
  });

  it('says the session is over after the last card', () => {
    renderWithCards([first, second]);
    revealAndGrade('good');
    revealAndGrade('easy');

    expect(screen.getByText(/session complete/i)).toBeTruthy();
    expect(screen.getByText(/reviewed 2 cards in 2 reviews/i)).toBeTruthy();
    expect(screen.queryByText(/nothing is due/i)).toBeNull();
    expect(store.logReview).toHaveBeenCalledTimes(2);
  });

  it('brings a card graded again back after the others, with its answer hidden', () => {
    renderWithCards([first, second]);
    revealAndGrade('again');

    expect(screen.getByText('Front two')).toBeTruthy();
    expect(screen.getByText(/^2 cards left$/i)).toBeTruthy();

    revealAndGrade('good');

    expect(screen.getByText('Front one')).toBeTruthy();
    expect(screen.queryByText('Back one')).toBeNull();
    expect(screen.getByText(/^1 card left$/i)).toBeTruthy();
  });

  it('saves and logs every grade of a retried card, and the last one wins', () => {
    const afterAgain = { ...nextState, dueAt: 1000 };
    const afterGood = { ...nextState, dueAt: 2000 };
    vi.mocked(review).mockReturnValueOnce(afterAgain).mockReturnValueOnce(afterGood);
    renderWithCards([first]);
    revealAndGrade('again');
    revealAndGrade('good');

    expect(store.updateCard.mock.calls).toEqual([
      ['a', afterAgain],
      ['a', afterGood],
    ]);
    expect(store.logReview.mock.calls.map(([logged]) => logged.grade)).toEqual(['again', 'good']);
    expect(screen.getByText(/reviewed 1 card in 2 reviews/i)).toBeTruthy();
  });

  it('counts one card and one review in the singular', () => {
    renderWithCards([first]);
    revealAndGrade('good');

    expect(screen.getByText(/reviewed 1 card in 1 review\./i)).toBeTruthy();
  });

  it('queues a retried card once when its save had to be retried', () => {
    store.logReview.mockImplementationOnce(() => {
      throw new Error('storage full');
    });
    renderWithCards([first]);
    revealAndGrade('again');
    fireEvent.click(screen.getByRole('button', { name: /^again$/i }));
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    // The message only shows with an answer, so this is the first place a stale one would appear.
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^good$/i }));

    expect(screen.getByText(/reviewed 1 card in 2 reviews/i)).toBeTruthy();
  });

  it('keeps the saved schedule when the user leaves after grading again', () => {
    const saved = new Map([[first.id, first]]);
    store.listCards.mockImplementation(() => [...saved.values()]);
    store.updateCard.mockImplementation((id, changes) => {
      saved.set(id, { ...saved.get(id), ...changes });
    });
    vi.mocked(review).mockReturnValue({ ...nextState, dueAt: Infinity });

    const { unmount } = render(<QuizPage />);
    revealAndGrade('again');
    unmount();

    expect(saved.get('a').dueAt).toBe(Infinity);
    expect(store.updateCard).toHaveBeenCalledTimes(1);

    render(<QuizPage />);

    expect(screen.getByText(/nothing is due/i)).toBeTruthy();
  });

  it('typesets card text through Maths', () => {
    const { container } = renderWithCards([{ ...first, front: '$\\pi r^2$', back: '$x^2$' }]);

    expect(container.querySelectorAll('.katex')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(container.querySelectorAll('.katex')).toHaveLength(2);
  });
});
