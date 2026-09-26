const TARGET = 'scb-permalink-target';
const HASH = /^#(.+?)-L(\d+)(?:-L(\d+))?$/;

let anchor: { block: Element; n: number } | undefined;
let ready = false;

// Within the block, not by document id: full screen plugins show a copy of the block with the same ids.
function lineOf(block: Element, n: number) {
  return block.querySelector<HTMLElement>(`[id="${CSS.escape(`${block.id}-L${n}`)}"]`);
}

/** Highlights lines `from` to `to` of the block, and returns them. */
function highlight(block: Element, from: number, to: number) {
  for (const el of document.querySelectorAll(`.${TARGET}`)) el.classList.remove(TARGET);
  for (const el of document.querySelectorAll('.scb-permalink[aria-current]')) el.removeAttribute('aria-current');
  const lines: HTMLElement[] = [];
  for (let n = Math.min(from, to); n <= Math.max(from, to); n++) {
    const line = lineOf(block, n);
    if (!line) continue;
    line.classList.add(TARGET);
    line.querySelector('.scb-permalink')?.setAttribute('aria-current', 'true');
    // The expandable and hidden-lines scripts open the line themselves if they start later.
    if (line.hidden) line.dispatchEvent(new Event('beforematch'));
    if (line.classList.contains('scb-hidden-line') && !line.classList.contains('scb-hidden-open')) {
      block.querySelector<HTMLElement>(`.scb-hidden-marker[aria-controls~="${CSS.escape(line.id)}"]`)?.click();
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
  const block = document.getElementById(id);
  if (!block?.hasAttribute('data-scb-permalinks')) return;
  const [first] = highlight(block, Number(a), Number(b ?? a));
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
