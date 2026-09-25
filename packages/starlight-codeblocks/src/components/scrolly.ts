import { addClassName, type Element, h, removeClassName, select, selectAll, toHtml } from '@expressive-code/core/hast';
import { fromHtml } from 'hast-util-from-html';
import { parseRange, RangeSyntaxError } from '../expressive-code/ranges.ts';

const S = 'scb-scrolly';
const OUT = 'scb-focus-out';

interface StepState {
  focus: number[];
  mark: number[];
}

function lines(value: unknown, name: string, count: number): number[] {
  if (value === undefined || value === '') return [];
  try {
    return parseRange(String(value))
      .filter((n) => n <= count)
      .map((n) => n - 1);
  } catch (error) {
    if (error instanceof RangeSyntaxError) {
      throw new Error(`<Step ${name}="${value}"> in <Scrollycoding>: ${error.reason}.`);
    }
    throw error;
  }
}

/** Sets the focus and the marks of one step on a copy of the block. */
function apply(group: Element, { focus, mark }: StepState) {
  const copy = structuredClone(group);
  selectAll('.ec-line', copy).forEach((line, i) => {
    removeClassName(line, OUT);
    if (focus.length > 0 && !focus.includes(i)) addClassName(line, OUT);
    if (mark.includes(i)) addClassName(line, 'mark');
  });
  const code = select('pre > code', copy);
  if (code && focus.length > 0) code.properties.tabindex = '0';
  return copy;
}

/**
 * Builds `<Scrollycoding>` from the block and the `<Step>` elements that Expressive Code and MDX rendered:
 * a copy of the block after each step, and one more copy for the sticky column of the wide layout.
 */
export function scrollycoding(html: string, interactive = true): string {
  const root = fromHtml(html, { fragment: true });
  const groups = selectAll('.expressive-code', root).filter((group) => select('figure', group));
  const steps = selectAll(`.${S}-step`, root);
  if (groups.length !== 1 || steps.length === 0) {
    throw new Error(
      `<Scrollycoding> needs one code block and one or more <Step> components. It has ${groups.length} code blocks and ${steps.length} steps.`,
    );
  }
  const [group] = groups;
  const count = selectAll('.ec-line', group).length;
  const states = steps.map((step) => ({
    focus: lines(step.properties.dataFocus, 'focus', count),
    mark: lines(step.properties.dataMark, 'mark', count),
  }));

  const column = steps.map((step, k) => {
    const { dataFocus, dataMark, ...properties } = step.properties;
    return h(
      'div',
      {
        ...properties,
        className: [`${S}-step`, ...(k === 0 ? [`${S}-on`] : [])],
        dataScbFocus: states[k].focus.join(','),
        dataScbMark: states[k].mark.join(','),
      },
      [h('div', { class: `${S}-text` }, step.children), apply(group, states[k])],
    );
  });
  const grid = h('div', { class: `${S}-grid` }, [h('div', { class: `${S}-steps` }, column)]);
  if (interactive) {
    const sticky = apply(group, states[0]);
    const figure = select('figure', sticky);
    if (figure) addClassName(figure, `${S}-frame`);
    const code = select('pre > code', sticky);
    if (code && states.some((state) => state.focus.length > 0)) code.properties.tabindex = '0';
    grid.children.push(h('div', { class: `${S}-code` }, [sticky]));
  }
  return toHtml(h('div', { class: S, dataScbScrolly: interactive ? '' : undefined }, [grid]));
}
