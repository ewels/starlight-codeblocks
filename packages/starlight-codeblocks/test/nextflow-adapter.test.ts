import { expect, test } from 'vitest';
import { type NextflowAdapterOptions, nextflow } from '../src/adapters/nextflow.ts';
import { factories, operators } from '../src/adapters/nextflow-reference.ts';
import { directives, globals, namespaces, scopes } from '../src/adapters/nextflow-reference-data.ts';
import { block, apiLinks as links, render } from './render.ts';

const withNextflow = (options: NextflowAdapterOptions = {}) => ({ apiLinks: { adapters: [nextflow(options)] } });

const texts = async (lines: string[], options?: NextflowAdapterOptions) =>
  links((await render(block('nextflow', ...lines), withNextflow(options))).html).map((l) => l.text);

const NF = 'https://docs.seqera.io/nextflow/';
const SOURCE = 'Nextflow reference';
/** Each link as its text and its URL after the Nextflow docs base. */
const targets = async (fence: string, lines: string[]) =>
  links((await render(block(fence, ...lines), withNextflow())).html).map((l) => `${l.text} ${l.href?.replace(NF, '')}`);

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
    withNextflow({ modules: ({ name }) => `/reference/modules/${name.toLowerCase()}/` }),
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
    expect.objectContaining({ text: 'params' }),
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

test('links operators only on channels, and never in strings, comments or Object.prototype names', async () => {
  const cases: [string[], string[]][] = [
    [
      ['ch = Channel.of(1)', 'ch.map { it }.collect()'],
      ['Channel.of', 'map', 'collect'],
    ],
    [
      ['channel.of(1).set { nums }', 'nums.view()'],
      ['channel.of', 'set', 'view'],
    ],
    [['ch = channel.of(1)', 'ch = [1, 2]', 'ch.collect()'], ['channel.of']],
    [['list = [1, 2]', 'list.collect { it * 2 }'], []],
    [['channel.of(1).map { it }.foo().view()'], ['channel.of', 'map']],
    [
      ["channel.of('a').map { it.split('(') }.view()", 'channel.of(1).view()'],
      ['channel.of', 'map', 'view', 'channel.of', 'view'],
    ],
    [
      [
        '// channel.of(1)',
        '/* channel.of(1) */',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
        'println "channel.of(1) ${channel.of(2)}"',
        "x = 'channel.of'",
        'y = """',
        'channel.of(3)',
        '"""',
      ],
      ['println'],
    ],
    [['ch = channel.of(1)', 'ch.toString()', 'channel.constructor', 'ch.hasOwnProperty("a")'], ['channel.of']],
  ];
  for (const [lines, expected] of cases) expect(await texts(lines), lines.join('\n')).toEqual(expected);
});

test('follows aliases in include, uses what the modules option gives, and leaves modules plain without it', async () => {
  const lines = ["include { FASTQC as QC; MULTIQC } from '../modules/qc'", 'QC(reads)', 'MULTIQC.out.report'];
  const seen: unknown[] = [];
  const { html } = await render(
    block('nextflow', ...lines),
    withNextflow({
      modules: (input) => {
        seen.push(input);
        return input.name === 'FASTQC'
          ? { href: '/m/fastqc/', kind: 'process', summary: 'Runs FastQC.', source: 'nf-core' }
          : undefined;
      },
    }),
  );
  expect(links(html)[0]).toEqual({
    text: 'FASTQC',
    href: '/m/fastqc/',
    head: 'process FASTQC',
    summary: 'Runs FastQC.',
    source: 'nf-core',
  });
  expect(links(html).map((l) => l.text)).toEqual(['FASTQC', 'QC']);
  expect(seen).toEqual([
    { name: 'FASTQC', path: '../modules/qc' },
    { name: 'MULTIQC', path: '../modules/qc' },
  ]);
  const plain = await render(block('nextflow', ...lines), withNextflow({ modules: () => '/m/' }));
  expect(links(plain.html).map((l) => l.head)).toEqual(['FASTQC', 'MULTIQC', 'FASTQC', 'MULTIQC']);
  expect(await texts(lines)).toEqual([]);
});

