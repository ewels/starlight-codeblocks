import { reveal } from './shared/scroll.ts';

const ON = 'scb-footnote-on';
const PEEK = 'scb-footnote-peek';

const FOOTNOTE = '.scb-footnote-badge, .scb-footnotes li';

/** The badge and the list item of footnote `n` in `block`. */
const ends = (block: Element, n?: string) =>
  [
    block.querySelector<HTMLElement>(`.scb-footnote-badge[data-scb-fn="${n}"]`),
    block.querySelector<HTMLElement>(`.scb-footnotes li[data-scb-fn="${n}"]`),
  ] as const;

/** A click on a badge or a note toggles its highlight, and several can stay on. A click elsewhere clears them. */
function select(event: MouseEvent) {
  const target = event.target as Element;
  const el = target.closest<HTMLElement>(FOOTNOTE);
  const block = el?.closest('[data-scb-footnotes]');
  if (!el || !block) {
    for (const on of document.querySelectorAll(`.${ON}`)) on.classList.remove(ON);
    return;
  }
  const link = target.closest('a.scb-footnote-badge, a.scb-footnote-num');
  if (link) event.preventDefault();
  const [badge, entry] = ends(block, el.dataset.scbFn);
  const line = badge?.closest('.ec-line');
  // The number in the list is the way back to the line, so it keeps the highlight.
  if (entry?.classList.contains(ON) && !target.closest('a.scb-footnote-num')) {
    line?.classList.remove(ON);
    entry.classList.remove(ON);
    return;
  }
  line?.classList.add(ON);
  entry?.classList.add(ON);
  const fromBadge = el.tagName === 'A';
  const other = fromBadge ? entry : line;
  if (other) reveal(other, 'center');
  // The links do not change the hash, so focus must follow them for keyboard and screen reader users.
  if (link) (fromBadge ? entry : badge)?.focus({ preventScroll: true });
}

/** Hovering over a badge or a note highlights its line and list item until the pointer leaves. A click keeps the highlight. */
const peek = (on: boolean) => (event: PointerEvent) => {
  if (event.pointerType !== 'mouse') return;
  const el = (event.target as Element).closest?.<HTMLElement>(FOOTNOTE);
  const block = el?.closest('[data-scb-footnotes]');
  if (!el?.dataset.scbFn || !block) return;
  const [badge, entry] = ends(block, el.dataset.scbFn);
  badge?.closest('.ec-line')?.classList.toggle(PEEK, on);
  entry?.classList.toggle(PEEK, on);
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
