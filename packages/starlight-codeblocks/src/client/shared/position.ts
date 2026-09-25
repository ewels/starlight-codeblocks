/**
 * Places a popover or hover card below its anchor, or above it when there is no room below,
 * and keeps it inside the viewport. It uses CSS anchor positioning where the browser supports it,
 * and a script fallback elsewhere. The element needs the `scb-float` class, and must be inside
 * the block's `.expressive-code` element, which holds the theme colours.
 *
 * Returns a function that stops the fallback from following scroll and resize.
 */
export function place(floating: HTMLElement, anchor: HTMLElement): () => void {
  if (CSS.supports('position-area', 'block-end')) {
    const name = anchor.style.getPropertyValue('anchor-name') || `--scb-${Math.random().toString(36).slice(2)}`;
    anchor.style.setProperty('anchor-name', name);
    floating.style.setProperty('position-anchor', name);
    return () => {};
  }
  const gap = 6;
  const edge = 8;
  const update = () => {
    const a = anchor.getBoundingClientRect();
    const { width, height } = floating.getBoundingClientRect();
    const fitsBelow = a.bottom + gap + height <= innerHeight - edge;
    const top = fitsBelow || a.top - gap - height < edge ? a.bottom + gap : a.top - gap - height;
    const left = Math.max(edge, Math.min(a.left, innerWidth - width - edge));
    Object.assign(floating.style, { margin: '0', top: `${top}px`, left: `${left}px` });
  };
  update();
  addEventListener('scroll', update, { capture: true, passive: true });
  addEventListener('resize', update, { passive: true });
  return () => {
    removeEventListener('scroll', update, { capture: true });
    removeEventListener('resize', update);
  };
}
