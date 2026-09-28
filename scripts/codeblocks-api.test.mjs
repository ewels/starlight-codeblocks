import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeblocksApi } from '../docs/src/adapters/codeblocks-api.mjs';

test('links imported names, not object keys or properties with the same name', () => {
  const code =
    "import { python } from 'starlight-codeblocks/adapters/python';\nconst adapters = { python: python() };\nadapters.python;";
  const starts = codeblocksApi()
    .findSymbols(code)
    .map((symbol) => symbol.start);
  assert.deepEqual(starts, [code.indexOf('python'), code.indexOf('python()')]);
});
