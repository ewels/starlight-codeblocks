import { scrollTo, unhide } from './shared/scroll.ts';

const TARGET = 'scb-permalink-target';
const HASH = /^#(.+?)-L(\d+)(?:-L(\d+))?$/;

let anchor: { block: Element; n: number } | undefined;
let ready = false;

// Within the block, not by document id: full screen plugins show a copy of the block with the same ids.
function linesOf(block: Element) {
  const prefix = `${block.id}-L`;
  return [...block.querySelectorAll<HTMLElement>(`[id^="${CSS.escape(prefix)}"]`)].map(
    (line) => [Number(line.id.slice(prefix.length)), line] as const,
  );
}

function clear() {
  for (const el of document.querySelectorAll(`.${TARGET}`)) el.classList.remove(TARGET);
  for (const el of document.querySelectorAll('.scb-permalink[aria-current]')) el.removeAttribute('aria-current');
}

/** Highlights lines `from` to `to` of the block, and returns them. */
function highlight(block: Element, from: number, to: number) {
  clear();
  const lines: HTMLElement[] = [];
  // Over the block's lines, not the range: the numbers come from the address, with no upper limit.
  for (const [n, line] of linesOf(block)) {
    if (!(n >= Math.min(from, to) && n <= Math.max(from, to))) continue;
    line.classList.add(TARGET);
    line.querySelector('.scb-permalink')?.setAttribute('aria-current', 'true');
    // The expandable and hidden-lines scripts open the line themselves if they start later.
    unhide(line);
    lines.push(line);
  }
  return lines;
}

function fromHash() {
  clear();
  let hash: string;
  try {
    hash = decodeURIComponent(location.hash);
  } catch {
    return;
  }
  const match = hash.match(HASH);
  if (!match) return;
  const [, id = '', a = '', b] = match;
  // Not getElementById: a heading with the same slug comes first.
  const block = document.querySelector(`[data-scb-permalinks][id="${CSS.escape(id)}"]`);
  if (!block) return;
  const [first] = highlight(block, Number(a), Number(b ?? a));
  if (first) scrollTo(first, 'center');
}

function select(event: MouseEvent) {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a.scb-permalink');
  const block = link?.closest('[data-scb-permalinks]');
  if (!link || !block || event.metaKey || event.ctrlKey || event.altKey) return;
  event.preventDefault();
  const n = Number(link.textContent);
  if (!event.shiftKey || anchor?.block !== block) anchor = { block, n };
  const [from, to] = [Math.min(anchor.n, n), Math.max(anchor.n, n)];
  highlight(block, from, to);
  history.replaceState(history.state, '', `#${block.id}-L${from}${to > from ? `-L${to}` : ''}`);
}

/** Highlights the lines in the address, and turns line numbers into links that select lines. */
export default function initPermalinks() {
  if (!ready) {
    ready = true;
    document.addEventListener('click', select);
    addEventListener('hashchange', fromHash);
  }
  fromHash();
}
