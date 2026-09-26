import type { Runtime } from '../options.ts';

const runtimes = new Map<string, Promise<Runtime>>();
const loaded = new Set<string>();

function line(className: string, text: string, prefix?: string) {
  const el = document.createElement(className === 'scb-run-status' ? 'p' : 'pre');
  el.className = className;
  if (prefix) {
    const sr = document.createElement('span');
    sr.className = 'scb-sr-only';
    sr.textContent = prefix;
    el.append(sr);
  }
  el.append(text);
  return el;
}

function show(panel: HTMLElement, ...children: HTMLElement[]) {
  const label = document.createElement('span');
  label.className = 'scb-run-label';
  label.textContent = 'Output';
  panel.replaceChildren(label, ...children);
}

const status = (text: string) => line('scb-run-status', text);
const error = (text: string) => line('scb-run-stderr', text, 'Error: ');

function seconds(ms: number) {
  const s = ms / 1000;
  return `${s} second${s === 1 ? '' : 's'}`;
}

async function run(figure: HTMLElement, panel: HTMLElement) {
  const url = new URL(figure.dataset.scbRunnable as string, document.baseURI).href;
  const name = figure.dataset.scbRunnableName;
  const timeout = Number(figure.dataset.scbRunnableTimeout) || 10000;
  const code = (figure.querySelector<HTMLElement>('.copy button[data-code]')?.dataset.code ?? '').replaceAll(
    '\x7F',
    '\n',
  );
  let runtime: Runtime;
  try {
    if (!loaded.has(url)) show(panel, status(`Loading the ${name} runtime…`));
    let module = runtimes.get(url);
    if (!module) {
      module = import(/* @vite-ignore */ url).then((m) => m.default as Runtime);
      runtimes.set(url, module);
    }
    runtime = await module;
    await runtime.load();
    loaded.add(url);
  } catch (e) {
    runtimes.delete(url);
    show(panel, error(`The ${name} runtime did not load. ${e instanceof Error ? e.message : String(e)}`));
    return;
  }
  show(panel, status('Running…'));
  const controller = new AbortController();
  // Also settles when a runtime ignores the signal, so that the button always comes back.
  const stopped = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
  });
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeout);
  try {
    const { stdout, stderr } = await Promise.race([runtime.run(code, { signal: controller.signal }), stopped]);
    const parts = [];
    if (stdout) parts.push(line('scb-run-stdout', stdout));
    if (stderr) parts.push(error(stderr));
    show(panel, ...(parts.length ? parts : [status('The code ran with no output.')]));
  } catch (e) {
    if (controller.signal.aborted) {
      // The runtime may have thrown itself away to stop the code, so the next run loads it again.
      loaded.delete(url);
      show(panel, error(`The run stopped after ${seconds(timeout)}.`));
    } else {
      show(panel, error(e instanceof Error ? e.message : String(e)));
    }
  } finally {
    clearTimeout(timer);
  }
}

async function click(event: MouseEvent) {
  const button = (event.target as Element).closest<HTMLElement>('.scb-run');
  // Found through the button, so that a copy of the block, as full screen plugins show, works too.
  const figure = button?.closest<HTMLElement>('[data-scb-runnable]');
  const panel = figure?.querySelector<HTMLElement>('.scb-run-output');
  // aria-disabled, not disabled, so that the button keeps the keyboard focus.
  if (!button || !figure || !panel || button.getAttribute('aria-disabled') === 'true') return;
  button.setAttribute('aria-disabled', 'true');
  try {
    await run(figure, panel);
  } finally {
    button.removeAttribute('aria-disabled');
    button.textContent = 'Run again';
  }
}

let ready = false;

/** Runs a `runnable` block with its language's runtime, which loads on the first click. */
export default function initRunnable() {
  if (ready) return;
  ready = true;
  document.addEventListener('click', click);
}
