import { place } from './shared/position.ts';

/** Positions annotation popovers where CSS anchor positioning is missing. The `popover` attribute does the rest. */
export default function initAnnotations() {
  for (const block of document.querySelectorAll<HTMLElement>(
    '[data-scb-annotations]:not([data-scb-annotations-ready])',
  )) {
    block.dataset.scbAnnotationsReady = '';
    for (const popover of block.querySelectorAll<HTMLElement>('.scb-annotation-popover')) {
      const button = block.querySelector<HTMLElement>(`[popovertarget="${popover.id}"]`);
      let stop = () => {};
      popover.addEventListener('toggle', (event) => {
        stop();
        stop = button && (event as ToggleEvent).newState === 'open' ? place(popover, button) : () => {};
      });
    }
  }
}
