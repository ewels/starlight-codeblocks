import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PYODIDE_URL, pyodide } from '../src/runtimes/pyodide.ts';

beforeEach(() => vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mock' })));
afterEach(() => vi.unstubAllGlobals());

test('threads the url and the session flag through to the worker', async () => {
  const messages: { id: number; url?: string }[] = [];
  vi.stubGlobal(
    'Worker',
    class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage(data: { id: number }) {
        messages.push(data);
        queueMicrotask(() => this.onmessage?.({ data: { id: data.id } } as MessageEvent));
      }
      terminate() {}
    },
  );
  await pyodide({ url: 'https://example.com/custom/' }).load('');
  await pyodide().load('');
  vi.stubGlobal('location', { href: 'https://example.com/docs/page/' });
  await pyodide({ url: '/pyodide/full/' }).load('');
  expect(messages.map((m) => m.url)).toEqual([
    'https://example.com/custom/',
    PYODIDE_URL,
    'https://example.com/pyodide/full/',
  ]);
  messages.length = 0;
  const runtime = pyodide();
  const { signal } = new AbortController();
  await runtime.run('x', { signal, session: true });
  await runtime.run('x', { signal });
  expect(messages).toEqual([
    expect.objectContaining({ code: 'x', session: true }),
    expect.objectContaining({ code: 'x', session: false }),
  ]);
});

test('a timeout ends the worker, and the calls of other blocks go to a new worker', async () => {
  const workers: HangingWorker[] = [];
  class HangingWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    posted: { id: number; code?: string; prepare?: string }[] = [];
    terminated = false;
    constructor() {
      workers.push(this);
    }
    postMessage(data: { id: number; code?: string }) {
      this.posted.push(data);
      if (data.code !== 'loop') queueMicrotask(() => this.onmessage?.({ data: { id: data.id } } as MessageEvent));
    }
    terminate() {
      this.terminated = true;
    }
  }
  vi.stubGlobal('Worker', HangingWorker);
  const runtime = pyodide();
  const controller = new AbortController();
  const looping = runtime.run('loop', { signal: controller.signal });
  // Queued behind the loop in the same worker, so it gets no answer until the loop ends.
  workers[0].postMessage = (data) => workers[0].posted.push(data);
  const other = runtime.load('import os');
  const queued = runtime.run('import numpy', { signal: new AbortController().signal });
  controller.abort(new Error('Timed out'));
  await expect(looping).rejects.toThrow('Timed out');
  await expect(other).resolves.toBeUndefined();
  await expect(queued).resolves.toEqual({ stdout: '', stderr: '' });
  expect(workers[0].terminated).toBe(true);
  expect(workers[1].posted).toEqual([
    expect.objectContaining({ prepare: 'import os' }),
    expect.objectContaining({ prepare: 'import numpy' }),
    expect.objectContaining({ code: 'import numpy' }),
  ]);
});

test('a worker that does not start rejects the calls', async () => {
  vi.stubGlobal(
    'Worker',
    class {
      onerror: ((event: Partial<ErrorEvent>) => void) | null = null;
      postMessage() {
        queueMicrotask(() => this.onerror?.({}));
      }
      terminate() {}
    },
  );
  await expect(pyodide().load('')).rejects.toThrow('The worker did not start.');
});
