import type { Runtime } from '../options.ts';
import { ansiNodes } from './shared/ansi.ts';
import { copiedCode, decodeCode } from './shared/copy.ts';

const runtimes = new Map<string, Promise<Runtime>>();
const loaded = new Set<string>();

function line(tag: 'p' | 'pre', className: string, text: string, { prefix = '', ansi = false } = {}) {
  const el = document.createElement(tag);
  el.className = className;
  if (prefix) {
    const sr = document.createElement('span');
    sr.className = 'scb-sr-only';
    sr.textContent = prefix;
    el.append(sr);
  }
  el.append(ansi ? ansiNodes(text) : text);
  return el;
}

const texts = (panel: HTMLElement): Record<string, string> => JSON.parse(panel.dataset.scbTexts ?? '{}');

function show(panel: HTMLElement, ...children: HTMLElement[]) {
  const label = document.createElement('span');
  label.className = 'scb-run-label';
  label.textContent = texts(panel).output;
  panel.replaceChildren(label, ...children);
}

const status = (text: string) => line('p', 'scb-run-status', text);
const stdout = (text: string, ansi = false) => line('pre', 'scb-run-stdout', text, { ansi });
const error = (prefix: string, text: string, ansi = false) => line('pre', 'scb-run-stderr', text, { prefix, ansi });

/** Prints the output that the author wrote, a line at a time, as if the code ran. */
async function replay(figure: HTMLElement, panel: HTMLElement, output: string) {
  const delay = Number(figure.dataset.scbRunnableDelay) || 0;
  const waits: Record<number, number> = JSON.parse(figure.dataset.scbRunnableWaits ?? '{}');
  const streams: Record<number, string> = JSON.parse(figure.dataset.scbRunnableStreams ?? '{}');
  const marks = figure.querySelector('.scb-run-lines');
  const t = texts(panel);
  if (delay || figure.dataset.scbRunnableWaits) show(panel, status(t.running));
  let part: HTMLElement | undefined;
  for (const [i, text] of decodeCode(output).split('\n').entries()) {
    const ms = i ? (waits[i - 1] ?? delay) : delay;
    if (ms) await new Promise((resolve) => setTimeout(resolve, ms));
    if (!part) show(panel);
    if (!part || i in streams) {
      part = streams[i] === 'stderr' ? error(t.error, '') : stdout('');
      panel.append(part);
    } else part.append('\n');
    part.append(marks?.querySelector(`[data-scb-run-line="${i}"]`)?.cloneNode(true) ?? text);
  }
}

async function run(figure: HTMLElement, panel: HTMLElement) {
  const output = figure.dataset.scbRunnableOutput;
  if (output !== undefined) return replay(figure, panel, output);
  const url = new URL(figure.dataset.scbRunnable as string, document.baseURI).href;
  const t = texts(panel);
  const timeout = Number(figure.dataset.scbRunnableTimeout) || 10000;
  const commands = figure.dataset.scbRunnableSession;
  const own = figure.dataset.scbRunnableCode;
  const code = decodeCode(own ?? commands ?? copiedCode(figure));
  const session =
    own === undefined && (commands !== undefined || figure.querySelector('.scb-shell-copy[data-code]') !== null);
  let runtime: Runtime;
  try {
    if (!loaded.has(url)) show(panel, status(t.loading));
    let module = runtimes.get(url);
    if (!module) {
      module = import(/* @vite-ignore */ url).then((m) => m.default as Runtime);
      runtimes.set(url, module);
    }
    runtime = await module;
    await runtime.load(code, { packages: figure.dataset.scbRunnablePackages?.split(' ') ?? [] });
    loaded.add(url);
  } catch (e) {
    runtimes.delete(url);
    show(panel, error(t.error, `${t.failed} ${e instanceof Error ? e.message : String(e)}`));
    return;
  }
  show(panel, status(t.running));
  const controller = new AbortController();
  // Also settles when a runtime ignores the signal, so that the button always comes back.
  const stopped = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
  });
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeout);
  try {
    const output = await Promise.race([runtime.run(code, { signal: controller.signal, session }), stopped]);
    const parts = [];
    const ansi = figure.hasAttribute('data-scb-runnable-ansi');
    if (output.stdout) parts.push(stdout(output.stdout, ansi));
    if (output.stderr) parts.push(error(t.error, output.stderr, ansi));
    show(panel, ...(parts.length ? parts : [status(t.empty)]));
  } catch (e) {
    if (controller.signal.aborted) {
      // The runtime may have thrown itself away to stop the code, so the next run loads it again.
      loaded.delete(url);
      show(panel, error(t.error, t.timeout));
    } else {
      show(panel, error(t.error, e instanceof Error ? e.message : String(e)));
    }
  } finally {
    clearTimeout(timer);
  }
}

async function click(event: MouseEvent) {
  const button = (event.target as Element).closest<HTMLElement>('.scb-run');
  // Found through the button, so that a copy of the block, as full screen plugins show, works too.
  const figure = button?.closest<HTMLElement>('[data-scb-runnable]');
  // aria-disabled, not disabled, so that the button keeps the keyboard focus.
  if (!button || !figure || button.getAttribute('aria-disabled') === 'true') return;
  await start(figure);
}

async function start(figure: HTMLElement) {
  const panel = figure.querySelector<HTMLElement>('.scb-run-output');
  if (!panel) return;
  const buttons = figure.querySelectorAll<HTMLElement>('.scb-run');
  for (const b of buttons) b.setAttribute('aria-disabled', 'true');
  try {
    const start = figure.querySelector<HTMLElement>('.scb-run-start');
    if (start && !figure.hasAttribute('data-scb-run-started')) {
      start.classList.add('scb-run-fading');
      const fade = Number.parseFloat(getComputedStyle(start).transitionDuration) * 1000;
      await new Promise((resolve) => setTimeout(resolve, fade || 0));
      const focused = start === document.activeElement;
      figure.setAttribute('data-scb-run-started', '');
      if (focused) {
        panel.tabIndex = -1;
        panel.focus();
      }
    }
    await run(figure, panel);
  } finally {
    for (const b of buttons) {
      b.removeAttribute('aria-disabled');
      b.textContent = b.dataset.scbRunAgain ?? b.textContent;
    }
  }
}

let ready = false;

/**
 * Runs a `runnable` block with its language's runtime, which loads on the first click, or prints its scripted output.
 * `runnable.autorun` blocks run on page load, one after another, and stop when the reader leaves the page.
 */
export default function initRunnable() {
  let queue = Promise.resolve();
  for (const figure of document.querySelectorAll<HTMLElement>('[data-scb-runnable-autorun]:not([data-scb-ready])')) {
    figure.dataset.scbReady = '';
    queue = queue.then(() => (figure.isConnected ? start(figure) : undefined)).catch(() => {});
  }
  if (ready) return;
  ready = true;
  document.addEventListener('click', click);
}
