const ON = 'scb-brackets-on';

function clear(block: HTMLElement) {
  for (const el of block.querySelectorAll(`.${ON}`)) el.classList.remove(ON);
}

function highlight(block: HTMLElement, pairId: string) {
  for (const el of block.querySelectorAll(`[data-scb-pair="${pairId}"]`)) el.classList.add(ON);
}

function outlineAtCaret() {
  clear(document.body);
  const selection = document.getSelection();
  const node = selection?.isCollapsed ? selection.anchorNode : null;
  const bracket = (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>('[data-scb-pair]');
  const block = bracket?.closest<HTMLElement>('[data-scb-brackets]');
  if (block && bracket?.dataset.scbPair) highlight(block, bracket.dataset.scbPair);
}

let listening = false;

/** Outlines the bracket pair under the pointer, or at the caret for caret browsing. Colours need no JavaScript. */
export default function initBrackets() {
  if (!listening) {
    listening = true;
    document.addEventListener('selectionchange', outlineAtCaret);
  }
  for (const block of document.querySelectorAll<HTMLElement>('[data-scb-brackets]:not([data-scb-brackets-ready])')) {
    block.dataset.scbBracketsReady = '';
    block.addEventListener('mouseover', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-scb-pair]');
      clear(block);
      if (target?.dataset.scbPair) highlight(block, target.dataset.scbPair);
    });
    block.addEventListener('mouseleave', () => clear(block));
  }
}
