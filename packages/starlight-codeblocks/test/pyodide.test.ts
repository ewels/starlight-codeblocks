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
    await pyodide({ url: 'https://example.com/custom/' }).load();
    expect(messages[0]).toMatchObject({ url: 'https://example.com/custom/' });
    messages.length = 0;
    await pyodide().load();
    expect(messages[0]).toMatchObject({ url: PYODIDE_URL });
  } finally {
    vi.unstubAllGlobals();
  }
});
