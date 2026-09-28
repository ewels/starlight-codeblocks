import {
  addClassName,
  type Element,
  getClassNames,
  h,
  removeClassName,
  select,
  selectAll,
  toHtml,
} from '@expressive-code/core/hast';
import { fromHtml } from 'hast-util-from-html';
import { breakoutMargin, breakoutStyles, SIDE_SIZES, sideSize } from '../expressive-code/annotations.ts';
import { removeAutoExpandable } from '../expressive-code/expandable.ts';
import { parseRange, RangeSyntaxError } from '../expressive-code/ranges.ts';
import { stepsData } from './steps.ts';
import { codeLines, readTokens } from './tokens.ts';

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

/**
 * Adds `suffix` to every id in a copy of the block, and to the references to them, so that each copy's
 * controls act on that copy. A line permalink id `<block>-L<n>` becomes `<block>-<suffix>-L<n>`.
 */
function renameIds(copy: Element, suffix: string) {
  const elements = [copy, ...selectAll('*', copy)];
  const block = select('[data-scb-permalinks]', copy)?.properties.id;
  const renamed = new Map<string, string>();
  for (const { properties } of elements) {
    const id = properties.id;
    if (typeof id !== 'string') continue;
    const line = typeof block === 'string' && id.startsWith(`${block}-L`) ? id.slice(block.length) : '';
    renamed.set(id, /^-L\d+$/.test(line) ? `${block}-${suffix}${line}` : `${id}-${suffix}`);
  }
  const rename = (id: string) => renamed.get(id) ?? id;
  for (const { properties } of elements) {
    if (typeof properties.id === 'string') properties.id = rename(properties.id);
    for (const key of ['ariaControls', 'ariaDescribedBy', 'ariaLabelledBy', 'popoverTarget']) {
      const value = properties[key];
      if (value !== undefined) properties[key] = String(value).split(/\s+/).map(rename).join(' ');
    }
    if (typeof properties.href === 'string' && properties.href.startsWith('#')) {
      properties.href = `#${rename(properties.href.slice(1))}`;
    }
    if (typeof properties.style === 'string') {
      properties.style = properties.style.replace(/--([\w-]+)/g, (name, id) =>
        renamed.has(id) ? `--${rename(id)}` : name,
      );
    }
  }
}

/** Sets the focus and the marks of one step on a copy of the block. */
function apply(group: Element, { focus, mark }: StepState, suffix: string, focusable = focus.length > 0) {
  const copy = structuredClone(group);
  renameIds(copy, suffix);
  codeLines(copy).forEach((line, i) => {
    removeClassName(line, OUT);
    if (focus.length > 0 && !focus.includes(i)) addClassName(line, OUT);
    if (mark.includes(i)) addClassName(line, 'mark');
  });
  const code = select('pre > code', copy);
  if (code && focusable) {
    code.properties.tabindex = '0';
    code.properties.ariaLabel ??= 'Code block';
  }
  return copy;
}

export interface ScrollyOptions {
  /** `false` shows the narrow layout at every width, with no script. */
  interactive?: boolean;
  /** `false` changes the code of a new version without the token animation. */
  animate?: boolean;
  codeSide?: 'left' | 'right';
}

/** The longest line of the blocks, with 4 characters on the first line for the copy button. */
function longestLine(groups: Element[]) {
  return Math.max(
    ...groups.flatMap((group) =>
      readTokens(group).lines.map((tokens, i) => tokens.reduce((n, t) => n + t.content.length, i === 0 ? 4 : 0)),
    ),
  );
}

const is = (node: Element, name: string) => getClassNames(node).includes(name);

/**
 * Builds `<Scrollycoding>` from the blocks and the `<Step>` elements that Expressive Code and MDX rendered:
 * a copy of the block after each step, and a copy of each version of the block for the sticky column of
 * the wide layout. A block between steps is a new version of the code from the next step on.
 */
