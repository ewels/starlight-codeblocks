/** Channel factories and operators from the Nextflow reference. Anchors checked against the live pages, September 2026. */
const CHANNEL = 'https://docs.seqera.io/nextflow/reference/stdlib-namespaces/channel';
const OPERATOR = 'https://docs.seqera.io/nextflow/reference/operator';

export const SOURCE = 'Nextflow reference';

export const factories: Record<string, { signature: string; summary: string }> = {
  empty: { signature: 'channel.empty() -> Channel<?>', summary: 'Creates a channel that emits nothing.' },
  fromFilePairs: {
    signature: 'channel.fromFilePairs(pattern: String, [opts]) -> Channel<?>',
    summary: 'Creates a channel that emits the file pairs that match a glob pattern, grouped by their shared prefix.',
  },
  fromLineage: {
    signature: 'channel.fromLineage([opts]) -> Channel<Path>',
    summary: 'Creates a channel that emits the files in the lineage store that match the given parameters.',
  },
  fromList: {
    signature: 'channel.fromList(values: Iterable<E>) -> Channel<E>',
    summary: 'Creates a channel that emits each element of a collection.',
  },
  fromPath: {
    signature: 'channel.fromPath(pattern: String, [opts]) -> Channel<Path>',
    summary: 'Creates a channel that emits the paths that match a name or a glob pattern.',
  },
  fromSRA: {
    signature: 'channel.fromSRA(ids: String | List<String>, [opts]) -> Channel<?>',
    summary: 'Creates a channel that emits the FASTQ files of NCBI SRA projects or accession numbers. Deprecated.',
  },
  of: { signature: 'channel.of(values...: E) -> Channel<E>', summary: 'Creates a channel that emits each argument.' },
  topic: {
    signature: 'channel.topic(name: String) -> Channel<?>',
    summary: 'Gets the topic channel with the given name.',
  },
  value: {
    signature: 'channel.value(value: V) -> Value<V>',
    summary: 'Creates a dataflow value bound to the given argument.',
  },
  watchPath: {
    signature: "channel.watchPath(pattern: String, events: String = 'create') -> Channel<Path>",
    summary: 'Creates a channel that watches a glob pattern and emits the matching files as they appear.',
  },
};

// Operator name: what it does, then what it returns.
export const operators: Record<string, [string, string]> = {
  branch: ['Sends each item to one of several output channels, based on conditions.', 'multiple channels'],
  buffer: ['Collects items into subsets and emits each subset.', 'a queue channel'],
  collate: ['Collects items into groups of N items.', 'a channel'],
  collect: ['Collects all items into a list and emits it as one item.', 'a dataflow value'],
  collectFile: ['Saves the items to one or more files, and emits the files.', 'a channel'],
  combine: ['Emits every combination of the items of two channels, or of a channel and a list.', 'a channel'],
  concat: ['Emits the items of two or more channels, one channel after another.', 'a channel'],
  count: ['Counts the items and emits the number.', 'a dataflow value'],
  countFasta: ['Counts the records in a channel of FASTA files.', 'a dataflow value'],
  countFastq: ['Counts the records in a channel of FASTQ files.', 'a dataflow value'],
  countJson: ['Counts the records in a channel of JSON files.', 'a dataflow value'],
  countLines: ['Counts the lines in a channel of text files.', 'a dataflow value'],
  cross: ['Emits every pair of items from two channels that have a matching key.', 'a channel'],
  distinct: ['Removes items that repeat the item before them.', 'a channel'],
  dump: ['Prints each item when the pipeline runs with the `-dump-channels` option.', 'a channel'],
  filter: ['Emits the items that satisfy a condition.', 'a channel'],
  first: ['Emits the first item, or the first item that matches a condition.', 'a dataflow value'],
  flatMap: ['Applies a mapping function to each item, and emits each element of a returned list.', 'a channel'],
  flatten: ['Emits each element of each list or collection separately.', 'a channel'],
  groupTuple: ['Collects tuples into groups by a key, and emits one tuple for each key.', 'a queue channel'],
  ifEmpty: ['Emits the items, or a default value if the channel is empty.', 'a channel'],
  join: ['Joins the items of two channels that have a matching key.', 'a channel'],
  last: ['Emits the last item.', 'a dataflow value'],
  map: ['Applies a mapping function to each item.', 'a channel'],
  max: ['Emits the item with the greatest value.', 'a dataflow value'],
  merge: ['Joins the items of two or more channels by their order.', 'a channel'],
  min: ['Emits the item with the lowest value.', 'a dataflow value'],
  mix: ['Emits the items of two or more channels in one channel.', 'a channel'],
  multiMap: ['Applies several mapping functions, with one output channel for each.', 'multiple channels'],
  randomSample: ['Emits a random subset of the items.', 'a channel'],
  reduce: ['Applies an accumulator function to each item, and emits the final value.', 'a dataflow value'],
  set: ['Assigns the channel to a variable.', 'nothing'],
  splitCsv: ['Splits CSV files or text into records.', 'a channel'],
  splitFasta: ['Splits FASTA files or text into sequences.', 'a channel'],
  splitFastq: ['Splits FASTQ files or text into sequences.', 'a channel'],
  splitJson: ['Splits JSON files or text into records.', 'a channel'],
  splitText: ['Splits text into chunks of N lines.', 'a channel'],
  subscribe: ['Calls a function for each item.', 'nothing'],
  sum: ['Emits the sum of all items.', 'a dataflow value'],
  take: ['Emits the first N items.', 'a channel'],
  tap: ['Assigns the channel to a variable, and emits the items.', 'a channel'],
  toList: ['Collects all items into a list and emits it as one item.', 'a dataflow value'],
  toSortedList: ['Collects all items into a sorted list and emits it as one item.', 'a dataflow value'],
  transpose: ['Flattens the lists in each tuple, and emits each nested item separately.', 'a channel'],
  unique: ['Emits the unique items.', 'a channel'],
  until: ['Emits items until a condition is true.', 'a channel'],
  view: ['Prints each item to standard output.', 'a channel'],
};

export const factoryHref = (name: string) => `${CHANNEL}#${name.toLowerCase()}`;
export const operatorHref = (name: string) => `${OPERATOR}#${name.toLowerCase()}`;
