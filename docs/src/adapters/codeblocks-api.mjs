/** Reference pages of the names that this package exports. */
const pages = {
  codeblocks: {
    href: '/reference/options/',
    signature: 'codeblocks(options?: CodeblocksOptions): StarlightPlugin',
    summary: 'Adds the features to the Starlight site.',
  },
  pluginCodeblocks: {
    href: '/reference/expressive-code-plugins/',
    signature: 'pluginCodeblocks(options?: CodeblocksOptions): ExpressiveCodePlugin[]',
    summary: 'Returns every feature as Expressive Code plugins.',
  },
  python: {
    href: '/features/api-auto-linking/#python-adapter',
    signature: 'python(options?: PythonAdapterOptions): ApiLinkAdapter',
    summary: 'Links Python names through the imports in each block.',
  },
  nextflow: {
    href: '/features/api-auto-linking/#nextflow-adapter',
    signature: 'nextflow(options?: NextflowAdapterOptions): ApiLinkAdapter',
    summary: 'Links Nextflow channel factories, operators and modules.',
  },
};

// Comments and strings come first, so that names inside them never match as names.
const TOKENS = /\/\/.*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*/g;
const IMPORT = /^import\s+(?:(\w+)|\{([^}]*)\})\s+from\s+'starlight-codeblocks(?:\/[\w/-]+)?';?$/gm;

/** Links the names that a JavaScript block imports from starlight-codeblocks to their reference pages. */
export function codeblocksApi() {
  return {
    name: 'codeblocks-api',
    languages: ['js', 'mjs', 'ts'],
    async setup() {},
    findSymbols(code) {
      const imported = new Set();
      for (const [, name, list] of code.matchAll(IMPORT)) {
        for (const item of name ? [name] : list.split(',')) imported.add(item.trim());
      }
      const symbols = [];
      for (const match of code.matchAll(TOKENS)) {
        if (imported.has(match[0]))
          symbols.push({ start: match.index, end: match.index + match[0].length, name: match[0] });
      }
      return symbols;
    },
    resolve(symbol) {
      const page = pages[symbol.name];
      return page ? { ...page, source: 'starlight-codeblocks reference' } : null;
    },
  };
}
