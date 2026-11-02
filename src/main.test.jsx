import { expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { seedIfEmpty } from './lib/seed.js';
import { getStore } from './lib/storage.js';

const store = { name: 'the store' };

vi.mock('./lib/storage.js', () => ({ getStore: vi.fn(() => store) }));
vi.mock('./lib/seed.js', () => ({ seedIfEmpty: vi.fn() }));

// Records what had been seeded by the time the app first rendered.
const seedCallsAtRender = vi.hoisted(() => []);
vi.mock('./App.jsx', () => ({
  default: function FakeApp() {
    seedCallsAtRender.push(vi.mocked(seedIfEmpty).mock.calls.length);
    return <p>fake app</p>;
  },
}));

it('seeds the store once, before the app first renders', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = Date.now();

  await act(async () => {
    await import('./main.jsx');
  });

  expect(getStore).toHaveBeenCalled();
  expect(seedIfEmpty).toHaveBeenCalledTimes(1);
  const [passedStore, passedNow] = seedIfEmpty.mock.lastCall;
  expect(passedStore).toBe(store);
  expect(passedNow).toBeGreaterThanOrEqual(before);

  expect(document.getElementById('root').textContent).toBe('fake app');
  expect(seedCallsAtRender[0]).toBe(1);
});
