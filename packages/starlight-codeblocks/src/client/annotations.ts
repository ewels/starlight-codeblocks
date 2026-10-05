import { anchored, below, EDGE, follow } from './shared/position.ts';
import { unhide } from './shared/scroll.ts';

const END = 'scb-annotation-end';
const WAIT = 'scb-annotation-wait';
const stops = new WeakMap<Element, () => void>();

const intersects = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** True when the box covers a glyph of the line's code text, not counting its markers and popovers. */
function coversText(line: Element, box: DOMRect) {
  const range = document.createRange();
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const end = node.textContent?.trimEnd().length ?? 0;
    if (!end || node.parentElement?.closest('.scb-annotation, .scb-float')) continue;
    range.setStart(node, 0);
    range.setEnd(node, end);
    for (const r of range.getClientRects()) {
      // A glyph box reaches past the ink of most glyphs, so the note may cover its top and bottom quarter.
      if (intersects(new DOMRect(r.x, r.y + r.height / 4, r.width, r.height / 2), box)) return true;
    }
  }
  return false;
}

/** True when the box, beside the marker, stays in the visible block and the viewport and covers no code or other marker. */
function fitsBeside(popover: HTMLElement, pre: HTMLElement) {
  const box = popover.getBoundingClientRect();
  const block = pre.getBoundingClientRect();
  const blockRight = block.left + pre.clientLeft + pre.clientWidth;
  if (
    box.left < block.left ||
    box.right > Math.min(blockRight, innerWidth - EDGE) ||
    box.top < Math.max(block.top, EDGE) ||
    box.bottom > Math.min(block.bottom, innerHeight - EDGE)
  ) {
    return false;
  }
  for (const line of pre.querySelectorAll('.ec-line')) if (coversText(line, box)) return false;
  for (const marker of pre.querySelectorAll('button.scb-annotation')) {
    if (marker !== popover.previousElementSibling && intersects(marker.getBoundingClientRect(), box)) return false;
  }
  return true;
}

/** Puts the popover's badge over the marker, with the box to its right, or else centred below the marker. */
function open(popover: HTMLElement, button: HTMLElement) {
  const pre = button.closest('pre');
  const css = anchored();
  return follow(popover, () => {
    popover.classList.add(END);
    if (!css) {
      const badge = popover.querySelector('.scb-annotation-badge')?.getBoundingClientRect();
      const box = popover.getBoundingClientRect();
      const a = button.getBoundingClientRect();
      if (badge) {
        const left = box.left + a.left + a.width / 2 - (badge.left + badge.width / 2);
        const top = box.top + a.top + a.height / 2 - (badge.top + badge.height / 2);
        Object.assign(popover.style, { margin: '0', left: `${left}px`, top: `${top}px` });
      }
    }
    const beside = pre !== null && fitsBeside(popover, pre);
    popover.classList.toggle(END, beside);
    if (!beside && !css) below(popover, button);
    popover.classList.remove(WAIT);
  });
}

// Hidden from its first frame until `toggle`, after it opens, has measured where it goes.
function beforeToggle(event: Event) {
  const popover = event.target as HTMLElement;
  if (popover.classList?.contains('scb-annotation-popover') && (event as ToggleEvent).newState === 'open') {
    popover.classList.add(WAIT);
  }
}

function toggle(event: Event) {
  const popover = event.target as HTMLElement;
  if (!popover.classList?.contains('scb-annotation-popover')) return;
  stops.get(popover)?.();
  if ((event as ToggleEvent).newState === 'closed') delete popover.dataset.scbPeek;
  const button = popover.previousElementSibling as HTMLElement | null;
  if (button && (event as ToggleEvent).newState === 'open') stops.set(popover, open(popover, button));
}

const NOTE = '.scb-annotation-popover';
// Notes that a click closed. Hover does not show them again until the pointer leaves.
const closed = new WeakSet<Element>();
const openNotes = () => document.querySelectorAll<HTMLElement>(`${NOTE}:popover-open`);

/**
 * The notes are manual popovers, so that several can stay open and hovering still works while one is open.
 * A marker, or the badge of its note that covers the marker, toggles the note. A click in a note that shows
 * on hover keeps it open. A click anywhere else closes every note.
 */
