import { place } from './shared/position.ts';

const stops = new WeakMap<Element, () => void>();

function toggle(event: Event) {
  const popover = event.target as HTMLElement;
  if (!popover.classList?.contains('scb-annotation-popover')) return;
  stops.get(popover)?.();
  const button = popover.previousElementSibling as HTMLElement | null;
  if (button && (event as ToggleEvent).newState === 'open') stops.set(popover, place(popover, button));
}

/**
 * `popovertarget` finds the popover by id, so in a copy of the block, as full screen plugins show, it would
 * open the popover of the original. The popover right after the button is the button's own.
 */
function click(event: MouseEvent) {
  const button = (event.target as Element).closest<HTMLElement>('button.scb-annotation');
  const popover = button?.nextElementSibling as HTMLElement | null | undefined;
  if (!button || !popover || document.getElementById(popover.id) === popover) return;
  event.preventDefault();
  popover.togglePopover();
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
 * Positions annotation popovers where CSS anchor positioning is missing (the `popover` attribute does
 * the rest), and links each side-by-side note with its line on hover and focus.
 */
export default function initAnnotations() {
  if (!ready) {
    ready = true;
    addEventListener('resize', checkHeights, { passive: true });
    // Toggle events do not bubble, so listen in the capture phase.
    document.addEventListener('toggle', toggle, true);
    document.addEventListener('click', click);
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
