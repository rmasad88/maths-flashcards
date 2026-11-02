import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getStore } from '../lib/storage.js';
import StatsPage from './StatsPage.jsx';

vi.mock('../lib/storage.js', () => ({ getStore: vi.fn() }));

const fakeStore = (cards, reviews) => {
  getStore.mockReturnValue({ listCards: () => cards, listReviews: () => reviews });
};

// The value shown beside a stat's label.
const stat = (label) => screen.getByText(label).nextElementSibling.textContent;

const card = (id, topic, dueAt) => ({ id, topic, dueAt });

describe('StatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state, and no figures, with no cards and no reviews', () => {
    fakeStore([], []);
    const { container } = render(<StatsPage />);
    expect(screen.getByRole('heading', { name: 'Stats' })).toBeTruthy();
    expect(screen.getByText(/no cards yet/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /cards/i }).getAttribute('href')).toBe('#/cards');
    expect(screen.queryByText('Accuracy')).toBeNull();
    expect(container.querySelector('.stats-bar')).toBeNull();
  });

  it('prompts for a first quiz when there are cards but no reviews', () => {
    fakeStore([card('a', 'Algebra', 0)], []);
    const { container } = render(<StatsPage />);
    expect(screen.getByText(/no reviews yet/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /quiz/i }).getAttribute('href')).toBe('#/quiz');
    expect(stat('Total cards')).toBe('1');
    expect(stat('Due now')).toBe('1');
    expect(stat('Accuracy')).toBe('–');
    expect(stat('Streak')).toBe('0 days');
    expect(container.querySelector('.stats-bar-fill').style.width).toBe('0%');
  });

  it('shows every figure from the store', () => {
    const now = Date.now();
    const future = now + 86400000;
    fakeStore(
      [card('a', 'Algebra', 0), card('b', 'Algebra', future), card('c', 'Calculus', future)],
      [
        { cardId: 'a', grade: 'good', at: now },
        { cardId: 'a', grade: 'again', at: now },
        { cardId: 'b', grade: 'easy', at: now },
        { cardId: 'c', grade: 'hard', at: now },
      ],
    );
    render(<StatsPage />);
    expect(stat('Total cards')).toBe('3');
    expect(stat('Due now')).toBe('1');
    expect(stat('Reviews today')).toBe('4');
    expect(stat('Accuracy')).toBe('75%');
    expect(stat('Streak')).toBe('1 day');
    expect(screen.queryByText(/no reviews yet/i)).toBeNull();
  });

  it('still shows the figures with no cards left but some reviews', () => {
    fakeStore([], [{ cardId: 'deleted', grade: 'good', at: Date.now() }]);
    const { container } = render(<StatsPage />);
    expect(screen.queryByText(/no cards yet/i)).toBeNull();
    expect(screen.queryByText(/no reviews yet/i)).toBeNull();
    expect(stat('Total cards')).toBe('0');
    expect(stat('Reviews today')).toBe('1');
    expect(stat('Accuracy')).toBe('100%');
    expect(stat('Streak')).toBe('1 day');
    expect(screen.queryByRole('heading', { name: 'Accuracy by topic' })).toBeNull();
    expect(container.querySelector('.stats-bar')).toBeNull();
  });

  it('labels a card with an empty topic "No topic"', () => {
    fakeStore([card('a', '', 0)], []);
    const { container } = render(<StatsPage />);
    expect(container.querySelector('.stats-topic').textContent).toContain('No topic');
  });

  it('draws accuracy per topic as a CSS bar', () => {
    const now = Date.now();
    fakeStore(
      [card('a', 'Algebra', now), card('b', 'Calculus', now), card('c', 'Primes', now)],
      [
        { cardId: 'a', grade: 'good', at: now },
        { cardId: 'a', grade: 'again', at: now },
        { cardId: 'b', grade: 'good', at: now },
      ],
    );
    const { container } = render(<StatsPage />);
    const rows = [...container.querySelectorAll('.stats-topic')];
    expect(rows.map((row) => row.querySelector('.stats-bar-fill').style.width)).toEqual(['50%', '100%', '0%']);
    expect(rows[0].textContent).toContain('Algebra');
    expect(rows[0].textContent).toContain('50%');
    expect(rows[2].textContent).toContain('Primes');
    expect(rows[2].textContent).toContain('No reviews');
  });
});
