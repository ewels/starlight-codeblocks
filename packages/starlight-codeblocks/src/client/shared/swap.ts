const parts = [
  // Before the title, which is a tab in it.
  '.header .scb-tabs-list',
  '.header .title',
  '.header > .sr-only',
  '.scb-steps-head',
  '.scb-tools',
  'pre',
  '.scb-expandable-bar',
  '.scb-footnotes',
  '.scb-annotation-list',
  '.copy',
  '.scb-run-output',
  '.scb-steps-controls',
];

/** Copies the attributes and classes that the block's features and frame set on its figure, and leaves the others alone. */
function syncFigure(to: Element, from: Element) {
  const ours = (name: string) => name.startsWith('data-scb-') || name === 'id' || name === 'aria-label';
  for (const { name } of [...to.attributes]) if (ours(name) && !from.hasAttribute(name)) to.removeAttribute(name);
  for (const { name, value } of from.attributes) if (ours(name)) to.setAttribute(name, value);
  const ourClass = (name: string) => name.startsWith('scb-') || name === 'has-title' || name === 'is-terminal';
  for (const name of [...to.classList]) if (ourClass(name) && !from.classList.contains(name)) to.classList.remove(name);
  for (const name of from.classList) if (ourClass(name)) to.classList.add(name);
  const gutter = (from as HTMLElement).style.getPropertyValue('--scb-gutter');
  if (gutter) (to as HTMLElement).style.setProperty('--scb-gutter', gutter);
  else (to as HTMLElement).style.removeProperty('--scb-gutter');
}

/** Wraps, unwraps or updates the side annotation column around the copy's figure to match the block. */
function syncSide(copy: Element, block: Element, figure: Element) {
  const from = block.querySelector('.scb-side');
  const to = copy.querySelector('.scb-side');
  if (!from) {
    if (to) to.replaceWith(figure);
    return;
  }
  const side = to ?? from.cloneNode(false);
  if (to) {
    to.className = from.className;
    for (const { name } of [...to.attributes]) if (name.startsWith('data-scb-')) to.removeAttribute(name);
    for (const { name, value } of from.attributes) if (name.startsWith('data-scb-')) to.setAttribute(name, value);
  } else {
    figure.replaceWith(side);
    side.appendChild(block.querySelector('.scb-side-grid')?.cloneNode(false) ?? document.createElement('div'));
    side.firstChild?.appendChild(figure);
  }
  const notes = block.querySelector('.scb-annotation-notes');
  const old = copy.querySelector('.scb-annotation-notes');
  if (!notes) old?.remove();
  else if (old) old.replaceWith(notes.cloneNode(true));
  else figure.after(notes.cloneNode(true));
}

/**
 * Turns a copy of a block, as full screen plugins show, into a copy of `block`: swaps in its parts and the
 * figure attributes that its features read, and keeps what other plugins added to the copy.
 */
export function swapInto(copy: Element, block: Element) {
  const figure = copy.querySelector('figure');
  const source = block.querySelector('figure');
  if (figure && source) {
    syncFigure(figure, source);
    syncSide(copy, block, figure);
  }
  for (const part of parts) {
    const from = block.querySelector(part);
    const to = copy.querySelector(part);
    if (!from) {
      to?.remove();
      continue;
    }
    const clone = from.cloneNode(true);
    if (to) {
      to.replaceWith(clone);
      continue;
    }
    // A part that only the new block has goes after the part before it, which is already swapped in.
    const before = from.previousElementSibling;
    const previous = before && parts.find((p) => before.matches(p));
    const anchor = previous ? copy.querySelector(previous) : null;
    if (anchor) anchor.after(clone);
    else if (from.parentElement === block) copy.append(clone);
    else if (from.parentElement?.matches('.header')) copy.querySelector('.header')?.prepend(clone);
    else copy.querySelector('pre')?.after(clone);
  }
}
