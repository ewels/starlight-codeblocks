const SELECT = 'data-scb-callout-select';

let selectable: Element | undefined;
let listening = false;

/**
 * Makes a bubble's text selectable for a selection that starts in it, so that a drag across the code
 * still leaves the bubbles out.
 */
export default function initCallouts() {
  if (listening) return;
  listening = true;
  document.addEventListener('pointerdown', (event) => {
    selectable?.removeAttribute(SELECT);
    selectable = (event.target as Element).closest?.('.scb-callout-bubble') ?? undefined;
    selectable?.setAttribute(SELECT, '');
  });
}
