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
  if (target.closest('a.scb-footnote-badge, a.scb-footnote-num')) event.preventDefault();
  const n = (badge ?? item)?.dataset.scbFn;
  const line = block.querySelector(`.scb-footnote-badge[data-scb-fn="${n}"]`)?.closest('.ec-line');
  const entry = block.querySelector(`.scb-footnotes li[data-scb-fn="${n}"]`);
  line?.classList.add(ON);
  entry?.classList.add(ON);
  const other = badge ? entry : line;
  if (other) reveal(other);
}

let ready = false;

/** Highlights a footnote's line and list item together. Without it, the badges and items are plain links. */
export default function initFootnotes() {
  if (ready) return;
  ready = true;
  document.addEventListener('click', select);
}
