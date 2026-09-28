import { expect, test, vi } from 'vitest';
import { PYODIDE_URL, pyodide } from '../src/runtimes/pyodide.ts';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(data: { id: number }) {
    messages.push(data);
    queueMicrotask(() => this.onmessage?.({ data: { id: data.id } } as MessageEvent));
  }
  terminate() {}
}

const messages: { id: number; url?: string }[] = [];

test('threads a custom url through to the worker, instead of the default', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mock' }));
  try {
    await pyodide({ url: 'https://example.com/custom/' }).load('');
    expect(messages[0]).toMatchObject({ url: 'https://example.com/custom/' });
    messages.length = 0;
    await pyodide().load('');
    expect(messages[0]).toMatchObject({ url: PYODIDE_URL });
    messages.length = 0;
    vi.stubGlobal('location', { href: 'https://example.com/docs/page/' });
    await pyodide({ url: '/pyodide/full/' }).load('');
    expect(messages[0]).toMatchObject({ url: 'https://example.com/pyodide/full/' });
  } finally {
    vi.unstubAllGlobals();
  }
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
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mock' }));
  try {
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
  } finally {
    vi.unstubAllGlobals();
  }
});

test('a worker that does not start rejects the calls', async () => {
  class RefusedWorker {
    onerror: ((event: Partial<ErrorEvent>) => void) | null = null;
    postMessage() {
      queueMicrotask(() => this.onerror?.({}));
    }
    terminate() {}
  }
  vi.stubGlobal('Worker', RefusedWorker);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mock' }));
  try {
    await expect(pyodide().load('')).rejects.toThrow('The worker did not start.');
  } finally {
    vi.unstubAllGlobals();
  }
});

test('tells the worker whether the code is the commands of a session', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mock' }));
  try {
    messages.length = 0;
    const runtime = pyodide();
    const { signal } = new AbortController();
    await runtime.run('x', { signal, session: true });
    await runtime.run('x', { signal });
    expect(messages).toEqual([
      expect.objectContaining({ code: 'x', session: true }),
      expect.objectContaining({ code: 'x', session: false }),
    ]);
  } finally {
    vi.unstubAllGlobals();
  }
});
