const COLLAPSED = 'scb-expandable-collapsed';

const linesOf = (pre: HTMLElement) => pre.querySelectorAll<HTMLElement>('.ec-line:not(summary > *)');

function tail(pre: HTMLElement) {
  const last = linesOf(pre)[Number(pre.dataset.scbExpandable) - 1];
  return [...(last?.parentElement?.children ?? [])].filter(
    (el) => last && last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function set(pre: HTMLElement, expanded: boolean) {
  for (const line of tail(pre)) {
    if (expanded) line.removeAttribute('hidden');
    else line.setAttribute('hidden', 'until-found');
  }
  pre.classList.toggle(COLLAPSED, !expanded);
  const button = pre.parentElement?.querySelector('.scb-expandable-toggle');
  if (!button) return;
  button.setAttribute('aria-expanded', String(expanded));
  button.textContent = expanded ? 'Show fewer lines' : `Show all ${linesOf(pre).length} lines`;
}

// Found through the event target, so that a copy of the block, as full screen plugins show, works too.
const preOf = (el: Element) =>
  el.closest('.expressive-code')?.querySelector<HTMLElement>('pre[data-scb-expandable]') ?? null;

let ready = false;

/** Collapses a long block to its `data-scb-expandable` line count, expandable by button or find in page. */
export default function initExpandable() {
  if (!ready) {
    ready = true;
    document.addEventListener('click', (event) => {
      const button = (event.target as Element).closest('.scb-expandable-toggle');
      const pre = button && preOf(button);
      if (pre) set(pre, button.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener(
      'beforematch',
      (event) => {
        // Line permalinks also send it to a hidden-lines line, which this collapse may not hide.
        const pre = (event.target as HTMLElement).hidden && preOf(event.target as Element);
        if (pre) set(pre, true);
      },
      true,
    );
  }
  for (const pre of document.querySelectorAll<HTMLElement>(
    'pre[data-scb-expandable]:not([data-scb-expandable-ready])',
  )) {
    pre.dataset.scbExpandableReady = '';
    if (!pre.parentElement?.querySelector('.scb-expandable-toggle')) continue;
    set(
      pre,
      tail(pre).some((el) => el.classList.contains('scb-permalink-target')),
    );
  }
}
