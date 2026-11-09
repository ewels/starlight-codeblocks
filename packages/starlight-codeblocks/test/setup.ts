import { readFileSync } from 'node:fs';

const stdlib = readFileSync(new URL('./fixtures/python-stdlib.inv', import.meta.url));
const nextflow = readFileSync(new URL('./fixtures/nextflow-api-index.json', import.meta.url));

// Unit tests must not reach the network. The Python adapter gets a small copy of the standard library
// inventory, and the Nextflow adapter a copy of the language server's API index; tests that need other
// responses stub `fetch` themselves.
globalThis.fetch = async (input) => {
  if (String(input) === 'https://docs.python.org/3/objects.inv') return new Response(stdlib);
  if (String(input) === 'https://github.com/nextflow-io/language-server/releases/latest/download/api-index.json') {
    return new Response(nextflow);
  }
  throw new Error(`no network in unit tests: ${String(input)}`);
};
