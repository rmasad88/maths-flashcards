import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getStore } from '../lib/storage.js';
import { dueCards } from '../lib/srs.js';
import HomePage from './HomePage.jsx';

vi.mock('../lib/storage.js', () => ({ getStore: vi.fn() }));
vi.mock('../lib/srs.js', () => ({ dueCards: vi.fn() }));

const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('HomePage', () => {
  beforeEach(() => {
    getStore.mockReturnValue({ listCards: () => cards });
  });

  it('counts the due cards from the store, as of now', () => {
    dueCards.mockReturnValue([cards[0], cards[1]]);
    const before = Date.now();
    render(<HomePage />);

    const [passedCards, passedNow] = dueCards.mock.lastCall;
    expect(passedCards).toBe(cards);
    expect(passedNow).toBeGreaterThanOrEqual(before);
    expect(screen.getByText('2 cards due')).toBeTruthy();
  });

  it('uses the singular for one card', () => {
    dueCards.mockReturnValue([cards[0]]);
    render(<HomePage />);
    expect(screen.getByText('1 card due')).toBeTruthy();
  });

  it('links to the quiz', () => {
    dueCards.mockReturnValue([cards[0]]);
    render(<HomePage />);
    expect(screen.getByRole('link', { name: 'Start quiz' }).getAttribute('href')).toBe('#/quiz');
  });

  it('still shows the count and the link with nothing due', () => {
    dueCards.mockReturnValue([]);
    render(<HomePage />);
    expect(screen.getByText('0 cards due')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start quiz' })).toBeTruthy();
  });
});
