import { expect, test } from 'vitest';
import { type NextflowAdapterOptions, nextflow, nextflowIndex } from '../src/adapters/nextflow.ts';
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
    expect.objectContaining({ text: 'include', href: `${NF}reference/syntax#include` }),
    { text: 'FASTQC', href: '/reference/modules/fastqc/', head: 'FASTQC', source: 'Module reference' },
    expect.objectContaining({ text: 'workflow' }),
    {
      text: 'channel.fromFilePairs',
      href: 'https://docs.seqera.io/nextflow/reference/stdlib-namespaces/channel#fromfilepairs',
      head: 'channel.fromFilePairs(opts: Map<String, ?>, pattern: String, grouping: Closure) -> Channel<?>',
      summary: 'Create a channel that emits all file pairs matching a glob pattern.',
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
      head: 'Channel.map(transform: Function<E, R>) -> Channel<R>',
      summary: 'The `map` operator applies a mapping function to each value from a source channel.',
      source: 'Nextflow reference',
    },
    expect.objectContaining({ text: 'filter', href: 'https://docs.seqera.io/nextflow/reference/operator#filter' }),
    expect.objectContaining({ text: 'view' }),
  ]);
});

test('links operators only on channels, and never in comments, plain strings or Object.prototype names', async () => {
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
    [['list = load()', 'list.collect { it * 2 }'], []],
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
      ['println', 'channel.of'],
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
  expect(links(html)[1]).toEqual({
    text: 'FASTQC',
    href: '/m/fastqc/',
    head: 'process FASTQC',
    summary: 'Runs FastQC.',
    source: 'nf-core',
  });
  expect(links(html).map((l) => l.text)).toEqual(['include', 'FASTQC', 'QC']);
  expect(seen).toEqual([
    { name: 'FASTQC', path: '../modules/qc' },
    { name: 'MULTIQC', path: '../modules/qc' },
  ]);
  const plain = await render(block('nextflow', ...lines), withNextflow({ modules: () => '/m/' }));
  expect(links(plain.html).map((l) => l.head)).toEqual(['keyword include', 'FASTQC', 'MULTIQC', 'FASTQC', 'MULTIQC']);
  expect(await texts(lines)).toEqual(['include']);
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

test('links the keyword, directives, labels and qualifiers of a process', async () => {
  const { html, copyText, warnings } = await render(block('nextflow', ...sayHello), withNextflow());
  expect(links(html)).toEqual([
    {
      text: 'process',
      href: `${NF}reference/syntax#process`,
      head: 'keyword process',
      summary: 'Defines a process, which runs a task for each set of inputs.',
      source: SOURCE,
    },
    {
      text: 'publishDir',
      href: `${NF}reference/process/directives/publish-dir`,
      head: 'process directive publishDir',
      summary: 'The `publishDir` directive allows you to publish the process output files to a directory.',
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
    {
      text: 'val',
      href: `${NF}reference/process/inputs-outputs#inputs`,
      head: 'val(arg)',
      summary: 'Declare a variable input.',
      source: SOURCE,
    },
    expect.objectContaining({ text: 'output', href: `${NF}reference/process/inputs-outputs#outputs` }),
    expect.objectContaining({ text: 'path', head: 'path(arg)' }),
    {
      text: 'script',
      href: `${NF}process#script`,
      head: 'process section script',
      summary: 'Defines the script that each task runs.',
      source: SOURCE,
    },
    expect.objectContaining({ text: 'workflow', href: `${NF}reference/syntax#workflow` }),
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
  expect(await texts(lines)).toEqual(['process', 'publishDir', 'params', 'input', 'val', 'exec', 'workflow']);
  expect(await texts(['process align {', '    cpus 2', '    debug'])).toEqual(['process', 'cpus', 'debug']);
});

test('links the labels and declarations of a legacy process to the legacy reference, and of a typed one to the typed', async () => {
  const typed = ['process greet {', '    input:', '    greeting: String', '', '    output:', '    stdout()'];
  expect(await targets('nextflow', [...typed, '', '    script:', '    "echo $greeting"', '}'])).toEqual([
    'process reference/syntax#process',
    'input process-typed#inputs',
    'output process-typed#outputs',
    'stdout reference/process/inputs-outputs-typed#outputs',
    'script process#script',
  ]);
  const legacy = ['process greet {', '    input:', '    tuple val(id), path(reads)', '    output:', '    stdout'];
  expect(await texts([...legacy, '    exec:', '    println id', '    stub:', '    ""', '}'])).toEqual([
    'process',
    'input',
    'tuple',
    'val',
    'path',
    'output',
    'stdout',
    'exec',
    'println',
    'stub',
  ]);
  const bracketed = ['process greet {', '    input:', "    path('reads.fq')", '    script:', '    ""', '}'];
  expect(await texts(bracketed)).toEqual(['process', 'input', 'path', 'script']);
});

test('links qualifiers, output options and typed functions, also in a block with only part of a process', async () => {
  const legacy = [
    'input:',
    '    tuple val(meta), path(reads, stageAs: "in/*")',
    '    each mode',
    'output:',
    "    tuple val(meta), path('*.bam'), emit: bam, optional: true",
    "    val 'done', topic: versions",
  ];
  expect(await targets('nextflow', legacy)).toEqual([
    'tuple reference/process/inputs-outputs#inputs',
    'val reference/process/inputs-outputs#inputs',
    'path reference/process/inputs-outputs#inputs',
    'each reference/process/inputs-outputs#inputs',
    'tuple reference/process/inputs-outputs#outputs',
    'val reference/process/inputs-outputs#outputs',
    'path reference/process/inputs-outputs#outputs',
    'emit reference/process/inputs-outputs#generic-options',
    'optional reference/process/inputs-outputs#generic-options',
    'val reference/process/inputs-outputs#outputs',
    'topic reference/process/inputs-outputs#generic-options',
  ]);
  const typed = [
    'stage:',
    "    stageAs fasta, 'ref.fa'",
    'output:',
    "    record(id: id, stats: file('*.stats', optional: true))",
    'topic:',
    "    eval('samtools version') >> 'versions'",
  ];
  expect(await targets('nextflow', typed)).toEqual([
    'stageAs reference/process/inputs-outputs-typed#stage-directives',
    'record reference/stdlib-namespaces/global',
    'file reference/process/inputs-outputs-typed#outputs',
    'eval reference/process/inputs-outputs-typed#outputs',
  ]);
});

test('links the keywords that start a declaration and the labels of a workflow', async () => {
  const lines = [
    'nextflow.enable.types = true',
    "include { greet } from './greet'",
    'params {',
    '    input: Path',
    '}',
    'enum Day { MONDAY, TUESDAY }',
    'record Sample {',
    '    id: String',
    '}',
    'workflow hello {',
    '    take:',
    '    names: Channel<String>',
    '    main:',
    '    greetings = greet(names)',
    '    emit:',
    '    greetings',
    '}',
    'workflow {',
    '    main:',
    '    hello(channel.of(params.input))',
    '    publish:',
    '    greetings = hello.out',
    '    onComplete:',
    "    log.info 'Done'",
    '}',
    'output {',
    "    greetings { path 'greetings' }",
    '}',
  ];
  expect(await targets('nextflow', lines)).toEqual([
    'nextflow.enable.types reference/feature-flags#nextflowenabletypes',
    'include reference/syntax#include',
    'params reference/syntax#params-block',
    'enum reference/syntax#enum-type',
    'record reference/syntax#record-type',
    'workflow reference/syntax#workflow',
    'take workflow#takes-and-emits',
    'main reference/syntax#workflow',
    'emit workflow#takes-and-emits',
    'workflow reference/syntax#workflow',
    'main reference/syntax#workflow',
    'channel.of reference/stdlib-namespaces/channel#of',
    'params reference/stdlib-namespaces/global',
    'publish reference/syntax#workflow',
    'onComplete reference/syntax#workflow',
    'log.info reference/stdlib-namespaces/log',
    'output reference/syntax#output-block',
  ]);
  expect(await texts(['def process = 1', 'workflow.onComplete { }', 'output: x', 'record(id: 1)'])).toEqual([
    'workflow.onComplete',
    'record',
  ]);
});

test('reads an interpolation that spans lines as code, so a process does not end inside a string', async () => {
  const lines = [
    'process STATS {',
    `    container "\${workflow.containerEngine == 'singularity'`,
    "        ? 'https://example.com/samtools.sif'",
    `        : 'quay.io/biocontainers/samtools'}"`,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
    '    ext args: { "--threads ${task.cpus}" }',
    '    input:',
    '    path bam',
    '}',
  ];
  expect(await targets('nextflow', lines)).toEqual([
    'process reference/syntax#process',
    'container reference/process/directives/container',
    'workflow.containerEngine reference/stdlib-namespaces/workflow',
    'ext reference/process/directives/ext',
    'task.cpus reference/process/directives/cpus',
    'input reference/process/inputs-outputs#inputs',
    'path reference/process/inputs-outputs#inputs',
  ]);
});

test('links names in the interpolations of double-quoted strings only', async () => {
  const lines = [
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
    'println "${projectDir}/data $workflow.runName \\$HOME"',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
    "println '${projectDir} $launchDir'",
    '"""',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
    'echo ${task.attempt} "$moduleDir" \\${workDir}',
    '"""',
  ];
  expect(await targets('nextflow', lines)).toEqual([
    'println reference/stdlib-namespaces/global',
    'projectDir reference/stdlib-namespaces/global',
    'workflow.runName reference/stdlib-namespaces/workflow',
    'println reference/stdlib-namespaces/global',
    'task.attempt reference/process/task-properties#taskattempt',
    'moduleDir reference/stdlib-namespaces/global',
  ]);
});

test('links task properties and directive values', async () => {
  const { html } = await render(block('nextflow', 'memory { 2.GB * task.attempt }', 'cpus task.cpus'), withNextflow());
  expect(links(html)).toEqual([
    {
      text: 'task.attempt',
      href: `${NF}reference/process/task-properties#taskattempt`,
      head: 'task.attempt: Integer',
      summary: 'The current task attempt.',
      source: SOURCE,
    },
    {
      text: 'task.cpus',
      href: `${NF}reference/process/directives/cpus`,
      head: 'task.cpus: Integer',
      summary: 'The `cpus` directive allows you to define the number of (logical) CPUs required by each task.',
      source: SOURCE,
    },
  ]);
  expect(await texts(['x.task.cpus', 'task.unknown', 'task'])).toEqual([]);
});

test('links members of a value whose type the block shows, and follows the type that each member gives', async () => {
  const heads = async (lines: string[]) =>
    links((await render(block('nextflow', ...lines), withNextflow())).html).map((l) => l.head);
  const FILE = 'file(opts: Map<String, ?>, filePattern: String) -> Path';
  const cases: [string[], string[]][] = [
    [
      ['def ref: Path = load()', 'println ref.name.toUpperCase()'],
      ['println(value)', 'Path.name: String', 'String.toUpperCase() -> String'],
    ],
    [
      ["ref = file('ref.fa')", 'ref.text.readLines().size()'],
      [FILE, 'Path.text: String', 'String.readLines() -> List<String>', 'Iterable.size() -> Integer'],
    ],
    [['workflow.projectDir.resolve("assets")'], ['workflow.projectDir: Path', 'Path.resolve(other: String) -> Path']],
    [
      ["names = ['a', 'b']", "names.join(',')", 'sizes = [a: 1]', 'sizes.keySet()'],
      ['Iterable.join(separator: String) -> String', 'Map.keySet() -> Set<K>'],
    ],
    [["name = 'x'", "name = file('a')", 'name.size()'], [FILE]],
    [
      ["ref = file('a')", 'channel.of(1).map { ref -> ref.name }'],
      [FILE, 'channel.of(values...: E) -> Channel<E>', 'Channel.map(transform: Function<E, R>) -> Channel<R>'],
    ],
    [
      ["n = file('a').size() > 0", 'n.toString()'],
      [FILE, 'Path.size() -> Integer'],
    ],
  ];
  for (const [lines, expected] of cases) expect(await heads(lines), lines.join('\n')).toEqual(expected);
  const { html } = await render(block('nextflow', "file('ref.fa').baseName"), withNextflow());
  expect(links(html)[1]).toEqual({
    text: 'baseName',
    href: `${NF}reference/stdlib-types/path`,
    head: 'Path.baseName: String',
    summary: 'Gets the file name without its extension, e.g. `/some/path/file.tar.gz` -> `file.tar`.',
    source: SOURCE,
  });
});

test('links the types of typed process inputs, legacy path inputs and typed workflow inputs', async () => {
  const lines = [
    'process align {',
    '    input:',
    '    record(id: String, reads: Path)',
    '    script:',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
    '    "echo ${id.toUpperCase()} $reads.simpleName"',
    '}',
    'process sort {',
    '    input:',
    '    tuple val(meta), path(bam)',
    '    script:',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Nextflow string interpolation, not JavaScript.
    '    "samtools sort ${bam.baseName} ${meta.id}"',
    '}',
    'workflow run {',
    '    take:',
    '    samples: Channel<Sample>',
    '    main:',
    '    samples.view()',
    '}',
  ];
  expect(await texts(lines)).toEqual([
    'process',
    'input',
    'record',
    'script',
    'toUpperCase',
    'simpleName',
    'process',
    'input',
    'tuple',
    'val',
    'path',
    'script',
    'baseName',
    'workflow',
    'take',
    'main',
    'view',
  ]);
});

test('links operators on the outputs of processes and workflows', async () => {
  const lines = [
    "include { FASTQC } from './fastqc'",
    'process ALIGN {',
    '    script:',
    "    ''",
    '}',
    'workflow {',
    '    reads = load()',
    '    bams = ALIGN(reads)',
    '    bams.view()',
    '    FASTQC(reads)',
    '    FASTQC.out.html.collect().view()',
    '    ALIGN.out.map { it }',
    '}',
  ];
  expect((await texts(lines)).filter((text) => !['include', 'process', 'script', 'workflow'].includes(text))).toEqual([
    'view',
    'collect',
    'view',
    'map',
  ]);
});

test('links config settings, scopes and process directives in a config block', async () => {
  const config = ['docker.enabled = true', '', 'process {', "    memory = '2 GB'", '}'];
  const expected = [
    'docker.enabled reference/config/docker#dockerenabled',
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
    'trace.sep reference/config/trace#tracesep',
    'docker.enabled reference/config/docker#dockerenabled',
  ]);
  const { html } = await render(
    block('nextflow nextflow="config"', 'docker.enabled = true', 'docker {'),
    withNextflow(),
  );
  expect(links(html)).toEqual([
    {
      text: 'docker.enabled',
      href: `${NF}reference/config/docker#dockerenabled`,
      head: 'config setting docker.enabled',
      summary: 'Enable Docker execution (default: `false`).',
      source: SOURCE,
    },
    {
      text: 'docker',
      href: `${NF}reference/config/docker`,
      head: 'config scope docker',
      summary: 'The `docker` scope controls how Docker containers are executed by Nextflow.',
      source: SOURCE,
    },
  ]);
});

test('links a setting or scope only at the start of a setting, and a directive only in the process scope', async () => {
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
    'docker.enabled reference/config/docker#dockerenabled',
    'nextflow.enable.moduleBinaries reference/feature-flags#nextflowenablemodulebinaries',
    'params config#parameters',
    'executor.queueSize reference/config/executor#executorqueuesize',
    'env reference/config/env',
    'report.enabled reference/config/report#reportenabled',
    'process config#process-configuration',
    'executor reference/process/directives/executor',
    'cpus reference/process/directives/cpus',
    'memory reference/process/directives/memory',
    'task.attempt reference/process/task-properties#taskattempt',
    'ext reference/process/directives/ext',
    'workDir reference/config/unscoped#workdir',
  ]);
});

test('links the settings in a scope block, also in a nested group, and leaves unknown settings plain', async () => {
  const lines = [
    'aws {',
    "    region = 'eu-west-1'",
    '    batch {',
    '        maxParallelTransfers = 4',
    "        cliPath = '/usr/bin/aws'",
    '    }',
    '}',
    'singularity {',
    '    enabled = true',
    '    unknownSetting = 1',
    '}',
    "aws.batch.cliPath = '/usr/bin/aws'",
    'docker.unknownSetting = 1',
  ];
  expect(await targets('nextflow title="nextflow.config"', lines)).toEqual([
    'aws reference/config/aws',
    'region reference/config/aws#awsregion',
    'maxParallelTransfers reference/config/aws#awsbatchmaxparalleltransfers',
    'cliPath reference/config/aws#awsbatchclipath',
    'singularity reference/config/singularity',
    'enabled reference/config/singularity#singularityenabled',
    'aws.batch.cliPath reference/config/aws#awsbatchclipath',
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
    'docker.runOptions reference/config/docker#dockerrunoptions',
    'docker.registry reference/config/docker#dockerregistry',
    'env reference/config/env',
  ]);
  const { html } = await render(block('nextflow title="nextflow.config"', 'params {', '}'), withNextflow());
  expect(links(html)).toEqual([
    {
      text: 'params',
      href: `${NF}config#parameters`,
      head: 'config scope params',
      summary: 'The `params` scope allows you to define parameters that will be accessible in the pipeline script.',
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
    'workflow.projectDir reference/stdlib-namespaces/workflow',
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
      head: 'file(opts: Map<String, ?>, filePattern: String) -> Path',
      summary: 'Get a file from a file name or glob pattern.',
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
    [['params {', '    input: Path', '}'], ['params']],
    [['record Sample {', '    id: String', '}'], ['record']],
    [
      ['x.log.info "a"', 'log.debug "b"', 'nextflow.enable.dsl = 2', 'workflow {', '}'],
      ['nextflow.enable.dsl', 'workflow'],
    ],
    [['log.constructor', 'workflow.hasOwnProperty("a")', 'constructor()', 'toString()'], []],
  ];
  for (const [lines, expected] of cases) expect(await texts(lines), lines.join('\n')).toEqual(expected);
  expect(await targets('nextflow', [...declarations, 'script:', 'file(id)'])).toEqual([
    'tuple reference/process/inputs-outputs#inputs',
    'val reference/process/inputs-outputs#inputs',
    'path reference/process/inputs-outputs#inputs',
    'env reference/process/inputs-outputs#inputs',
    'file reference/process/inputs-outputs-typed#outputs',
    'file reference/stdlib-namespaces/global',
  ]);
  expect(await targets('nextflow title="tests/main.nf.test"', ['assert workflow.success'])).toEqual([]);
});

test('warns for a nextflow attribute that is not config, and links the block as a script', async () => {
  const { html, warnings } = await render(block('nextflow nextflow="conf"', 'docker.enabled = true'), withNextflow());
  expect(links(html)).toEqual([]);
  expect(warnings).toEqual([expect.stringContaining('nextflow="conf"')]);
});

test('reads the API index of the latest language server release, of a pinned one, or another one', async () => {
  expect(nextflowIndex()).toBe(
    'https://github.com/nextflow-io/language-server/releases/latest/download/api-index.json',
  );
  expect(nextflowIndex('26.10.1')).toBe(
    'https://github.com/nextflow-io/language-server/releases/download/v26.10.1/api-index.json',
  );
  const index = {
    apiIndex: 1 as const,
    base: 'https://example.org/docs/',
    symbols: [{ name: 'cpus', kind: 'process directive', context: 'process', href: 'cpus' }],
  };
  const { html } = await render(block('nextflow', 'process A {', '    cpus 2', '}'), withNextflow({ index }));
  expect(links(html).map((l) => [l.text, l.href, l.source])).toEqual([
    ['cpus', 'https://example.org/docs/cpus', SOURCE],
  ]);
});

test('links only modules, with a warning, when the API index does not load', async () => {
  const { html, warnings } = await render(
    block('nextflow', "include { FASTQC } from './fastqc'", 'channel.of(1)'),
    withNextflow({ version: '0.0.0', modules: () => '/m/' }),
  );
  expect(links(html).map((l) => l.text)).toEqual(['FASTQC']);
  expect(warnings).toEqual([
    expect.stringContaining('could not fetch https://github.com/nextflow-io/language-server/releases/download/v0.0.0/'),
  ]);
});
