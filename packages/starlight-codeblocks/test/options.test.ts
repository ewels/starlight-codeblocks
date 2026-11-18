import { expect, test } from 'vitest';
import type { CodeblocksPlugin } from '../src/expressive-code/core.ts';
import { createPlugins } from '../src/expressive-code/index.ts';
import { type FeatureName, OptionsError, optionsReference, resolveOptions } from '../src/options.ts';
import { mdastPlugins } from '../src/satteri/index.ts';

test('turns every feature on with defaults, in new objects on each call', () => {
  const options = resolveOptions();
  expect(options.focus).toEqual({ style: 'blur' });
  expect(options.callouts).toBe(true);
  expect(options.squiggles).toBe(true);
  expect(options.splitDiff).toEqual({ view: 'unified', switch: true, sync: true });
  expect(options.annotations).toEqual({ style: 'filled' });
  expect(options.footnotes).toEqual({ sticky: false, style: 'outline' });
  expect(options.shellCopy).toEqual({ prompts: ['$ ', '> '] });
  expect(options.expandable).toEqual({ lines: 12, auto: false });
  expect(options.skippedCode).toEqual({ commentAliases: { '*': ['...'] }, bareAliases: { json: ['...'] } });
  expect(options.inlineHighlighting).toEqual({ defaultLanguage: false });
  expect(options.playgrounds).toEqual({});
  expect(options.walkthrough).toEqual({ start: 1 });
  expect(options.runnable).toEqual({
    runtimes: {},
    timeout: 10000,
    label: undefined,
    againLabel: undefined,
    button: 'below',
    outputDelay: 200,
    outputLabel: false,
  });
  if (options.shellCopy) options.shellCopy.prompts.push('% ');
  expect(resolveOptions().shellCopy).toEqual({ prompts: ['$ ', '> '] });
});

test('keeps given values and turns features off with false', () => {
  const url = () => 'https://example.com';
  const options = resolveOptions({
    focus: { style: 'dim' },
    callouts: false,
    annotations: { style: 'outline' },
    playgrounds: { demo: { label: 'Open in Demo', url } },
    runnable: false,
    walkthrough: { start: 'last' },
  });
  expect(options.focus).toEqual({ style: 'dim' });
  expect(options.walkthrough).toEqual({ start: 'last' });
  expect(options.callouts).toBe(false);
  expect(options.annotations).toEqual({ style: 'outline' });
  expect(options.playgrounds).toEqual({ demo: { label: 'Open in Demo', url } });
  expect(options.runnable).toBe(false);
});

