import { expect, test } from 'vitest';
import { type NextflowAdapterOptions, nextflow } from '../src/adapters/nextflow.ts';
import { factories, operators } from '../src/adapters/nextflow-reference.ts';
import { render } from './render.ts';

const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');
const withNextflow = (options: NextflowAdapterOptions = {}) => ({ apiLinks: { adapters: [nextflow(options)] } });

const decode = (value?: string) =>
  value?.replace(/&#x([0-9A-F]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));

function links(html: string) {
  return [...html.matchAll(/<a class="scb-api-link" ((?:[^>"]|"[^"]*")*)>(.*?)<\/a>/g)].map(
    ([, attributes = '', inner = '']) => {
      const attribute = (name: string) => decode(attributes.match(new RegExp(`${name}="([^"]*)"`))?.[1]);
      return {
        text: inner.replace(/<[^>]+>/g, ''),
        href: attribute('href'),
        head: attribute('data-scb-api-head'),
        summary: attribute('data-scb-api-summary'),
        source: attribute('data-scb-api-source'),
      };
    },
  );
}
const texts = async (lines: string[], options?: NextflowAdapterOptions) =>
  links((await render(block('nextflow', ...lines), withNextflow(options))).html).map((l) => l.text);

const modules = ({ name }: { name: string }) => `/reference/modules/${name.toLowerCase()}/`;

test('links channel factories, operators on channels and included processes', async () => {
  const { html, copyText, warnings } = await render(
    block(
      'nextflow',
      "include { FASTQC } from './modules/fastqc'",
      '',
      'workflow {',
      '    reads = channel.fromFilePairs(params.reads)',
      '    FASTQC(reads)',
      '}',
    ),
    withNextflow({ modules }),
  );
  expect(links(html)).toEqual([
    { text: 'FASTQC', href: '/reference/modules/fastqc/', head: 'FASTQC', source: 'Module reference' },
    {
      text: 'channel.fromFilePairs',
      href: 'https://docs.seqera.io/nextflow/reference/stdlib-namespaces/channel#fromfilepairs',
      head: 'channel.fromFilePairs(pattern: String, [opts]) -> Channel<?>',
      summary: 'Creates a channel that emits the file pairs that match a glob pattern, grouped by their shared prefix.',
      source: 'Nextflow reference',
    },
    { text: 'FASTQC', href: '/reference/modules/fastqc/', head: 'FASTQC', source: 'Module reference' },
  ]);
  expect(copyText).toContain("include { FASTQC } from './modules/fastqc'");
  expect(warnings).toEqual([]);
});

test('links operators in a chain after a factory, across lines', async () => {
  const lines = ['channel', '    .of(1, 2, 3)', '    .map { v -> v * v }', '    .filter { it > 1 }', '    .view()'];
  const { html } = await render(block('nextflow', ...lines), withNextflow());
  expect(links(html)).toEqual([
    expect.objectContaining({ text: 'of', head: 'channel.of(values...: E) -> Channel<E>' }),
    {
      text: 'map',
      href: 'https://docs.seqera.io/nextflow/reference/operator#map',
      head: 'operator map',
      summary: 'Applies a mapping function to each item. Returns a channel.',
      source: 'Nextflow reference',
    },
    expect.objectContaining({ text: 'filter', href: 'https://docs.seqera.io/nextflow/reference/operator#filter' }),
    expect.objectContaining({ text: 'view' }),
  ]);
});

test('links operators on variables that only ever hold a channel', async () => {
  expect(await texts(['ch = Channel.of(1)', 'ch.map { it }.collect()'])).toEqual(['Channel.of', 'map', 'collect']);
  expect(await texts(['channel.of(1).set { nums }', 'nums.view()'])).toEqual(['channel.of', 'set', 'view']);
  expect(await texts(['ch = channel.of(1)', 'ch = [1, 2]', 'ch.collect()'])).toEqual(['channel.of']);
  expect(await texts(['list = [1, 2]', 'list.collect { it * 2 }'])).toEqual([]);
});

test('stops a chain at a name that is not an operator', async () => {
  expect(await texts(['channel.of(1).map { it }.foo().view()'])).toEqual(['channel.of', 'map']);
});

test('follows aliases in include, and leaves modules plain without the modules option', async () => {
  const lines = ["include { FASTQC as QC; MULTIQC } from '../modules/qc'", 'QC(reads)', 'MULTIQC.out.report'];
  const seen: unknown[] = [];
  const names = await texts(lines, {
    modules: (input) => {
      seen.push(input);
      return input.name === 'FASTQC' ? { href: '/m/fastqc/', kind: 'process', summary: 'Runs FastQC.' } : undefined;
    },
  });
  expect(names).toEqual(['FASTQC', 'QC']);
  expect(seen).toEqual([
    { name: 'FASTQC', path: '../modules/qc' },
    { name: 'MULTIQC', path: '../modules/qc' },
  ]);
  const { html } = await render(block('nextflow', ...lines), withNextflow({ modules: () => '/m/' }));
  expect(links(html).map((l) => l.head)).toEqual(['FASTQC', 'MULTIQC', 'FASTQC', 'MULTIQC']);
  expect(await texts(lines)).toEqual([]);
});

test('uses the kind and summary that the modules option gives', async () => {
  const { html } = await render(
    block('nextflow', "include { FASTQC } from './fastqc'"),
    withNextflow({ modules: () => ({ href: '/m/', kind: 'process', summary: 'Runs FastQC.', source: 'nf-core' }) }),
  );
  expect(links(html)).toEqual([
    { text: 'FASTQC', href: '/m/', head: 'process FASTQC', summary: 'Runs FastQC.', source: 'nf-core' },
  ]);
});

test('never links names in strings or comments', async () => {
  const lines = [
    '// channel.of(1)',
    '/* channel.of(1) */',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
    'println "channel.of(1) ${channel.of(2)}"',
    "x = 'channel.of'",
    'y = """',
    'channel.of(3)',
    '"""',
  ];
  expect(await texts(lines)).toEqual([]);
});

test('runs for nextflow and nf blocks only', async () => {
  const nf = await render(block('nf', 'channel.of(1)'), withNextflow());
  const groovy = await render(block('groovy', 'channel.of(1)'), withNextflow());
  expect(links(nf.html)).toHaveLength(1);
  expect(links(groovy.html)).toHaveLength(0);
});

test('the bundled map has every channel factory and operator of the reference', () => {
  expect(Object.keys(factories)).toEqual([
    'empty',
    'fromFilePairs',
    'fromLineage',
    'fromList',
    'fromPath',
    'fromSRA',
    'of',
    'topic',
    'value',
    'watchPath',
  ]);
  expect(Object.keys(operators)).toHaveLength(47);
});

test('does not treat Object.prototype names as factories or operators', async () => {
  expect(await texts(['ch = channel.of(1)', 'ch.toString()', 'channel.constructor', 'ch.hasOwnProperty("a")'])).toEqual(
    ['channel.of'],
  );
});
