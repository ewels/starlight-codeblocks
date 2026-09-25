// Unit tests must not reach the network. Tests that need a response stub `fetch` themselves.
globalThis.fetch = async (input) => {
  throw new Error(`no network in unit tests: ${String(input)}`);
};
