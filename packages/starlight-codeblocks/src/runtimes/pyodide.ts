import type { Runtime } from '../options.ts';

export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// Runs in the worker. Runs wait in a queue, because stdout and stderr belong to the whole interpreter.
// Each run gets fresh globals, so that one block's names do not leak into the next.
const workerSource = `
let ready;
let queue = Promise.resolve();
onmessage = ({ data }) => {
  queue = queue.then(() => handle(data));
};
const handle = async ({ id, url, code }) => {
  try {
    ready ??= import(url + 'pyodide.mjs').then((m) => m.loadPyodide({ indexURL: url }));
    const py = await ready;
    if (code === undefined) return postMessage({ id });
    const stdout = [];
    const stderr = [];
    py.setStdout({ batched: (s) => stdout.push(s) });
    py.setStderr({ batched: (s) => stderr.push(s) });
    const globals = py.globals.get('dict')();
    try {
      await py.loadPackagesFromImports(code);
      await py.runPythonAsync(code, { globals });
    } catch (e) {
      // Drop Pyodide's own frames, so that the traceback starts at the reader's code.
      stderr.push(String(e.message).replace(/^(Traceback[^\\n]*\\n)[\\s\\S]*?(?=  File "<exec>")/, '$1').trimEnd());
    } finally {
      globals.destroy();
    }
    postMessage({ id, stdout: stdout.join('\\n'), stderr: stderr.join('\\n') });
  } catch (e) {
    ready = undefined;
    postMessage({ id, error: String(e?.message ?? e) });
  }
};`;

interface Reply {
  id: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/** A Python runtime that runs Pyodide in a web worker. `url` is the Pyodide folder, with a trailing slash. */
export function pyodide({ url = PYODIDE_URL }: { url?: string } = {}): Runtime {
  let worker: Worker | undefined;
  let next = 0;
  const pending = new Map<number, { resolve: (reply: Reply) => void; reject: (reason: unknown) => void }>();

  function start() {
    const source = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    const w = new Worker(source, { type: 'module' });
    w.onmessage = ({ data }: MessageEvent<Reply>) => {
      const call = pending.get(data.id);
      pending.delete(data.id);
      if (data.error === undefined) call?.resolve(data);
      else call?.reject(new Error(data.error));
    };
    return w;
  }

  // Python code cannot be interrupted without cross-origin isolation, so stopping ends the worker.
  function stop(reason: unknown) {
    worker?.terminate();
    worker = undefined;
    for (const call of pending.values()) call.reject(reason);
    pending.clear();
  }

  function call(message: { code?: string }, signal?: AbortSignal) {
    return new Promise<Reply>((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      signal?.addEventListener('abort', () => stop(signal.reason), { once: true });
      worker ??= start();
      const id = next++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, url, ...message });
    });
  }

  return {
    load: async () => {
      await call({});
    },
    run: async (code, { signal }) => {
      const { stdout = '', stderr = '' } = await call({ code }, signal);
      return { stdout, stderr };
    },
  };
}

export default pyodide();
