const OPEN = 'scb-hidden-open';

function ids(el: HTMLElement) {
  return (el.getAttribute('aria-controls') ?? '').split(' ').filter(Boolean);
}

function setRun(marker: HTMLElement, open: boolean) {
  for (const id of ids(marker)) {
    const line = document.getElementById(id);
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

function syncToggle(markers: HTMLElement[], toggle: HTMLElement) {
  const total = markers.reduce((sum, m) => sum + ids(m).length, 0);
  const allOpen = markers.every((m) => m.getAttribute('aria-expanded') === 'true');
  toggle.textContent = allOpen ? `Hide ${total} lines` : `Show ${total} hidden line${total === 1 ? '' : 's'}`;
}

/** Toggles a hidden-lines marker, or every marker at once from the title bar button. */
export default function initHiddenLines() {
  for (const block of document.querySelectorAll<HTMLElement>(
    '[data-scb-hidden-lines]:not([data-scb-hidden-lines-ready])',
  )) {
    block.dataset.scbHiddenLinesReady = '';
    const markers = [...block.querySelectorAll<HTMLElement>('.scb-hidden-marker')];
    const toggle = block.querySelector<HTMLElement>('.scb-hidden-toggle');
    for (const marker of markers) {
      marker.addEventListener('click', () => {
        setRun(marker, marker.getAttribute('aria-expanded') !== 'true');
        if (toggle) syncToggle(markers, toggle);
      });
    }
    toggle?.addEventListener('click', () => {
      const open = !markers.every((m) => m.getAttribute('aria-expanded') === 'true');
      for (const marker of markers) setRun(marker, open);
      syncToggle(markers, toggle);
    });
    // A line permalink can target a hidden line before this script is ready.
    for (const line of block.querySelectorAll('.scb-permalink-target.scb-hidden-line')) {
      if (!line.classList.contains(OPEN)) markers.find((m) => ids(m).includes(line.id))?.click();
    }
  }
}
