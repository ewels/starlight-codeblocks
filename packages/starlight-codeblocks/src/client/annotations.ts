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

function side(block: HTMLElement) {
  const notes = block.querySelector<HTMLElement>('.scb-annotation-notes');
  if (!notes) return;
  const light = (n?: string) => {
    for (const el of block.querySelectorAll<HTMLElement>('[data-scb-anno]')) {
      el.classList.toggle(el.tagName === 'LI' ? 'scb-annotation-on' : 'scb-annotation-lit', el.dataset.scbAnno === n);
    }
  };
  const over = (event: Event) =>
    light((event.target as Element).closest<HTMLElement>('[data-scb-anno]')?.dataset.scbAnno);
  block.addEventListener('mouseover', over);
  block.addEventListener('focusin', over);
  block.addEventListener('mouseleave', () => light());
  block.addEventListener('focusout', () => light());
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
  }
  for (const block of document.querySelectorAll<HTMLElement>(
    '[data-scb-annotations]:not([data-scb-annotations-ready])',
  )) {
    block.dataset.scbAnnotationsReady = '';
    side(block);
  }
}
