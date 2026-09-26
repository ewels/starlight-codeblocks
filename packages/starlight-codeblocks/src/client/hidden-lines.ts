const OPEN = 'scb-hidden-open';

function ids(el: HTMLElement) {
  return (el.getAttribute('aria-controls') ?? '').split(' ').filter(Boolean);
}

// Within the block, not by document id: full screen plugins show a copy of the block with the same ids.
function setRun(block: Element, marker: HTMLElement, open: boolean) {
  for (const id of ids(marker)) {
    const line = block.querySelector(`[id="${CSS.escape(id)}"]`);
    line?.classList.toggle(OPEN, open);
    for (let el = line?.previousElementSibling; el?.classList.contains('scb-callout'); el = el.previousElementSibling) {
      el.classList.toggle(OPEN, open);
    }
  }
  marker.setAttribute('aria-expanded', String(open));
  const n = ids(marker).length;
  const span = marker.querySelector('span');
  if (span) span.textContent = open ? `Hide ${n} line${n === 1 ? '' : 's'}` : `${n} hidden line${n === 1 ? '' : 's'}`;
}

function syncToggle(block: Element, markers: HTMLElement[]) {
  const toggle = block.querySelector<HTMLElement>('.scb-hidden-toggle');
  if (!toggle) return;
  const total = markers.reduce((sum, m) => sum + ids(m).length, 0);
  const allOpen = markers.every((m) => m.getAttribute('aria-expanded') === 'true');
  toggle.textContent = allOpen ? `Hide ${total} lines` : `Show ${total} hidden line${total === 1 ? '' : 's'}`;
}

function click(event: MouseEvent) {
  const button = (event.target as Element).closest<HTMLElement>('.scb-hidden-marker, .scb-hidden-toggle');
  const block = button?.closest('[data-scb-hidden-lines]');
  if (!button || !block) return;
  const markers = [...block.querySelectorAll<HTMLElement>('.scb-hidden-marker')];
  if (button.classList.contains('scb-hidden-toggle')) {
    const open = !markers.every((m) => m.getAttribute('aria-expanded') === 'true');
    for (const marker of markers) setRun(block, marker, open);
  } else setRun(block, button, button.getAttribute('aria-expanded') !== 'true');
  syncToggle(block, markers);
}

let ready = false;

/** Toggles a hidden-lines marker, or every marker at once from the title bar button. */
export default function initHiddenLines() {
  if (!ready) {
    ready = true;
    document.addEventListener('click', click);
  }
  // A line permalink can target a hidden line before this script is ready.
  for (const line of document.querySelectorAll('[data-scb-hidden-lines] .scb-permalink-target.scb-hidden-line')) {
    if (line.classList.contains(OPEN)) continue;
    const block = line.closest('[data-scb-hidden-lines]');
    const marker = [...(block?.querySelectorAll<HTMLElement>('.scb-hidden-marker') ?? [])].find((m) =>
      ids(m).includes(line.id),
    );
    marker?.click();
  }
}
