import { expect, test } from 'vitest';
import { parseRange, RangeSyntaxError } from '../src/expressive-code/ranges.ts';

test.each([
  ['3', [3]],
  ['3-5', [3, 4, 5]],
  ['1, 4-6', [1, 4, 5, 6]],
  ['{1,4-6}', [1, 4, 5, 6]],
  ['6-7, 1-3, 2', [1, 2, 3, 6, 7]],
  [' 2 - 3 ', [2, 3]],
])('parses %s', (input, expected) => {
  expect(parseRange(input)).toEqual(expected);
});

test.each(['', 'a', '1,,2', '0', '5-3', '1-', '1.5', '-2'])('rejects %j', (input) => {
  expect(() => parseRange(input)).toThrow(RangeSyntaxError);
});
