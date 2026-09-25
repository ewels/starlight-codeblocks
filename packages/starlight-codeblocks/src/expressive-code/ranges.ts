const ITEM = /^(\d+)(?:\s*-\s*(\d+))?$/;

/**
 * Parses range syntax such as `3`, `3-5` or `1, 4-6` (with or without braces) into sorted,
 * unique, 1-based line numbers. Throws a `RangeSyntaxError` for anything else.
 */
export function parseRange(input: string): number[] {
  const body = input.trim().replace(/^\{([\s\S]*)\}$/, '$1');
  const numbers = new Set<number>();
  for (const item of body.split(',')) {
    const match = item.trim().match(ITEM);
    if (!match) throw new RangeSyntaxError(input, `"${item.trim()}" is not a line number or a range such as 4-6`);
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (start < 1) throw new RangeSyntaxError(input, 'line numbers start at 1');
    if (end < start) throw new RangeSyntaxError(input, `${start}-${end} ends before it starts`);
    for (let n = start; n <= end; n++) numbers.add(n);
  }
  return [...numbers].sort((a, b) => a - b);
}

export class RangeSyntaxError extends Error {
  constructor(
    readonly input: string,
    readonly reason: string,
  ) {
    super(`Invalid range {${input}}: ${reason}.`);
  }
}
