import type { Runtime } from '../options.ts';

// The worker has no access to the page. console.log, info, warn and error go to the output panel.
const source = `
const stdout = [];
const stderr = [];
const format = (a) => {
  if (typeof a === 'string') return a;
  if (typeof a === 'bigint') return a + 'n';
  if (a instanceof Error) return String(a);
  if (a instanceof Map || a instanceof Set) return a.constructor.name + ' ' + format([...a]);
  try {
    return JSON.stringify(a) ?? String(a);
  } catch {
    return String(a);
  }
};
const text = (args) => args.map(format).join(' ');
console.log = console.info = (...args) => stdout.push(text(args));
console.error = console.warn = (...args) => stderr.push(text(args));
const done = () => postMessage({ stdout: stdout.join('\\n'), stderr: stderr.join('\\n') });
// Errors in timers and other callbacks escape the try/catch.
onerror = (message) => {
  stderr.push(String(message));
  done();
  return true;
};
onunhandledrejection = ({ reason }) => {
  stderr.push(String(reason));
  done();
};
onmessage = async ({ data: code }) => {
  try {
    const AsyncFunction = (async () => {}).constructor;
    await new AsyncFunction(code)();
  } catch (error) {
    stderr.push(String(error));
  }
  done();
};`;

let url: string | undefined;

/** Runs JavaScript in a new web worker, which ends when the top-level code is done or the signal aborts. */
export function runJavaScript(code: string, { signal }: { signal: AbortSignal }) {
  url ??= URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url);
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    signal.addEventListener('abort', () => {
      worker.terminate();
      reject(signal.reason);
    });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      resolve(data);
    };
    worker.postMessage(code);
  });
}

const runtime: Runtime = {
  async load() {},
  run: runJavaScript,
};

export default runtime;
