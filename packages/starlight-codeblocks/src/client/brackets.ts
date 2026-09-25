const ON = 'scb-brackets-on';

function clear(block: HTMLElement) {
  for (const el of block.querySelectorAll(`.${ON}`)) el.classList.remove(ON);
}

function highlight(block: HTMLElement, pairId: string) {
  for (const el of block.querySelectorAll(`[data-scb-pair="${pairId}"]`)) el.classList.add(ON);
}

/** Outlines a hovered bracket and its partner. Colours alone need no JavaScript (SPEC 6.11). */
export default function initBrackets() {
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
