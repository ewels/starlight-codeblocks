import { writeClipboard } from './shared/copy.ts';

// Text markers can split one colour into several elements; the first holds the swatch.
const COLOUR = '.scb-swatch-text:has(> .scb-swatch)';
const timers = new WeakMap<HTMLElement, number>();
let live: HTMLElement | undefined;

async function copy(el: HTMLElement) {
  const colour = el.dataset.scbColour;
  if (!colour || !(await writeClipboard(colour))) return;
  el.dataset.scbCopied = 'Copied';
  if (!live?.isConnected) {
    live = document.createElement('span');
    live.setAttribute('aria-live', 'polite');
    live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
    document.body.append(live);
  }
  live.textContent = `Copied ${colour}`;
  clearTimeout(timers.get(el));
  timers.set(
    el,
    window.setTimeout(() => {
      delete el.dataset.scbCopied;
      if (live) live.textContent = '';
    }, 1200),
  );
}

const target = (event: Event) => (event.target as Element).closest?.<HTMLElement>('.scb-swatch-text');

function setUp() {
  for (const el of document.querySelectorAll<HTMLElement>(
    `[data-scb-swatches] ${COLOUR}, ${COLOUR}[data-scb-swatches]`,
  )) {
    if (el.dataset.scbReady) continue;
    el.dataset.scbReady = '';
    el.role = 'button';
    el.tabIndex = 0;
    el.ariaLabel = `Copy colour ${el.dataset.scbColour}`;
  }
}

let listening = false;

/** Copies a colour when the reader clicks it, or presses Enter or Space on it. Swatches and hover need no JavaScript. */
export default function initSwatches() {
  setUp();
  if (listening) return;
  listening = true;
  document.addEventListener('click', (event) => {
    const el = target(event);
    // A selection that ends on a colour is for copying more than the colour.
    if (el?.role === 'button' && !getSelection()?.toString()) copy(el);
  });
  document.addEventListener('keydown', (event) => {
    const el = target(event);
    if (el?.role !== 'button' || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    copy(el);
  });
}
