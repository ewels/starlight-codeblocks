import type { Runtime } from 'starlight-codeblocks';

// The worker has no access to the page. console.log and console.error go to the output panel.
const source = `
onmessage = async ({ data: code }) => {
  const stdout = [];
  const stderr = [];
  const text = (args) => args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log = (...args) => stdout.push(text(args));
  console.error = (...args) => stderr.push(text(args));
  try {
    const AsyncFunction = (async () => {}).constructor;
    await new AsyncFunction(code)();
  } catch (error) {
    stderr.push(String(error));
  }
  postMessage({ stdout: stdout.join('\\n'), stderr: stderr.join('\\n') });
};`;

const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));

const runtime: Runtime = {
  async load() {},
  run(code, { signal }) {
    const worker = new Worker(url);
    return new Promise((resolve, reject) => {
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
  },
};

export default runtime;
