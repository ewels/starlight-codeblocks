const ON = 'scb-brackets-on';

/** Outlines the pair of `el`, if it is a bracket, in its own block, which can be a copy of a block. */
function outline(el: Element | null | undefined) {
  for (const on of document.querySelectorAll(`.${ON}`)) on.classList.remove(ON);
  const bracket = el?.closest<HTMLElement>('[data-scb-pair]');
  const block = bracket?.closest('[data-scb-brackets]');
  if (!block || !bracket?.dataset.scbPair) return;
  for (const pair of block.querySelectorAll(`[data-scb-pair="${bracket.dataset.scbPair}"]`)) pair.classList.add(ON);
}

function outlineAtCaret() {
  const selection = document.getSelection();
  const node = selection?.isCollapsed ? selection.anchorNode : null;
  outline(node instanceof Element ? node : node?.parentElement);
}

let listening = false;

/** Outlines the bracket pair under the pointer, or at the caret for caret browsing. Colours need no JavaScript. */
export default function initBrackets() {
  if (listening) return;
  listening = true;
  document.addEventListener('selectionchange', outlineAtCaret);
  document.addEventListener('mouseover', (event) => outline(event.target as Element));
  document.addEventListener('mouseout', (event) => event.relatedTarget || outline(null));
}