test('runs for nextflow and nf blocks only', async () => {
  expect(links((await render(block('nf', 'channel.of(1)'), withNextflow())).html)).toHaveLength(1);
  expect(links((await render(block('groovy', 'channel.of(1)'), withNextflow())).html)).toHaveLength(0);
});

const sayHello = [
  'process sayHello {',
  "    publishDir 'results', mode: 'copy'",
  '    cpus 2',
  '',
  '    input:',
  '    val greeting',
  '',
  '    output:',
  "    path 'output.txt'",
  '',
  '    script:',
  '    """',
  "    echo '$greeting' > output.txt",
  '    """',
  '}',
  '',
  'workflow {',
  "    greetings = channel.of('Hello', 'Bonjour').view()",
  '    sayHello(greetings)',
  '}',
];

test('links the directives and the input and output labels of a process', async () => {
  const { html, copyText, warnings } = await render(block('nextflow', ...sayHello), withNextflow());
  expect(links(html)).toEqual([
    {
      text: 'publishDir',
      href: `${NF}reference/process/directives/publish-dir`,
      head: 'process directive publishDir',
      summary: 'Publishes matching process output files to a target directory.',
      source: SOURCE,
    },
    expect.objectContaining({ text: 'cpus', href: `${NF}reference/process/directives/cpus` }),
    {
      text: 'input',
      href: `${NF}reference/process/inputs-outputs#inputs`,
      head: 'process section input',
      summary: 'Declares the inputs of the process.',
      source: SOURCE,
    },
    expect.objectContaining({ text: 'output', href: `${NF}reference/process/inputs-outputs#outputs` }),
    expect.objectContaining({ text: 'channel.of' }),
    expect.objectContaining({ text: 'view' }),
  ]);
  expect(copyText).toBe(sayHello.join('\n'));
  expect(warnings).toEqual([]);
});

test('links a directive only at the start of a statement, before the first label of a process body', async () => {
  const lines = [
    'process align {',
    '    // cpus 2',
    "    memory = '2 GB'",
    '    publishDir params.outdir,',
    "        mode: 'copy'",
    '',
    '    input:',
    '    val sample',
    '',
    '    exec:',
    '    cpus = 4',
    "    tag 'done'",
    '}',
    '',
    'workflow {',
    '    cpus = 4',
    '    memory 2.GB',
    '}',
  ];
  expect(await texts(lines)).toEqual(['publishDir', 'params', 'input']);
  expect(await texts(['process align {', '    cpus 2', '    debug'])).toEqual(['cpus', 'debug']);
});

test('links the input and output labels only in a legacy process, and no other label', async () => {
  const typed = ['process greet {', '    input:', '    greeting: String', '', '    output:', '    stdout()'];
  expect(await texts([...typed, '', '    script:', '    "echo $greeting"', '}'])).toEqual([]);
  const legacy = ['process greet {', '    input:', '    tuple val(id), path(reads)', '    output:', '    stdout'];
  expect(await texts([...legacy, '    exec:', '    println id', '    stub:', '    ""', '}'])).toEqual([
    'input',
    'output',
    'println',
  ]);
  const bracketed = ['process greet {', '    input:', "    path('reads.fq')", '    script:', '    ""', '}'];
  expect(await texts(bracketed)).toEqual(['input']);
});

