const COLLAPSED = 'scb-expandable-collapsed';

/** Collapses a long block to its `data-scb-expandable` line count, expandable by button or find in page. */
export default function initExpandable() {
  for (const pre of document.querySelectorAll<HTMLElement>(
    'pre[data-scb-expandable]:not([data-scb-expandable-ready])',
  )) {
    pre.dataset.scbExpandableReady = '';
    const n = Number(pre.dataset.scbExpandable);
    const lines = [...pre.querySelectorAll<HTMLElement>('.ec-line:not(summary > *)')];
    const total = lines.length;
    const button = pre.parentElement?.querySelector<HTMLButtonElement>('.scb-expandable-toggle');
    if (!button) continue;
    const last = lines[n - 1];
    const tail = [...(last?.parentElement?.children ?? [])].filter(
      (el) => last && last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const collapse = () => {
      for (const line of tail) line.setAttribute('hidden', 'until-found');
      pre.classList.add(COLLAPSED);
      button.setAttribute('aria-expanded', 'false');
      button.textContent = `Show all ${total} lines`;
    };
    const expand = () => {
      for (const line of tail) line.removeAttribute('hidden');
      pre.classList.remove(COLLAPSED);
      button.setAttribute('aria-expanded', 'true');
      button.textContent = 'Show fewer lines';
    };
    for (const line of tail) line.addEventListener('beforematch', expand);
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-expanded') === 'true') collapse();
      else expand();
    });
    if (tail.some((el) => el.classList.contains('scb-permalink-target'))) expand();
    else collapse();
  }
}
