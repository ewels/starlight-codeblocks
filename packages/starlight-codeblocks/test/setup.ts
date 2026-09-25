import { readFileSync } from 'node:fs';

const stdlib = readFileSync(new URL('./fixtures/python-stdlib.inv', import.meta.url));

// Unit tests must not reach the network. The Python adapter gets a small copy of the standard library
// inventory; tests that need other responses stub `fetch` themselves.
globalThis.fetch = async (input) => {
  if (String(input) === 'https://docs.python.org/3/objects.inv') return new Response(stdlib);
  throw new Error(`no network in unit tests: ${String(input)}`);
};