test('links config scopes and process directives in a config block', async () => {
  const config = ['docker.enabled = true', '', 'process {', "    memory = '2 GB'", '}'];
  const expected = [
    'docker reference/config/docker',
    'process config#process-configuration',
    'memory reference/process/directives/memory',
  ];
  expect(await targets('nextflow title="nextflow.config"', config)).toEqual(expected);
  expect(await targets('nf title="conf/base.config"', config)).toEqual(expected);
  expect(await targets('nextflow nextflow="config"', config)).toEqual(expected);
  expect(await targets('nextflow', config)).toEqual([]);
  expect(await targets('nextflow title="main.nf"', config)).toEqual([]);
  expect(await targets('nextflow nextflow="config"', ["process.memory = '2 GB'"])).toEqual(expected.slice(1));
  expect(await targets('nextflow nextflow="config"', ["trace.sep = ','", 'docker.enabled = true'])).toEqual([
    'trace reference/config/trace',
    'docker reference/config/docker',
  ]);
  const { html } = await render(block('nextflow nextflow="config"', 'docker.enabled = true'), withNextflow());
  expect(links(html)).toEqual([
    {
      text: 'docker',
      href: `${NF}reference/config/docker`,
      head: 'config scope docker',
      summary: 'Controls how Docker containers are executed by Nextflow.',
      source: SOURCE,
    },
  ]);
});

test('links a config scope only at the start of a setting, and a directive only in the process scope', async () => {
  const lines = [
    'profiles {',
    '    docker {',
    '        docker.enabled = true',
    '    }',
    '}',
    'nextflow.enable.moduleBinaries = true',
    'params {',
    '    docker = true',
    '    cpus = 4',
    '}',
    'executor.queueSize = 10',
    "env.GREETING = 'Hello'",
    'report.enabled = docker.enabled',
    'process {',
    "    executor = 'slurm'",
    '    withLabel: big_mem {',
    '        cpus = 16',
    '    }',
    '    memory = { 2.GB * task.attempt }',
    "    ext.args = '--fast'",
    '}',
    "workDir = 'work'",
  ];
  expect(await targets('nextflow title="nextflow.config"', lines)).toEqual([
    'profiles config#config-profiles',
    'docker reference/config/docker',
    'params config#parameters',
    'executor reference/config/executor',
    'env reference/config/env',
    'report reference/config/report',
    'process config#process-configuration',
    'executor reference/process/directives/executor',
    'cpus reference/process/directives/cpus',
    'memory reference/process/directives/memory',
    'ext reference/process/directives/ext',
  ]);
});

test('links params and profiles in a config block, also in a profile body, but not in strings or map keys', async () => {
  const lines = [
    "params.input = 'samples.csv'",
    'params {',
    "    outdir = 'results'",
    '}',
    'profiles {',
    '    test {',
    "        params.input = 'test/samples.csv'",
    '        process.cpus = 2',
    '    }',
    '}',
    "docker.runOptions = 'params { }'",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
    'docker.registry = "${params.registry}"',
    'env.OPTIONS = [',
    "    params: 'none',",
    ']',
  ];
  expect(await targets('nextflow title="nextflow.config"', lines)).toEqual([
    'params config#parameters',
    'params config#parameters',
    'profiles config#config-profiles',
    'params config#parameters',
    'process config#process-configuration',
    'cpus reference/process/directives/cpus',
    'docker reference/config/docker',
    'docker reference/config/docker',
    'env reference/config/env',
  ]);
  const { html } = await render(block('nextflow title="nextflow.config"', 'params {', '}'), withNextflow());
  expect(links(html)).toEqual([
    {
      text: 'params',
      href: `${NF}config#parameters`,
      head: 'config scope params',
      summary: 'Defines pipeline parameters.',
      source: SOURCE,
    },
  ]);
  expect(await targets('nextflow', ["params.input = 'samples.csv'"])).toEqual([
    'params reference/stdlib-namespaces/global',
  ]);
});

