const ON = 'scb-footnote-on';

function reveal(el: Element) {
  const { top, bottom } = el.getBoundingClientRect();
  if (top >= 0 && bottom <= innerHeight) return;
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
}

function select(event: MouseEvent) {
  for (const el of document.querySelectorAll(`.${ON}`)) el.classList.remove(ON);
  const target = event.target as Element;
  const badge = target.closest<HTMLElement>('.scb-footnote-badge');
  const item = target.closest<HTMLElement>('.scb-footnotes li');
  const block = (badge ?? item)?.closest('[data-scb-footnotes]');
  if (!block) return;
  const link = target.closest('a.scb-footnote-badge, a.scb-footnote-num');
  if (link) event.preventDefault();
  const n = (badge ?? item)?.dataset.scbFn;
  const line = block.querySelector(`.scb-footnote-badge[data-scb-fn="${n}"]`)?.closest('.ec-line');
  const entry = block.querySelector<HTMLElement>(`.scb-footnotes li[data-scb-fn="${n}"]`);
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
  document.addEventListener('focusin', unobscure);
}