function click(event: MouseEvent) {
  const target = event.target as Element;
  const note = target.closest<HTMLElement>(NOTE);
  if (note) {
    if (note.dataset.scbPeek !== undefined) delete note.dataset.scbPeek;
    else if (target.closest('.scb-annotation-badge')) {
      closed.add(note);
      note.hidePopover();
    }
    return;
  }
  const button = target.closest<HTMLElement>('button.scb-annotation');
  const popover = button?.nextElementSibling as HTMLElement | null | undefined;
  if (!button || !popover) {
    for (const open of openNotes()) open.hidePopover();
    return;
  }
  if (popover.dataset.scbPeek !== undefined) {
    event.preventDefault();
    delete popover.dataset.scbPeek;
    return;
  }
  if (popover.matches(':popover-open')) closed.add(popover);
  // `popovertarget` finds the popover by id, so in a copy of the block, as full screen plugins show, it
  // would open the popover of the original. The popover right after the button is the button's own.
  if (document.getElementById(popover.id) === popover) return;
  event.preventDefault();
  popover.togglePopover();
}

function keydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  const notes = [...openNotes()];
  const focused = (document.activeElement as Element | null)?.closest<HTMLElement>(NOTE);
  for (const note of notes) note.hidePopover();
  (focused?.previousElementSibling as HTMLElement | null)?.focus();
}

let showing = 0;
const hiding = new WeakMap<Element, number>();

/** The popover of the marker or the popover under the pointer, and whether the pointer is on the marker. */
function hovered(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return {};
  const target = event.target as Element;
  const button = target.closest?.('button.scb-annotation');
  const popover = (button?.nextElementSibling ?? target.closest?.(NOTE)) as HTMLElement | null;
  return { popover, button };
}

/**
 * Hovering over a marker shows its note until the pointer leaves the marker and the note. The delay
 * before it hides lets the pointer move into the note.
 */
function pointerOver(event: PointerEvent) {
  const { popover, button } = hovered(event);
  if (!popover) return;
  clearTimeout(hiding.get(popover));
  if (!button || closed.has(popover) || popover.matches(':popover-open')) return;
  clearTimeout(showing);
  showing = window.setTimeout(() => {
    if (popover.matches(':popover-open')) return;
    popover.dataset.scbPeek = '';
    // `source` makes the marker the invoker, as a click does, for its expanded state.
    (popover.showPopover as (options?: { source?: Element }) => void)({ source: button });
  }, 80);
}

function pointerOut(event: PointerEvent) {
  const { popover } = hovered(event);
  if (!popover) return;
  clearTimeout(showing);
  const to = (event.relatedTarget as Element | null)?.closest?.('button.scb-annotation, .scb-annotation-popover');
  if (to !== popover && to !== popover.previousElementSibling) closed.delete(popover);
  if (popover.dataset.scbPeek === undefined) return;
  hiding.set(
    popover,
    window.setTimeout(() => popover.dataset.scbPeek !== undefined && popover.hidePopover(), 200),
  );
}

let lit: Element | null | undefined;
let litN: string | undefined;

// `n` and a line's `data-scb-anno` can each list several numbers, for a line with several notes.
const mark = (block: Element | null | undefined, n?: string) => {
  const on = n?.split(' ') ?? [];
  for (const note of block?.querySelectorAll<HTMLElement>('[data-scb-anno]') ?? []) {
    note.classList.toggle(
      note.tagName === 'LI' ? 'scb-annotation-on' : 'scb-annotation-lit',
      note.dataset.scbAnno?.split(' ').some((m) => on.includes(m)) ?? false,
    );
  }
};

/** Lights the note and the line number of `n` in the block with side annotations of `el`, and nothing elsewhere. */
function light(el: Element | null, n?: string) {
  const block = el?.closest('[data-scb-annotations]');
  if (lit === block && litN === n) return;
  if (lit !== block) mark(lit);
  lit = block;
  litN = n;
  mark(block, n);
}

const over = (event: Event) => {
  const target = event.target as Element;
  light(target, target.closest?.<HTMLElement>('[data-scb-anno]')?.dataset.scbAnno);
};

const PIN = 'scb-annotation-pin';