export function scrollycoding(html: string, { interactive = true, animate = true, codeSide }: ScrollyOptions = {}) {
  const root = fromHtml(html, { fragment: true });
  removeAutoExpandable(root);
  const items = root.children.filter(
    (node): node is Element =>
      node.type === 'element' && (is(node, `${S}-step`) || (is(node, 'expressive-code') && !!select('figure', node))),
  );
  const versions: Element[] = [];
  const steps: { step: Element; version: number }[] = [];
  for (const item of items) {
    if (is(item, `${S}-step`)) steps.push({ step: item, version: versions.length - 1 });
    else versions.push(item);
  }
  if (
    versions.length === 0 ||
    steps.length === 0 ||
    steps[0].version < 0 ||
    is(items.at(-1) as Element, 'expressive-code')
  ) {
    throw new Error(
      `<Scrollycoding> needs a code block, then one or more <Step> components. A code block between steps changes the code from the next step on. It has ${versions.length} code blocks and ${steps.length} steps${steps.length > 0 ? ', and it does not start with a code block and end with a step' : ''}.`,
    );
  }
  const states = steps.map(({ step, version }) => {
    const count = codeLines(versions[version]).length;
    return {
      focus: lines(step.properties.dataFocus, 'focus', count),
      mark: lines(step.properties.dataMark, 'mark', count),
    };
  });

  const column = steps.map(({ step, version }, k) => {
    const { dataFocus, dataMark, ...properties } = step.properties;
    return h(
      'div',
      {
        ...properties,
        className: [`${S}-step`, ...(k === 0 ? [`${S}-on`] : [])],
        dataScbFocus: states[k].focus.join(','),
        dataScbMark: states[k].mark.join(','),
        dataScbVersion: versions.length > 1 ? String(version) : undefined,
      },
      [h('div', { class: `${S}-text` }, step.children), apply(versions[version], states[k], `s${k + 1}`)],
    );
  });
  const grid = h('div', { class: `${S}-grid` }, [h('div', { class: `${S}-steps` }, column)]);
  if (interactive) {
    const focusable = states.some((state) => state.focus.length > 0);
    const sticky = versions.map((group, v) => {
      const k = steps.findIndex((step) => step.version === v);
      const copy = apply(group, states[k], versions.length > 1 ? `sticky${v + 1}` : 'sticky', focusable);
      const figure = select('figure', copy);
      if (figure) addClassName(figure, `${S}-frame`);
      if (v === 0) addClassName(copy, `${S}-current`);
      return copy;
    });
    const data = animate && versions.length > 1 ? [h('script', { type: 'application/json' }, stepsData(versions))] : [];
    grid.children.push(h('div', { class: `${S}-code` }, [...sticky, ...data]));
  }
  const className = [
    S,
    `${S}-${sideSize(longestLine(versions), 22 + 192)}`,
    ...(codeSide === 'left' ? [`${S}-code-left`] : []),
  ];
  return toHtml(h('div', { className, dataScbScrolly: interactive ? '' : undefined }, [grid]));
}

const TEXT = 'minmax(12rem, 1fr)';
const CODE = 'minmax(0, auto)';
const WIDE = SIDE_SIZES.slice(1).map((w) => `.${S}-${w}`);

const styled = new WeakSet<Request>();

/** Whether the page of `request` has no scrollycoding styles yet. */
export function firstOnPage(request: Request) {
  if (styled.has(request)) return false;
  styled.add(request);
  return true;
}

/** The styles of the two-column layout, for each width that a block can need. */
export const scrollyStyles = `
${breakoutStyles(`.${S}-grid`, `:is(${WIDE})`, `--${S}-outset`)}
@media screen and (scripting: enabled) {
${SIDE_SIZES.map((w) => {
  const on = `.${S}-${w}[data-scb-scrolly]`;
  return `@container (min-width: ${w}px) {
  ${on} .${S}-grid {
    ${breakoutMargin(`--${S}-outset`, w)}
    display: grid;
    grid-template-columns: ${TEXT} ${CODE};
    gap: 22px;
    /* Shorter than the block, so that the active step's text stays level with the block. */
    --${S}-slot: min(30vh, 0.6 * var(--${S}-height, 50vh));
  }
  ${on}.${S}-code-left .${S}-grid { grid-template-columns: ${CODE} ${TEXT}; }
  ${on}.${S}-code-left .${S}-code { order: -1; }
  ${on} .${S}-steps {
    /* So that the first and the last step can reach the middle of the block, while the block is stuck. */
    padding-block: max(0px, var(--${S}-lead, 0px) - var(--${S}-slot) / 2)
      max(0px, var(--${S}-height, 50vh) - var(--${S}-lead, 0px) - var(--${S}-slot) / 2);
  }
  ${on} .${S}-step {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: var(--${S}-slot);
    margin-top: 0;
    opacity: 0.38;
  }
  ${on} .${S}-step.${S}-on { opacity: 1; }
  ${on} .${S}-code > .expressive-code { grid-area: 1 / 1; margin: 0; }
  ${on} .${S}-step > .expressive-code { display: none; }
  ${on} .${S}-code {
    /* The versions share one cell, so the block keeps the height of the tallest one. */
    display: grid;
    position: sticky;
    top: calc(var(--sl-nav-height, 0px) + var(--sl-mobile-toc-height, 0px) + 1rem);
    align-self: start;
    margin-top: 0;
  }
}`;
}).join('\n')}
}`;
