import type { Runtime } from '../options.ts';

export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// Runs each top-level statement as the Python REPL does, so that expression values are shown.
const sessionSource = `
import ast, traceback
def _scb_session(src, g):
    try:
        for node in ast.parse(src, '<stdin>').body:
            exec(compile(ast.Interactive([node]), '<stdin>', 'single'), g)
    except BaseException as e:
        tb = None if isinstance(e, SyntaxError) else e.__traceback__.tb_next
        traceback.print_exception(e.with_traceback(tb))
_scb_session
`;

// Top-level imports that are neither in the standard library nor installed.
const missingSource = `
import importlib.util, sys
from pyodide.code import find_imports
def _scb_missing(src):
    try:
        names = find_imports(src)
    except SyntaxError:
        return []
    return [n for n in names if n not in sys.stdlib_module_names and importlib.util.find_spec(n) is None]
_scb_missing
`;

// Runs in the worker. Runs wait in a queue, because stdout and stderr belong to the whole interpreter.
// Each run gets fresh globals, so that one block's names do not leak into the next.
const workerSource = `
let ready;
let interactive;
let missing;
let queue = Promise.resolve();
onmessage = ({ data }) => {
  queue = queue.then(() => handle(data));
};
const install = async (py, names) => {
  await py.loadPackage('micropip');
  await py.pyimport('micropip').install(names);
};
const handle = async ({ id, url, code, session, prepare, packages = [] }) => {
  try {
    ready ??= import(url + 'pyodide.mjs')
      .then((m) => m.loadPyodide({ indexURL: url }))
      .then((py) => {
        interactive = py.runPython(${JSON.stringify(sessionSource)});
        missing = py.runPython(${JSON.stringify(missingSource)});
        return py;
      });
    const py = await ready;
    if (prepare !== undefined) {
      // A package that does not install shows up as an import error when the code runs.
      await py.loadPackagesFromImports(prepare).catch(() => {});
      if (packages.length > 0) {
        try {
          await install(py, packages);
        } catch (e) {
          return postMessage({ id, error: 'The packages did not install. ' + String(e?.message ?? e).trim().split('\\n').at(-1) });
        }
      }
      // Pure Python packages that Pyodide does not have come from PyPI, under their import name.
      const names = missing(prepare).toJs();
      if (names.length > 0) await install(py, names).catch(() => {});
      return postMessage({ id });
    }
    const decoder = new TextDecoder();
    let stdout = '';
    let stderr = '';
    py.setStdout({ write: (b) => ((stdout += decoder.decode(b, { stream: true })), b.length) });
    py.setStderr({ write: (b) => ((stderr += decoder.decode(b, { stream: true })), b.length) });
    const globals = py.globals.get('dict')();
    globals.set('__name__', '__main__');
    let failure;
    try {
      if (session) interactive(code, globals);
      else await py.runPythonAsync(code, { globals });
    } catch (e) {
      failure = e;
    } finally {
      // Text after the last newline stays in Python's buffers until they flush.
      py.runPython('import sys; sys.stdout.flush(); sys.stderr.flush()');
      globals.destroy();
    }
    // Drop Pyodide's own frames, so that the traceback starts at the reader's code.
    if (failure) stderr += String(failure.message).replace(/^(Traceback[^\\n]*\\n)[\\s\\S]*?(?=  File "<exec>")/, '$1');
    postMessage({ id, stdout: stdout.replace(/\\n$/, ''), stderr: stderr.trimEnd() });
  } catch (e) {
    ready = undefined;
    postMessage({ id, error: String(e?.message ?? e) });
  }
};`;

type Message = { code: string; session: boolean; packages: string[] } | { prepare: string; packages: string[] };

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
  // The packages of each block, so that a new worker after a stop can install them again.
  const wanted = new Map<string, string[]>();
  const pending = new Map<
    number,
    { message: Message; resolve: (reply: Reply) => void; reject: (reason: unknown) => void }
  >();

  function start() {
    const source = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    const w = new Worker(source, { type: 'module' });
    w.onmessage = ({ data }: MessageEvent<Reply>) => {
      const call = pending.get(data.id);
      pending.delete(data.id);
      if (data.error === undefined) call?.resolve(data);
      else call?.reject(new Error(data.error));
    };
    // A worker that the browser refuses, for example through a CSP, reports only this event, with no message.
    w.onerror = (event) => {
      end();
      for (const call of pending.values()) call.reject(new Error(event.message || 'The worker did not start.'));
      pending.clear();
    };
    return w;
  }

  function end() {
    worker?.terminate();
    worker = undefined;
  }

  function send(id: number, message: Message) {
    worker ??= start();
    // A blob: worker cannot resolve a relative URL, so it gets one resolved against the page.
    worker.postMessage({ id, url: new URL(url, globalThis.location?.href).href, ...message });
  }

  // Python code cannot be interrupted without cross-origin isolation, so stopping ends the worker.
  // The calls of other blocks that wait in its queue go to a new worker.
  function stop(id: number, reason: unknown) {
    const call = pending.get(id);
    if (!call) return;
    pending.delete(id);
    end();
    call.reject(reason);
    for (const [other, { message }] of pending) {
      // The new worker has none of the packages that the old one loaded for this run.
      if ('code' in message) send(next++, { prepare: message.code, packages: message.packages });
      send(other, message);
    }
  }

  function call(message: Message, signal?: AbortSignal) {
    return new Promise<Reply>((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const id = next++;
      signal?.addEventListener('abort', () => stop(id, signal.reason), { once: true });
      pending.set(id, { message, resolve, reject });
      send(id, message);
    });
  }

  return {
    load: async (code, { packages = [] } = {}) => {
      wanted.set(code, packages);
      await call({ prepare: code, packages });
    },
    run: async (code, { signal, session = false }) => {
      const { stdout = '', stderr = '' } = await call({ code, session, packages: wanted.get(code) ?? [] }, signal);
      return { stdout, stderr };
    },
  };
}

export default pyodide();
