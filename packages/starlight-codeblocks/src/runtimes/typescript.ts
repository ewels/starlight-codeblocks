import { transform } from 'sucrase';
import type { Runtime } from '../options.ts';
import { runJavaScript } from './javascript.ts';

/** Removes the types with Sucrase, which checks none of them, and runs the JavaScript that is left. */
const runtime: Runtime = {
  async load() {},
  async run(code, options) {
    let js: string;
    try {
      js = transform(code, { transforms: ['typescript'], disableESTransforms: true }).code;
    } catch (error) {
      return { stdout: '', stderr: String(error) };
    }
    return runJavaScript(js, options);
  },
};

export default runtime;
