export function scrollTo(el: Element, block: ScrollLogicalPosition) {
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block, behavior: smooth ? 'smooth' : 'auto' });
}

/** Scrolls to `el` unless all of it is in the viewport, and returns whether it scrolled. */
export function reveal(el: Element, block: ScrollLogicalPosition) {
  const { top, bottom } = el.getBoundingClientRect();
  const off = top < 0 || bottom > innerHeight;
  if (off) scrollTo(el, block);
  return off;
}

/** Opens a line that a tab panel, a collapsible section, an expandable block, hidden lines, a walkthrough step or a code tabs block variant hide. The last four listen for `beforematch`. */
export function unhide(line: HTMLElement) {
  for (
    let p = line.closest('[role="tabpanel"][hidden]');
    p;
    p = p.parentElement?.closest('[role="tabpanel"][hidden]') ?? null
  ) {
    const id = CSS.escape(p.id);
    document.querySelector<HTMLElement>(`[role="tab"][aria-controls="${id}"], [role="tab"][href="#${id}"]`)?.click();
  }
  for (let d = line.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])') ?? null) {
    (d as HTMLDetailsElement).open = true;
  }
  line.dispatchEvent(new Event('beforematch'));
}
