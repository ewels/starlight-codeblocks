import { expect, test } from 'vitest';
import { OptionsError, resolveOptions } from '../src/options.ts';

test('turns every feature on with defaults, in new objects on each call', () => {
  const options = resolveOptions();
  expect(options.focus).toEqual({ style: 'blur' });
  expect(options.callouts).toBe(true);
  expect(options.shellCopy).toEqual({ prompts: ['$ ', '> '] });
  expect(options.expandable).toEqual({ lines: 12, auto: false });
  expect(options.inlineHighlighting).toEqual({ defaultLanguage: false });
  expect(options.playgrounds).toEqual({});
  expect(options.runnable).toEqual({ runtimes: {}, timeout: 10000, label: 'Run in browser', againLabel: 'Run again' });
  if (options.shellCopy) options.shellCopy.prompts.push('% ');
  expect(resolveOptions().shellCopy).toEqual({ prompts: ['$ ', '> '] });
});

test('keeps given values and turns features off with false', () => {
  const url = () => 'https://example.com';
  const options = resolveOptions({
    focus: { style: 'dim' },
    callouts: false,
    playgrounds: { demo: { label: 'Open in Demo', url } },
    runnable: false,
  });
  expect(options.focus).toEqual({ style: 'dim' });
  expect(options.callouts).toBe(false);
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
    [{ expandable: { lines: 0 } }, '`expandable.lines` must be number, got 0'],
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
    [{ apiLinks: { adapters: [{ name: 'x', languages: ['js'] }] } }, '`apiLinks.adapters`'],
  ];
  for (const [options, message] of cases) {
    const resolve = () => resolveOptions(options as never);
    expect(resolve, JSON.stringify(options)).toThrow(OptionsError);
    expect(resolve, JSON.stringify(options)).toThrow(message);
  }
});
