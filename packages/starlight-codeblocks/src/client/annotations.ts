import { anchored, below, follow } from './shared/position.ts';

const END = 'scb-annotation-end';
const WAIT = 'scb-annotation-wait';
const edge = 12;
const stops = new WeakMap<Element, () => void>();

/** The right edge of a line's code text, without its markers and popovers. */
function textEnd(line: Element) {
  let right = Number.NEGATIVE_INFINITY;
  const range = document.createRange();
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const end = node.textContent?.trimEnd().length ?? 0;
    if (!end || node.parentElement?.closest('.scb-annotation, .scb-float')) continue;
    range.setStart(node, 0);
    range.setEnd(node, end);
    right = Math.max(right, range.getBoundingClientRect().right);
  }
  return right;
}

/** True when the box, beside the marker, stays in the visible block and the viewport and covers no code. */
function fitsBeside(popover: HTMLElement, pre: HTMLElement) {
  const box = popover.getBoundingClientRect();
  const block = pre.getBoundingClientRect();
  const blockRight = block.left + pre.clientLeft + pre.clientWidth;
  if (
    box.left < block.left ||
    box.right > Math.min(blockRight, innerWidth - edge) ||
    box.top < Math.max(block.top, edge) ||
    box.bottom > Math.min(block.bottom, innerHeight - edge)
  ) {
    return false;
  }
  for (const line of pre.querySelectorAll('.ec-line')) {
    const r = line.getBoundingClientRect();
    if (r.bottom > box.top && r.top < box.bottom && textEnd(line) > box.left) return false;
  }
  return true;
}

/** Puts the popover's badge over the marker, with the box to its right, or else centred below the marker. */
function open(popover: HTMLElement, button: HTMLElement) {
  const pre = button.closest('pre');
  const css = anchored();
  return follow(() => {
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

/**
 * `popovertarget` finds the popover by id, so in a copy of the block, as full screen plugins show, it would
 * open the popover of the original. The popover right after the button is the button's own.
 */
function click(event: MouseEvent) {
  const button = (event.target as Element).closest<HTMLElement>('button.scb-annotation');
  const popover = button?.nextElementSibling as HTMLElement | null | undefined;
  // A click on a marker whose note shows on hover keeps the note open.
  if (popover?.dataset.scbPeek !== undefined) {
    event.preventDefault();
    delete popover.dataset.scbPeek;
    return;
  }
  if (!button || !popover || document.getElementById(popover.id) === popover) return;
  event.preventDefault();
  popover.togglePopover();
}

let showing = 0;
let hiding = 0;

/** The popover of the marker or the popover under the pointer, and whether the pointer is on the marker. */
function hovered(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return {};
  const target = event.target as Element;
  const button = target.closest?.('button.scb-annotation');
  const popover = (button?.nextElementSibling ?? target.closest?.('.scb-annotation-popover')) as HTMLElement | null;
  return { popover, button };
}

/**
 * Hovering over a marker shows its note until the pointer leaves the marker and the note. The delay
 * before it hides lets the pointer move into the note. A note that a click opened stays, and while one
 * is open, hovering shows no other note, because opening one would close it.
 */
function pointerOver(event: PointerEvent) {
  const { popover, button } = hovered(event);
  if (!popover) return;
  clearTimeout(hiding);
  if (!button || popover.matches(':popover-open')) return;
  if (document.querySelector('.scb-annotation-popover:popover-open:not([data-scb-peek])')) return;
  clearTimeout(showing);
  showing = window.setTimeout(() => {
    if (popover.matches(':popover-open')) return;
    popover.dataset.scbPeek = '';
    // `source` makes the marker the invoker, as a click does, for its expanded state and light dismiss.
    (popover.showPopover as (options?: { source?: Element }) => void)({ source: button });
  }, 80);
}

function pointerOut(event: PointerEvent) {
  const { popover } = hovered(event);
  if (!popover) return;
  clearTimeout(showing);
  if (popover.dataset.scbPeek === undefined) return;
  hiding = window.setTimeout(() => popover.dataset.scbPeek !== undefined && popover.hidePopover(), 200);
}

/** Lights the note and the line number of `n` in the side-by-side block of `el`, and nothing elsewhere. */
function light(el: Element | null, n?: string) {
  const block = el?.closest('[data-scb-annotations]');
  for (const on of document.querySelectorAll('.scb-annotation-on, .scb-annotation-lit')) {
    if (!block?.contains(on)) on.classList.remove('scb-annotation-on', 'scb-annotation-lit');
  }
  for (const note of block?.querySelectorAll<HTMLElement>('[data-scb-anno]') ?? []) {
    note.classList.toggle(
      note.tagName === 'LI' ? 'scb-annotation-on' : 'scb-annotation-lit',
      note.dataset.scbAnno === n,
    );
  }
}

const over = (event: Event) => {
  const target = event.target as Element;
  light(target, target.closest?.<HTMLElement>('[data-scb-anno]')?.dataset.scbAnno);
};

function side(block: HTMLElement) {
  const notes = block.querySelector<HTMLElement>('.scb-annotation-notes');
  if (!notes) return;
  // A column taller than the space below the header cannot stick usefully.
  const checkHeight = () => {
    block.classList.remove('scb-side-static');
    const top = Number.parseFloat(getComputedStyle(notes).top) || 0;
    block.classList.toggle('scb-side-static', notes.offsetHeight > innerHeight - top);
  };
  checkHeight();
  heights.set(block, checkHeight);
}

const heights = new Map<HTMLElement, () => void>();
let ready = false;

function checkHeights() {
  for (const [block, check] of heights) {
    if (block.isConnected) check();
    else heights.delete(block);
  }
}

/**
 * Places annotation popovers beside their marker when they fit (the `popover` attribute does the rest),
 * and links each side-by-side note with its line on hover and focus.
 */
export default function initAnnotations() {
  if (!ready) {
    ready = true;
    addEventListener('resize', checkHeights, { passive: true });
    // Toggle events do not bubble, so listen in the capture phase.
    document.addEventListener('beforetoggle', beforeToggle, true);
    document.addEventListener('toggle', toggle, true);
    document.addEventListener('click', click);
    document.addEventListener('pointerover', pointerOver);
    document.addEventListener('pointerout', pointerOut);
    // On the document, so that copies of a block, as full screen plugins show, light up too.
    document.addEventListener('mouseover', over);
    document.addEventListener('focusin', over);
    document.addEventListener('focusout', () => light(null));
    document.addEventListener('mouseout', (event) => event.relatedTarget || light(null));
  }
  for (const block of document.querySelectorAll<HTMLElement>(
    '[data-scb-annotations]:not([data-scb-annotations-ready])',
  )) {
    block.dataset.scbAnnotationsReady = '';
    side(block);
  }
}
