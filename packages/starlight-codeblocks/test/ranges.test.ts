import { expect, test } from 'vitest';
import { parseRange, RangeSyntaxError } from '../src/expressive-code/ranges.ts';

test('parses ranges, and rejects ones that are not valid', () => {
  const valid: [string, number[]][] = [
    ['3', [3]],
    ['3-5', [3, 4, 5]],
    ['{1,4-6}', [1, 4, 5, 6]],
    ['6-7, 1-3, 2', [1, 2, 3, 6, 7]],
    [' 2 - 3 ', [2, 3]],
  ];
  for (const [input, expected] of valid) expect(parseRange(input), input).toEqual(expected);
  for (const input of ['', 'a', '1,,2', '0', '5-3', '1-', '1.5', '-2']) {
    expect(() => parseRange(input), JSON.stringify(input)).toThrow(RangeSyntaxError);
  }
});
