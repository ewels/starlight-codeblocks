/** Expressive Code stores the newlines of `data-code` as U+007F. */
export const decodeCode = (code = '') => code.replaceAll('\x7F', '\n');
export const encodeCode = (code: string) => code.replaceAll('\n', '\x7F');

/** The encoded text that the block's copy button copies. */
export const copiedCode = (block: Element) => block.querySelector<HTMLElement>('.copy button[data-code]')?.dataset.code;