test('rejects options that are not valid, with an OptionsError that names the option', () => {
  const colour = { dark: '#fff', light: '#000' };
  const cases: [unknown, string][] = [
    [{ fokus: {} }, 'unknown option `fokus`'],
    [{ focus: { style: 'fade' } }, '`focus.style` must be'],
    [{ focus: { blur: 2 } }, 'unknown option `focus.blur`'],
    [{ focus: true }, '`focus` must be `false` or an object, got true'],
    [{ callouts: {} }, '`callouts` must be `false` or left out'],
    [{ squiggles: true }, '`squiggles` must be `false` or left out'],
    [{ splitDiff: { view: 'side' } }, '`splitDiff.view` must be'],
    [{ splitDiff: { sync: 'yes' } }, '`splitDiff.sync` must be'],
    [{ annotations: { style: 'solid' } }, '`annotations.style` must be'],
    [{ footnotes: { style: 'solid' } }, '`footnotes.style` must be'],
    [{ expandable: { lines: 0 } }, '`expandable.lines` must be number, got 0'],
    [{ skippedCode: { aliases: ['...'] } }, 'unknown option `skippedCode.aliases`'],
    [{ skippedCode: { commentAliases: { '*': [' '] } } }, '`skippedCode.commentAliases` must be'],
    [{ skippedCode: { bareAliases: { json: '...' } } }, '`skippedCode.bareAliases` must be'],
    [{ wordDiff: { minSimilarity: 2 } }, '`wordDiff.minSimilarity`'],
    [{ lineStates: { states: { todo: { label: 'To do', colour: '#fff' } } } }, '`lineStates.states` must be'],
    [{ lineStates: { states: { focus: { label: 'F', colour } } } }, '`lineStates.states`'],
    [{ lineStates: { states: { prefix: { label: 'P', colour } } } }, '`lineStates.states`'],
    [{ lineStates: { states: { 'To do': { label: 'F', colour } } } }, '`lineStates.states`'],
    [{ notation: { comments: { nextflow: '//' } } }, '`notation.comments` must be'],
    [{ playgrounds: { go: { label: 'Go' } } }, '`playgrounds.go` must be'],
    [{ runnable: { timeout: '10s' } }, '`runnable.timeout`'],
    [{ runnable: { timeout: Infinity } }, '`runnable.timeout`'],
    [{ runnable: { timeout: 2 ** 31 } }, '`runnable.timeout`'],
    [{ runnable: { label: ' ' } }, '`runnable.label`'],
    [{ runnable: { againLabel: 3 } }, '`runnable.againLabel`'],
    [{ runnable: { button: 'top' } }, '`runnable.button`'],
    [{ runnable: { outputDelay: -1 } }, '`runnable.outputDelay`'],
    [{ runnable: { outputLabel: 'yes' } }, '`runnable.outputLabel`'],
    [{ apiLinks: { adapters: [{ name: 'x', languages: ['js'] }] } }, '`apiLinks.adapters`'],
    [{ walkthrough: { start: 2 } }, "`walkthrough.start` must be 1 | 'last', got 2"],
    [{ walkthrough: { start: 'first' } }, '`walkthrough.start` must be'],
    [{ only: 'focus' }, '`only` must be a list of option keys'],
    [{ only: ['fokus'] }, '`only` must be a list of option keys'],
    [{ only: ['focus'], codeTabs: {} }, '`codeTabs` has settings, but it is not in `only`'],
  ];
  for (const [options, message] of cases) {
    const resolve = () => resolveOptions(options as never);
    expect(resolve, JSON.stringify(options)).toThrow(OptionsError);
    expect(resolve, JSON.stringify(options)).toThrow(message);
  }
});

test('only turns on the listed features, and notation with a feature that reads directives', () => {
  const options = resolveOptions({ only: ['focus', 'codeTabs'], focus: { style: 'dim' }, callouts: false });
  const on = Object.entries(options).filter(([, value]) => value !== false);
  expect(on.map(([key]) => key).sort()).toEqual(['codeTabs', 'focus', 'notation']);
  expect(options.focus).toEqual({ style: 'dim' });
  expect(resolveOptions({ only: ['brackets'] }).notation).toBe(false);
  expect(resolveOptions({ only: ['focus'], notation: false }).notation).toBe(false);
  expect(resolveOptions({ only: ['focus'], notation: { comments: { matlab: ['%'] } } }).notation).toEqual({
    comments: { matlab: ['%'] },
  });
  const names = (list: unknown[]) =>
    list.map((plugin) => (plugin as { name: string }).name.replace('starlight-codeblocks:', ''));
  expect(names(createPlugins(options))).toEqual(['core', 'notation', 'focus', 'code-tabs', 'walkthrough']);
  expect(names(mdastPlugins(options))).toEqual(['code-tabs']);
});

test('directives marks each feature whose plugin reads directives', () => {
  const key = (name: string) =>
    name.replace('starlight-codeblocks:', '').replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
  const reading = createPlugins(resolveOptions())
    .filter((plugin) => Object.keys((plugin as CodeblocksPlugin).directives ?? {}).length > 0)
    .map((plugin) => key(plugin.name))
    .filter((name) => name !== 'notation');
  const marked = (Object.keys(optionsReference) as FeatureName[]).filter((name) => optionsReference[name].directives);
  expect(reading.sort()).toEqual(marked.sort());
});
