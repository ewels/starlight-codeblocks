/** Expressive Code stores the newlines of `data-code` as U+007F. */
export const decodeCode = (code = '') => code.replaceAll('\x7F', '\n');
export const encodeCode = (code: string) => code.replaceAll('\n', '\x7F');

/**
 * The encoded text that the block's copy button copies: the commands of a shell session, or the code
 * on the figure when a site turns the copy button off.
 */
export const copiedCode = (block: Element) =>
  (
    block.querySelector<HTMLElement>('.scb-shell-copy[data-code]') ??
    block.querySelector<HTMLElement>('.copy button[data-code]')
  )?.dataset.code ?? block.closest<HTMLElement>('[data-scb-code]')?.dataset.scbCode;

/** Copies `text`, with the `execCommand` fallback that Expressive Code's copy button has for pages without the Clipboard API. */
export async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const pre = document.createElement('pre');
    pre.style.cssText = 'position:absolute;top:0;left:0;opacity:0;pointer-events:none;user-select:all';
    pre.ariaHidden = 'true';
    pre.textContent = text;
    document.body.append(pre);
    const selection = getSelection();
    selection?.selectAllChildren(pre);
    try {
      return !!selection && document.execCommand('copy');
    } finally {
      selection?.removeAllRanges();
      pre.remove();
    }
  }
}
