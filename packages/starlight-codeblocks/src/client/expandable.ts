const COLLAPSED = 'scb-expandable-collapsed';

const linesOf = (pre: HTMLElement) =>
  pre.querySelectorAll<HTMLElement>('.ec-line:not(summary > *):not(.scb-hidden-line)');
// Without until-found support the attribute value is ignored, and the lines are plainly hidden.
const HIDDEN = 'onbeforematch' in HTMLElement.prototype ? 'until-found' : '';

function tail(pre: HTMLElement) {
  const last = linesOf(pre)[Number(pre.dataset.scbExpandable) - 1];
  return [...(last?.parentElement?.children ?? [])].filter(
    (el) => last && last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function set(pre: HTMLElement, expanded: boolean) {
  for (const line of tail(pre)) {
    if (expanded) line.removeAttribute('hidden');
    // until-found keeps the element's own box, so a marker button would stay an invisible tab stop.
    else line.setAttribute('hidden', line.classList.contains('scb-hidden-marker') ? '' : HIDDEN);
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

function toggle(pre: HTMLElement, button: Element, expand: boolean) {
  for (const animation of pre.getAnimations()) animation.finish();
  const from = pre.offsetHeight;
  const { top } = button.getBoundingClientRect();
  set(pre, expand);
  const to = pre.offsetHeight;
  // The button sits under the tail, and scroll anchoring does not follow it when the tail collapses.
  const hold = () => !expand && scrollBy({ top: button.getBoundingClientRect().top - top, behavior: 'instant' });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return hold();
  // The tail stays visible while the block shrinks over it.
  if (!expand) for (const line of tail(pre)) line.removeAttribute('hidden');
  const animation = pre.animate(
    { height: [`${from}px`, `${to}px`], overflow: ['hidden', 'hidden'] },
    { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  );
  const follow = () => {
    hold();
    if (animation.playState === 'running') requestAnimationFrame(follow);
  };
  follow();
  // A click during the animation finishes it, and its finish event comes after the new state.
  animation.onfinish = () => {
    if (pre.getAnimations().length > 0) return;
    if (!expand) set(pre, false);
    hold();
  };
}

let ready = false;

/** Collapses a long block to its `data-scb-expandable` line count, expandable by button or find in page. */
export default function initExpandable() {
  if (!ready) {
    ready = true;
    document.addEventListener('click', (event) => {
      const button = (event.target as Element).closest('.scb-expandable-toggle');
      const pre = button && preOf(button);
      if (pre) toggle(pre, button, button.getAttribute('aria-expanded') !== 'true');
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
