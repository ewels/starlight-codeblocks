import { scrollTo, unhide } from './shared/scroll.ts';

const OPEN = 'scb-hidden-open';

const ids = (el: Element) => (el.getAttribute('aria-controls') ?? '').split(' ').filter(Boolean);
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const isOpen = (marker: Element) => marker.getAttribute('aria-expanded') === 'true';

// Within the block, not by document id: full screen plugins show a copy of the block with the same ids.
function setRun(block: Element, marker: Element, open: boolean) {
  const lines = ids(marker);
  for (const id of lines) {
    const line = block.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
    line?.classList.toggle(OPEN, open);
    // Opens a collapsed expandable block or collapsible section that holds the line.
    if (open && line) unhide(line);
    for (let el = line?.previousElementSibling; el?.classList.contains('scb-callout'); el = el.previousElementSibling) {
      el.classList.toggle(OPEN, open);
    }
  }
  marker.setAttribute('aria-expanded', String(open));
  const span = marker.querySelector('span');
  if (span) span.textContent = open ? `Hide ${count(lines.length, 'line')}` : count(lines.length, 'hidden line');
}

function click(event: MouseEvent) {
  const button = (event.target as Element).closest('.scb-hidden-marker, .scb-hidden-toggle');
  const block = button?.closest('[data-scb-hidden-lines]');
  if (!button || !block) return;
  const markers = [...block.querySelectorAll('.scb-hidden-marker')];
  if (button.classList.contains('scb-hidden-toggle')) {
    const open = !markers.every(isOpen);
    for (const marker of markers) setRun(block, marker, open);
  } else setRun(block, button, !isOpen(button));
  label(block);
}

function label(block: Element) {
  const toggle = block.querySelector('.scb-hidden-toggle');
  if (!toggle) return;
  const markers = [...block.querySelectorAll('.scb-hidden-marker')];
  const total = markers.reduce((sum, m) => sum + ids(m).length, 0);
  const open = markers.every(isOpen);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? `Hide ${count(total, 'line')}` : `Show ${count(total, 'hidden line')}`;
}

/** Opens the run of a closed hidden line, as a line permalink asks with a `beforematch` event. */
// Not marker.click(): a synthetic click would reach the other features' "click elsewhere" handlers.
function reveal(line: Element) {
  if (!line.classList.contains('scb-hidden-line') || line.classList.contains(OPEN)) return false;
  const block = line.closest('[data-scb-hidden-lines]');
  const marker = block?.querySelector(`.scb-hidden-marker[aria-controls~="${CSS.escape(line.id)}"]`);
  if (!block || !marker) return false;
  setRun(block, marker, true);
  label(block);
  return true;
}

let ready = false;

/** Toggles a hidden-lines marker, or every marker at once from the title bar button. */
export default function initHiddenLines() {
  if (!ready) {
    ready = true;
    document.addEventListener('click', click);
    document.addEventListener('beforematch', (event) => reveal(event.target as Element), true);
  }
  // A line permalink can target a hidden line before this script is ready, and could not scroll to it then.
  const opened = [...document.querySelectorAll('[data-scb-hidden-lines] .scb-permalink-target.scb-hidden-line')].filter(
    reveal,
  );
  if (opened[0]) scrollTo(opened[0], 'center');
}
