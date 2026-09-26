const COLLAPSED = 'scb-expandable-collapsed';

function tail(pre: HTMLElement) {
  const last = pre.querySelectorAll<HTMLElement>('.ec-line:not(summary > *)')[Number(pre.dataset.scbExpandable) - 1];
  return [...(last?.parentElement?.children ?? [])].filter(
    (el) => last && last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function set(pre: HTMLElement, expanded: boolean) {
  const button = pre.parentElement?.querySelector<HTMLButtonElement>('.scb-expandable-toggle');
  for (const line of tail(pre)) {
    if (expanded) line.removeAttribute('hidden');
    else line.setAttribute('hidden', 'until-found');
  }
  pre.classList.toggle(COLLAPSED, !expanded);
  button?.setAttribute('aria-expanded', String(expanded));
  if (button) {
    button.textContent = expanded
      ? 'Show fewer lines'
      : `Show all ${pre.querySelectorAll('.ec-line:not(summary > *)').length} lines`;
  }
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
        const pre = preOf(event.target as Element);
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
