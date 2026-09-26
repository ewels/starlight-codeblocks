/**
 * Turns a copy of a block, as full screen plugins show, into a copy of `block`: swaps in its title, controls,
 * code and copy button, and keeps what other plugins added to the copy.
 */
export function swapInto(copy: Element, block: Element) {
  for (const part of ['.header .title', '.scb-steps-head', '.scb-tools', 'pre', '.copy']) {
    const from = block.querySelector(part);
    if (from) copy.querySelector(part)?.replaceWith(from.cloneNode(true));
  }
}
