const ON = 'scb-footnote-on';
const PEEK = 'scb-footnote-peek';

function reveal(el: Element) {
  const { top, bottom } = el.getBoundingClientRect();
  if (top >= 0 && bottom <= innerHeight) return;
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
}

/** A click on a badge or a note toggles its highlight, and several can stay on. A click elsewhere clears them. */
function select(event: MouseEvent) {
  const target = event.target as Element;
  const badge = target.closest<HTMLElement>('.scb-footnote-badge');
  const item = target.closest<HTMLElement>('.scb-footnotes li');
  const block = (badge ?? item)?.closest('[data-scb-footnotes]');
  if (!block) {
    for (const el of document.querySelectorAll(`.${ON}`)) el.classList.remove(ON);
    return;
  }
  const link = target.closest('a.scb-footnote-badge, a.scb-footnote-num');
  if (link) event.preventDefault();
  const n = (badge ?? item)?.dataset.scbFn;
  const line = block.querySelector(`.scb-footnote-badge[data-scb-fn="${n}"]`)?.closest('.ec-line');
  const entry = block.querySelector<HTMLElement>(`.scb-footnotes li[data-scb-fn="${n}"]`);
  // The number in the list is the way back to the line, so it keeps the highlight.
  if (entry?.classList.contains(ON) && !target.closest('a.scb-footnote-num')) {
    line?.classList.remove(ON);
    entry.classList.remove(ON);
    return;
  }
  line?.classList.add(ON);
  entry?.classList.add(ON);
  const other = badge ? entry : line;
  if (other) reveal(other);
  // The links do not change the hash, so focus must follow them for keyboard and screen reader users.
  if (link) {
    const next = badge ? entry : line?.querySelector<HTMLElement>(`.scb-footnote-badge[data-scb-fn="${n}"]`);
    next?.focus({ preventScroll: true });
  }
}

/** The line and the list item of the footnote under a mouse pointer. */
function pair(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return [];
  const target = event.target as Element;
  const el = target.closest?.<HTMLElement>('.scb-footnote-badge, .scb-footnotes li');
  const block = el?.closest('[data-scb-footnotes]');
  const n = el?.dataset.scbFn;
  if (!block || !n) return [];
  return [
    block.querySelector(`.scb-footnote-badge[data-scb-fn="${n}"]`)?.closest('.ec-line'),
    block.querySelector(`.scb-footnotes li[data-scb-fn="${n}"]`),
  ];
}

/** Hovering over a badge or a note highlights both until the pointer leaves. A click keeps the highlight. */
const peek = (on: boolean) => (event: PointerEvent) => {
  for (const el of pair(event)) el?.classList.toggle(PEEK, on);
};

/** Scrolls a focused control in a line out from under the sticky footnote list. */
function unobscure(event: FocusEvent) {
  const el = event.target as Element;
  const list = el.closest('.ec-line') && el.closest('.scb-footnotes-sticky')?.querySelector('.scb-footnotes');
  if (!list) return;
  const overlap = el.getBoundingClientRect().bottom - list.getBoundingClientRect().top;
  if (overlap > 0) scrollBy({ top: overlap + 8, behavior: 'instant' });
}

let ready = false;

/** Highlights a footnote's line and list item together. Without it, the badges and items are plain links. */
export default function initFootnotes() {
  if (ready) return;
  ready = true;
  document.addEventListener('click', select);
  document.addEventListener('pointerover', peek(true));
  document.addEventListener('pointerout', peek(false));
  document.addEventListener('focusin', unobscure);
}
