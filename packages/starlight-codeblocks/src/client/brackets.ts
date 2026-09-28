const ON = 'scb-brackets-on';

let lit: Element[] = [];

/** Outlines the pair of `el`, if it is a bracket, in its own block, which can be a copy of a block. */
function outline(el: Element | null | undefined) {
  const bracket = el?.closest<HTMLElement>('[data-scb-pair]');
  if (bracket ? lit.includes(bracket) : !lit.length) return;
  const block = bracket?.closest('[data-scb-brackets]');
  const pair =
    block && bracket?.dataset.scbPair
      ? [...block.querySelectorAll(`[data-scb-pair="${bracket.dataset.scbPair}"]`)]
      : [];
  for (const on of lit) on.classList.remove(ON);
  for (const on of pair) on.classList.add(ON);
  lit = pair;
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