test('links the global names and the workflow, log and nextflow namespaces', async () => {
  const lines = [
    "reads = channel.fromPath(params.reads).map { tuple(it.simpleName, file('ref.fa')) }",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
    'log.info "Project: ${workflow.projectDir}"',
    'println workflow.runName',
    "error 'No reads'",
    'println nextflow.version',
    'workflow.onComplete {',
    "    println 'Done'",
    '}',
  ];
  expect(await targets('nextflow', lines)).toEqual([
    'channel.fromPath reference/stdlib-namespaces/channel#frompath',
    'params reference/stdlib-namespaces/global',
    'map reference/operator#map',
    'tuple reference/stdlib-namespaces/global',
    'file reference/stdlib-namespaces/global',
    'log.info reference/stdlib-namespaces/log',
    'println reference/stdlib-namespaces/global',
    'workflow.runName reference/stdlib-namespaces/workflow',
    'error reference/stdlib-namespaces/global',
    'println reference/stdlib-namespaces/global',
    'nextflow.version reference/stdlib-namespaces/nextflow',
    'workflow.onComplete reference/stdlib-namespaces/workflow',
    'println reference/stdlib-namespaces/global',
  ]);
  const { html } = await render(block('nextflow', "ref = file('ref.fa')", 'println workflow.runName'), withNextflow());
  expect(links(html)).toEqual([
    {
      text: 'file',
      href: `${NF}reference/stdlib-namespaces/global`,
      head: 'file(filePattern: String, [options]) -> Path | List<Path>',
      summary: 'Gets a file from a file name or glob pattern.',
      source: SOURCE,
    },
    expect.objectContaining({ text: 'println' }),
    {
      text: 'workflow.runName',
      href: `${NF}reference/stdlib-namespaces/workflow`,
      head: 'workflow.runName: String',
      summary: 'Mnemonic name assigned to this execution instance.',
      source: SOURCE,
    },
  ]);
});

test('leaves a global name plain where the block binds it, where it is a map key, and in declarations', async () => {
  const declarations = ['input:', 'tuple val(id), path(reads)', "env 'GREETING'", 'output:', "file('out.txt')"];
  const cases: [string[], string[]][] = [
    [["def file = 'data.csv'", "println file('a.txt')"], ['println']],
    [['channel.of(1).map { file -> file }'], ['channel.of', 'map']],
    [['channel.of(1).map { id, Path file -> file }'], ['channel.of', 'map']],
    [['def stage(projectDir) { projectDir }', 'for (workDir in dirs) { workDir }'], []],
    [['def stage(dir = params.outdir) { dir }'], ['params']],
    [
      ["println '{'", "def sep = ','", "println ':'"],
      ['println', 'println'],
    ],
    [["projectDir = '/data'", 'launchDir = projectDir'], []],
    [["meta = [params: 1, projectDir: 'a']", "copy(file: 'a.txt')"], []],
    [['params {', '    input: Path', '}'], []],
    [['record Sample {', '    id: String', '}'], []],
    [[...declarations, 'script:', 'file(id)'], ['file']],
    [['x.log.info "a"', 'log.debug "b"', 'nextflow.enable.dsl = 2', 'workflow {', '}'], []],
    [['log.constructor', 'workflow.hasOwnProperty("a")', 'constructor()', 'toString()'], []],
  ];
  for (const [lines, expected] of cases) expect(await texts(lines), lines.join('\n')).toEqual(expected);
  expect(await targets('nextflow title="tests/main.nf.test"', ['assert workflow.success'])).toEqual([]);
});

test('warns for a nextflow attribute that is not config, and links the block as a script', async () => {
  const { html, warnings } = await render(block('nextflow nextflow="conf"', 'docker.enabled = true'), withNextflow());
  expect(links(html)).toEqual([]);
  expect(warnings).toEqual([expect.stringContaining('nextflow="conf"')]);
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
  expect(Object.keys(directives)).toHaveLength(41);
  expect(Object.keys(scopes)).toHaveLength(35);
  expect(Object.keys(globals)).toHaveLength(22);
  expect(Object.keys(namespaces)).toEqual(['log', 'nextflow', 'workflow']);
});