/** A click on a side annotation or its number toggles its highlight, and several can stay on. A click elsewhere clears them. */
function pin(event: MouseEvent | KeyboardEvent) {
  const target = event.target as Element;
  const el = target.closest?.<HTMLElement>('.scb-annotation-notes li[data-scb-anno], .scb-annotation-num');
  const block = el?.closest('[data-scb-annotations]');
  if (event.type === 'keydown') {
    if (!el?.matches('li') || ((event as KeyboardEvent).key !== 'Enter' && (event as KeyboardEvent).key !== ' '))
      return;
    event.preventDefault();
  }
  if (!el || !block) {
    if (event.type === 'click') for (const on of document.querySelectorAll(`.${PIN}`)) on.classList.remove(PIN);
    return;
  }
  if (target.closest('a[href]')) return;
  const n = (el.matches('li') ? el : el.closest<HTMLElement>('.ec-line'))?.dataset.scbAnno?.split(' ')[0];
  const note = block.querySelector(`.scb-annotation-notes li[data-scb-anno="${n}"]`);
  const on = !note?.classList.contains(PIN);
  note?.classList.toggle(PIN, on);
  const pinned = [...block.querySelectorAll<HTMLElement>(`li.${PIN}`)].map((li) => li.dataset.scbAnno);
  for (const line of block.querySelectorAll<HTMLElement>('.ec-line[data-scb-anno]')) {
    line.classList.toggle(PIN, line.dataset.scbAnno?.split(' ').some((m) => pinned.includes(m)) ?? false);
  }
}

/** A focused side annotation opens its lines when an expandable block or hidden lines hide them. */
function show(event: FocusEvent) {
  const note = (event.target as Element).closest?.<HTMLElement>('.scb-annotation-notes li[data-scb-anno]');
  const on = note?.dataset.scbAnno?.split(' ') ?? [];
  for (const line of note
    ?.closest('[data-scb-annotations]')
    ?.querySelectorAll<HTMLElement>('.ec-line[data-scb-anno]') ?? []) {
    if (line.dataset.scbAnno?.split(' ').some((m) => on.includes(m))) unhide(line);
  }
}

const sides = new Set<HTMLElement>();

/** A column taller than the space below the header cannot stick usefully. */
function checkHeight(block: HTMLElement) {
  const notes = block.querySelector<HTMLElement>('.scb-annotation-notes');
  if (!notes) return;
  block.classList.remove('scb-side-static');
  const top = Number.parseFloat(getComputedStyle(notes).top) || 0;
  block.classList.toggle('scb-side-static', notes.offsetHeight > innerHeight - top);
}

// A block that starts hidden (a code tabs block variant, a closed <details>) is 0px tall until it shows.
const resized = new ResizeObserver((entries) => {
  for (const { target } of entries) checkHeight(target as HTMLElement);
});

function prune() {
  for (const block of sides) {
    if (!block.isConnected) {
      sides.delete(block);
      resized.unobserve(block);
    }
  }
}

function checkHeights() {
  for (const block of sides) checkHeight(block);
}

let ready = false;

/**
 * Places annotation popovers beside their marker when they fit (the `popover` attribute does the rest),
 * and links each side annotation with its line on hover and focus.
 */
export default function initAnnotations() {
  if (!ready) {
    ready = true;
    addEventListener('resize', checkHeights, { passive: true });
    // Toggle events do not bubble, so listen in the capture phase.
    document.addEventListener('beforetoggle', beforeToggle, true);
    document.addEventListener('toggle', toggle, true);
    document.addEventListener('click', click);
    document.addEventListener('keydown', keydown);
    document.addEventListener('pointerover', pointerOver);
    document.addEventListener('pointerout', pointerOut);
    // On the document, so that copies of a block, as full screen plugins show, light up too.
    document.addEventListener('mouseover', over);
    document.addEventListener('focusin', over);
    document.addEventListener('focusin', show);
    document.addEventListener('click', pin);
    document.addEventListener('keydown', pin);
    document.addEventListener('focusout', () => light(null));
    document.addEventListener('mouseout', (event) => event.relatedTarget || light(null));
  }
  prune();
  for (const block of document.querySelectorAll<HTMLElement>(
    '[data-scb-annotations]:not([data-scb-annotations-ready])',
  )) {
    block.dataset.scbAnnotationsReady = '';
    sides.add(block);
    resized.observe(block);
  }
}
