import { beforeEach, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  store: { name: 'the store' },
  getStore: vi.fn(),
  seedIfEmpty: vi.fn(),
  // Records how many seed calls had been made each time the app rendered.
  seedCallsAtRender: [],
}));

vi.mock('./lib/storage.js', () => ({ getStore: mocks.getStore }));
vi.mock('./lib/seed.js', () => ({ seedIfEmpty: mocks.seedIfEmpty }));
vi.mock('./App.jsx', () => ({
  default: function FakeApp() {
    mocks.seedCallsAtRender.push(mocks.seedIfEmpty.mock.calls.length);
    return <p>fake app</p>;
  },
}));

// main.jsx does its work on import, so each test imports a fresh copy.
async function startApp() {
  await act(async () => {
    await import('./main.jsx');
  });
}

function renderedText() {
  return document.getElementById('root').textContent;
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  mocks.getStore.mockReset().mockReturnValue(mocks.store);
  mocks.seedIfEmpty.mockReset();
  mocks.seedCallsAtRender.length = 0;
  document.body.innerHTML = '<div id="root"></div>';
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

it('seeds the store once, before the app first renders', async () => {
  const before = Date.now();
  await startApp();

  expect(mocks.seedIfEmpty).toHaveBeenCalledTimes(1);
  const [passedStore, passedNow] = mocks.seedIfEmpty.mock.lastCall;
  expect(passedStore).toBe(mocks.store);
  expect(passedNow).toBeGreaterThanOrEqual(before);

  expect(renderedText()).toBe('fake app');
  expect(mocks.seedCallsAtRender[0]).toBe(1);
});

it('still renders and logs the error when seeding fails, as with full or blocked storage', async () => {
  const failure = new Error('QuotaExceededError');
  mocks.seedIfEmpty.mockImplementation(() => {
    throw failure;
  });
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

  await startApp();

  expect(renderedText()).toBe('fake app');
  expect(logged.mock.calls.flat()).toContain(failure);
});

it('still renders when the store cannot be created', async () => {
  mocks.getStore.mockImplementation(() => {
    throw new Error('SecurityError');
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});

  await startApp();

  expect(renderedText()).toBe('fake app');
  expect(mocks.seedIfEmpty).not.toHaveBeenCalled();
});
