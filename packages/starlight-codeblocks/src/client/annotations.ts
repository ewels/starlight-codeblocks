import { place } from './shared/position.ts';

function popovers(block: HTMLElement) {
  for (const popover of block.querySelectorAll<HTMLElement>('.scb-annotation-popover')) {
    const button = block.querySelector<HTMLElement>(`[popovertarget="${popover.id}"]`);
    let stop = () => {};
    popover.addEventListener('toggle', (event) => {
      stop();
      stop = button && (event as ToggleEvent).newState === 'open' ? place(popover, button) : () => {};
    });
  }
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
  }
  for (const block of document.querySelectorAll<HTMLElement>(
    '[data-scb-annotations]:not([data-scb-annotations-ready])',
  )) {
    block.dataset.scbAnnotationsReady = '';
    popovers(block);
    side(block);
  }
}
