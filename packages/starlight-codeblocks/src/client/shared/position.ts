/** The gap, in px, that floating elements keep from the viewport edges. */
export const EDGE = 12;

export const anchored = () => CSS.supports('position-area', 'block-end');

/** Runs `update` now and on every scroll and resize, until it stops or `el` leaves the page. Returns a function that stops it. */
export function follow(el: Element, update: () => void): () => void {
  // A page swap removes an open popover without a `toggle` event, so nothing else would stop it.
  const run = () => (el.isConnected ? update() : stop());
  const stop = () => {
    removeEventListener('scroll', run, { capture: true });
    removeEventListener('resize', run);
  };
  update();
  addEventListener('scroll', run, { capture: true, passive: true });
  addEventListener('resize', run, { passive: true });
  return stop;
}

/** The script version of the `scb-float` styles: centred below `anchor`, or above it when there is no room below. */
export function below(floating: HTMLElement, anchor: HTMLElement) {
  const gap = 8;
  const a = anchor.getBoundingClientRect();
  const { width, height } = floating.getBoundingClientRect();
  const fitsBelow = a.bottom + gap + height <= innerHeight - EDGE;
  const top = fitsBelow || a.top - gap - height < EDGE ? a.bottom + gap : a.top - gap - height;
  const left = Math.max(EDGE, Math.min(a.left + a.width / 2 - width / 2, innerWidth - width - EDGE));
  Object.assign(floating.style, { margin: '0', top: `${top}px`, left: `${left}px` });
}

/**
 * Places a popover or hover card centred below its anchor, or above it when there is no room below,
 * and keeps it 12px inside the viewport. It uses CSS anchor positioning where the browser supports it,
 * and a script fallback elsewhere. The element needs the `scb-float` class, and must be inside
 * the block's `.expressive-code` element, which holds the theme colours.
 *
 * Returns a function that stops the fallback from following scroll and resize.
 */
export function place(floating: HTMLElement, anchor: HTMLElement): () => void {
  if (anchored()) {
    const name = anchor.style.getPropertyValue('anchor-name') || `--scb-${Math.random().toString(36).slice(2)}`;
    anchor.style.setProperty('anchor-name', name);
    floating.style.setProperty('position-anchor', name);
    return () => {};
  }
  return follow(floating, () => below(floating, anchor));
}
