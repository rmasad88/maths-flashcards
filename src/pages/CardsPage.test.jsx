import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import CardsPage from './CardsPage.jsx';
import { getStore } from '../lib/storage.js';

// srs.js belongs to another issue, so its schedule is faked here.
vi.mock('../lib/srs.js', () => ({
  newSrsState: (now) => ({ ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: now }),
}));

function type(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillForm({ front = 'Front text', back = 'Back text', topic = 'Algebra' } = {}) {
  type('Front', front);
  type('Back', back);
  type('Topic', topic);
}

const addButton = () => screen.getByRole('button', { name: 'Add card' });
const cardItems = () => screen.queryAllByRole('listitem');

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CardsPage', () => {
  it('says so when there are no cards', () => {
    render(<CardsPage />);
    expect(screen.getByText(/no cards yet/i)).toBeTruthy();
  });

  it('adds a card, lists it and clears the form', () => {
    render(<CardsPage />);
    fillForm({ front: 'New front', back: 'New back', topic: 'Calculus' });
    fireEvent.click(addButton());

    expect(cardItems()).toHaveLength(1);
    expect(cardItems()[0].textContent).toContain('New front');
    expect(cardItems()[0].textContent).toContain('New back');
    expect(cardItems()[0].textContent).toContain('Calculus');
    expect(screen.getByLabelText('Front').value).toBe('');
    expect(getStore().listCards()).toHaveLength(1);
  });

  it('trims what it saves', () => {
    render(<CardsPage />);
    fillForm({ front: ' f ', back: ' b ', topic: ' t ' });
    fireEvent.click(addButton());
    expect(getStore().listCards()[0]).toMatchObject({ front: 'f', back: 'b', topic: 't' });
  });

  it.each(['Front', 'Back', 'Topic'])('will not save with a blank %s', (label) => {
    const { container } = render(<CardsPage />);
    fillForm();
    type(label, '   ');
    expect(addButton().disabled).toBe(true);
    fireEvent.submit(container.querySelector('form'));
    expect(getStore().listCards()).toEqual([]);
  });

  it('previews the front and back with KaTeX while typing', () => {
    render(<CardsPage />);
    const frontPreview = screen.getByRole('region', { name: 'Front preview' });
    const backPreview = screen.getByRole('region', { name: 'Back preview' });
    expect(frontPreview.querySelector('.katex')).toBeNull();
    expect(backPreview.querySelector('.katex')).toBeNull();

    type('Front', 'Area: $\\pi r^2$');
    expect(frontPreview.querySelector('.katex')).not.toBeNull();
    expect(backPreview.querySelector('.katex')).toBeNull();

    type('Back', '$$x^2$$');
    expect(backPreview.querySelector('.katex-display')).not.toBeNull();
  });

  it('keeps previewing through half-typed or invalid LaTeX', () => {
    render(<CardsPage />);
    const frontPreview = screen.getByRole('region', { name: 'Front preview' });
    type('Front', '$\\frac{');
    expect(frontPreview.textContent).toContain('$\\frac{');
    type('Front', '$\\frac{$');
    expect(frontPreview.querySelector('.katex-error')).not.toBeNull();
  });

  it('shows saved cards with KaTeX', () => {
    getStore().addCard({ front: '$a^2$', back: '$b^2$', topic: 'T' }, 1);
    render(<CardsPage />);
    expect(cardItems()[0].querySelectorAll('.katex')).toHaveLength(2);
  });

  it('does not inject HTML from card text', () => {
    getStore().addCard({ front: '<img src=x>', back: 'b', topic: '<img src=y>' }, 1);
    const { container } = render(<CardsPage />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('lists the newest card first', () => {
    getStore().addCard({ front: 'older', back: 'b', topic: 't' }, 1);
    getStore().addCard({ front: 'newer', back: 'b', topic: 't' }, 2);
    render(<CardsPage />);
    expect(cardItems()[0].textContent).toContain('newer');
    expect(cardItems()[1].textContent).toContain('older');
  });

  it('edits a card, keeping its id and schedule', () => {
    const card = getStore().addCard({ front: 'old', back: 'old back', topic: 'Old' }, 1);
    getStore().updateCard(card.id, { ease: 1.7, repetitions: 3, intervalDays: 9, dueAt: 500 });
    render(<CardsPage />);

    fireEvent.click(within(cardItems()[0]).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Front').value).toBe('old');
    expect(screen.getByLabelText('Back').value).toBe('old back');
    expect(screen.getByLabelText('Topic').value).toBe('Old');

    type('Front', 'new');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(cardItems()[0].textContent).toContain('new');
    expect(getStore().listCards()).toEqual([
      {
        ...card,
        front: 'new',
        ease: 1.7,
        repetitions: 3,
        intervalDays: 9,
        dueAt: 500,
      },
    ]);
    expect(screen.getByLabelText('Front').value).toBe('');
    expect(addButton()).toBeTruthy();
  });

  it('cancelling an edit changes nothing and clears the form', () => {
    const card = getStore().addCard({ front: 'old', back: 'b', topic: 't' }, 1);
    render(<CardsPage />);
    fireEvent.click(within(cardItems()[0]).getByRole('button', { name: 'Edit' }));
    type('Front', 'abandoned');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(getStore().getCard(card.id)).toEqual(card);
    expect(screen.getByLabelText('Front').value).toBe('');
    expect(addButton()).toBeTruthy();
  });

  it('deletes a card after confirming', () => {
    getStore().addCard({ front: 'gone', back: 'b', topic: 't' }, 1);
    render(<CardsPage />);
    fireEvent.click(within(cardItems()[0]).getByRole('button', { name: 'Delete' }));
    expect(cardItems()).toHaveLength(0);
    expect(getStore().listCards()).toEqual([]);
  });

  it('keeps the card when the delete is not confirmed', () => {
    window.confirm.mockReturnValue(false);
    getStore().addCard({ front: 'kept', back: 'b', topic: 't' }, 1);
    render(<CardsPage />);
    fireEvent.click(within(cardItems()[0]).getByRole('button', { name: 'Delete' }));
    expect(cardItems()).toHaveLength(1);
    expect(getStore().listCards()).toHaveLength(1);
  });

  it('leaves edit mode when the card being edited is deleted', () => {
    getStore().addCard({ front: 'gone', back: 'b', topic: 't' }, 1);
    render(<CardsPage />);
    fireEvent.click(within(cardItems()[0]).getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(cardItems()[0]).getByRole('button', { name: 'Delete' }));

    expect(screen.getByLabelText('Front').value).toBe('');
    expect(addButton()).toBeTruthy();
    expect(getStore().listCards()).toEqual([]);
  });

  it('keeps a half-typed new card when a different card is deleted', () => {
    getStore().addCard({ front: 'gone', back: 'b', topic: 't' }, 1);
    render(<CardsPage />);
    type('Front', 'half typed');
    fireEvent.click(within(cardItems()[0]).getByRole('button', { name: 'Delete' }));
    expect(screen.getByLabelText('Front').value).toBe('half typed');
  });

  it('shows saved cards again after leaving and coming back', () => {
    const { unmount } = render(<CardsPage />);
    fillForm({ front: 'Lasting' });
    fireEvent.click(addButton());
    unmount();

    render(<CardsPage />);
    expect(cardItems()[0].textContent).toContain('Lasting');
  });

  it('shows an error and keeps the form when saving fails', () => {
    render(<CardsPage />);
    fillForm({ front: 'Unsaved' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    fireEvent.click(addButton());

    expect(screen.getByRole('alert').textContent).toMatch(/could not save/i);
    expect(screen.getByLabelText('Front').value).toBe('Unsaved');
    expect(cardItems()).toHaveLength(0);
  });

  it('clears the error after the next successful save', () => {
    render(<CardsPage />);
    fillForm();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    fireEvent.click(addButton());
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(addButton());
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(cardItems()).toHaveLength(1);
  });

  it('shows an error and keeps the card when deleting fails', () => {
    getStore().addCard({ front: 'stuck', back: 'b', topic: 't' }, 1);
    render(<CardsPage />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    fireEvent.click(within(cardItems()[0]).getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('alert').textContent).toMatch(/could not save/i);
    expect(cardItems()).toHaveLength(1);
  });

  it('handles corrupt stored data as an empty list', () => {
    localStorage.setItem('maths-flashcards:cards', '{not json');
    render(<CardsPage />);
    expect(screen.getByText(/no cards yet/i)).toBeTruthy();
  });
});
