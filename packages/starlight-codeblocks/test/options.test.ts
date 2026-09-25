import { describe, expect, test } from 'vitest';
import { OptionsError, resolveOptions } from '../src/options.ts';

describe('resolveOptions', () => {
  test('turns every feature on with defaults when there are no options', () => {
    const options = resolveOptions();
    expect(options.focus).toEqual({ style: 'blur' });
    expect(options.callouts).toBe(true);
    expect(options.shellCopy).toEqual({ prompts: ['$ ', '> '] });
    expect(options.expandable).toEqual({ lines: 12 });
    expect(options.playgrounds).toEqual({});
    expect(options.runnable).toEqual({ runtimes: {}, timeout: 10000 });
  });

  test('keeps given values and turns features off with false', () => {
    const options = resolveOptions({ focus: { style: 'dim' }, callouts: false, playgrounds: false });
    expect(options.focus).toEqual({ style: 'dim' });
    expect(options.callouts).toBe(false);
    expect(options.playgrounds).toBe(false);
  });

  test('does not share default objects between calls', () => {
    const a = resolveOptions();
    if (a.shellCopy) a.shellCopy.prompts.push('% ');
    expect(resolveOptions().shellCopy).toEqual({ prompts: ['$ ', '> '] });
  });

  test.each([
    [{ fokus: {} }, 'unknown option `fokus`'],
    [{ focus: { style: 'fade' } }, '`focus.style` must be'],
    [{ focus: { blur: 2 } }, 'unknown option `focus.blur`'],
    [{ focus: true }, '`focus` must be `false` or an object, got true'],
    [{ callouts: {} }, '`callouts` must be `false` or left out'],
    [{ expandable: { lines: 0 } }, '`expandable.lines` must be number, got 0'],
    [{ wordDiff: { minSimilarity: 2 } }, '`wordDiff.minSimilarity`'],
    [{ lineStates: { states: { todo: { label: 'To do', colour: '#fff' } } } }, '`lineStates.states` must be'],
    [{ notation: { comments: { nextflow: '//' } } }, '`notation.comments` must be'],
    [{ playgrounds: { go: { label: 'Go' } } }, '`playgrounds.go` must be'],
    [{ runnable: { timeout: '10s' } }, '`runnable.timeout`'],
  ])('rejects %j', (options, message) => {
    expect(() => resolveOptions(options as never)).toThrow(OptionsError);
    expect(() => resolveOptions(options as never)).toThrow(message);
  });

  test('accepts a custom playground with url or post', () => {
    const url = () => 'https://example.com';
    const options = resolveOptions({ playgrounds: { demo: { label: 'Open in Demo', url } } });
    expect(options.playgrounds).toEqual({ demo: { label: 'Open in Demo', url } });
  });
});
