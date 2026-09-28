/** The index after the string whose opening `quote` ends before `i`. An unclosed one-line string ends at the line. */
export function stringEnd(code: string, i: number, quote: string) {
  while (i < code.length && !code.startsWith(quote, i)) {
    if (code[i] === '\\') i++;
    else if (quote.length === 1 && code[i] === '\n') return i;
    i++;
  }
  return Math.min(i + quote.length, code.length);
}

/** The index after the brackets that open at `tokens[i]`. */
export function skipBrackets(tokens: { value: string }[], i: number) {
  let depth = 0;
  for (; i < tokens.length; i++) {
    const value = tokens[i]?.value;
    if (value === '(' || value === '[' || value === '{') depth++;
    if (value === ')' || value === ']' || value === '}') depth--;
    if (depth === 0) return i + 1;
  }
  return i;
}
