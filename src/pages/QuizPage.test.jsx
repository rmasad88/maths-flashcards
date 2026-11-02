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
    expect(screen.getByText(/card 1 of 2/i)).toBeTruthy();
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
  });

  it('moves to the next card with its answer hidden after grading', () => {
    renderWithCards([first, second]);
    revealAndGrade('good');

    expect(screen.getByText('Front two')).toBeTruthy();
    expect(screen.queryByText('Back two')).toBeNull();
    expect(screen.queryByText('Front one')).toBeNull();
    expect(screen.getByText(/card 2 of 2/i)).toBeTruthy();
  });

  it('says the session is over after the last card', () => {
    renderWithCards([first, second]);
    revealAndGrade('good');
    revealAndGrade('easy');

    expect(screen.getByText(/session complete/i)).toBeTruthy();
    expect(screen.getByText(/reviewed 2 cards/i)).toBeTruthy();
    expect(screen.queryByText(/nothing is due/i)).toBeNull();
    expect(store.logReview).toHaveBeenCalledTimes(2);
  });

  it('typesets card text through Maths', () => {
    const { container } = renderWithCards([{ ...first, front: 'Area: $\\pi r^2$' }]);

    expect(container.querySelector('.katex')).not.toBeNull();
  });
});
