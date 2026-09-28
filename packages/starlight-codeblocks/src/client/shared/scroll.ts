export function scrollTo(el: Element, block: ScrollLogicalPosition) {
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block, behavior: smooth ? 'smooth' : 'auto' });
}

/** Scrolls to `el` unless all of it is in the viewport. */
export function reveal(el: Element, block: ScrollLogicalPosition) {
  const { top, bottom } = el.getBoundingClientRect();
  if (top < 0 || bottom > innerHeight) scrollTo(el, block);
}
