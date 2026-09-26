const TARGET = 'scb-permalink-target';
const HASH = /^#(.+?)-L(\d+)(?:-L(\d+))?$/;

let anchor: { block: Element; n: number } | undefined;
let ready = false;

function lineOf(id: string, n: number) {
  return document.getElementById(`${id}-L${n}`);
}

/** Highlights lines `from` to `to` of the block, and returns them. */
function highlight(id: string, from: number, to: number) {
  for (const el of document.querySelectorAll(`.${TARGET}`)) el.classList.remove(TARGET);
  for (const el of document.querySelectorAll('.scb-permalink[aria-current]')) el.removeAttribute('aria-current');
  const lines: HTMLElement[] = [];
  for (let n = Math.min(from, to); n <= Math.max(from, to); n++) {
    const line = lineOf(id, n);
    if (!line) continue;
    line.classList.add(TARGET);
    line.querySelector('.scb-permalink')?.setAttribute('aria-current', 'true');
    // The expandable and hidden-lines scripts open the line themselves if they start later.
    if (line.hidden) line.dispatchEvent(new Event('beforematch'));
    if (line.classList.contains('scb-hidden-line') && !line.classList.contains('scb-hidden-open')) {
      document.querySelector<HTMLElement>(`.scb-hidden-marker[aria-controls~="${line.id}"]`)?.click();
    }
    lines.push(line);
  }
  return lines;
}

function fromHash() {
  let hash: string;
  try {
    hash = decodeURIComponent(location.hash);
  } catch {
    return;
  }
  const match = hash.match(HASH);
  if (!match) return;
  const [, id = '', a = '', b] = match;
  if (!document.getElementById(id)?.hasAttribute('data-scb-permalinks')) return;
  const [first] = highlight(id, Number(a), Number(b ?? a));
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  first?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
}

function select(event: MouseEvent) {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a.scb-permalink');
  const block = link?.closest('[data-scb-permalinks]');
  if (!link || !block) return;
  event.preventDefault();
  const n = Number(link.textContent);
  if (!event.shiftKey || anchor?.block !== block) anchor = { block, n };
  const [from, to] = [Math.min(anchor.n, n), Math.max(anchor.n, n)];
  highlight(block.id, from, to);
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
