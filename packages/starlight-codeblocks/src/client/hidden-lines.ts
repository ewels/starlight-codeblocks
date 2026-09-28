const OPEN = 'scb-hidden-open';

const ids = (el: Element) => (el.getAttribute('aria-controls') ?? '').split(' ').filter(Boolean);
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const isOpen = (marker: Element) => marker.getAttribute('aria-expanded') === 'true';

// Within the block, not by document id: full screen plugins show a copy of the block with the same ids.
function setRun(block: Element, marker: Element, open: boolean) {
  const lines = ids(marker);
  for (const id of lines) {
    const line = block.querySelector(`[id="${CSS.escape(id)}"]`);
    line?.classList.toggle(OPEN, open);
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
  const toggle = block.querySelector('.scb-hidden-toggle');
  if (!toggle) return;
  const total = markers.reduce((sum, m) => sum + ids(m).length, 0);
  toggle.textContent = markers.every(isOpen) ? `Hide ${count(total, 'line')}` : `Show ${count(total, 'hidden line')}`;
}

/** Opens the run of a closed hidden line, as a line permalink asks with a `beforematch` event. */
function reveal(line: Element) {
  if (!line.classList.contains('scb-hidden-line') || line.classList.contains(OPEN)) return;
  line
    .closest('[data-scb-hidden-lines]')
    ?.querySelector<HTMLElement>(`.scb-hidden-marker[aria-controls~="${CSS.escape(line.id)}"]`)
    ?.click();
}

let ready = false;

/** Toggles a hidden-lines marker, or every marker at once from the title bar button. */
export default function initHiddenLines() {
  if (!ready) {
    ready = true;
    document.addEventListener('click', click);
    document.addEventListener('beforematch', (event) => reveal(event.target as Element), true);
  }
  // A line permalink can target a hidden line before this script is ready.
  for (const line of document.querySelectorAll('[data-scb-hidden-lines] .scb-permalink-target.scb-hidden-line')) {
    reveal(line);
  }
}
