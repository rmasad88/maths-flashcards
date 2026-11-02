import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import Nav from './Nav.jsx';

function currentLinks() {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);
}

describe('Nav', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('links to every page', () => {
    render(<Nav />);
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['#/', '#/cards', '#/quiz', '#/stats']);
  });

  it('marks the page in the URL as current', () => {
    window.location.hash = '#/quiz';
    render(<Nav />);
    expect(currentLinks()).toEqual(['Quiz']);
  });

  it('follows the URL as it changes', () => {
    window.location.hash = '#/quiz';
    render(<Nav />);

    act(() => {
      window.location.hash = '#/stats';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(currentLinks()).toEqual(['Stats']);
  });

  // App.jsx shows the home page for these, so the nav has to agree with it.
  it.each(['', '#/nowhere'])('marks Home as current for the hash "%s"', (hash) => {
    window.location.hash = hash;
    render(<Nav />);
    expect(currentLinks()).toEqual(['Home']);
  });
});
