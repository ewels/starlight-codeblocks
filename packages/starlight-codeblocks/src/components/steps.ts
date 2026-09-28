import { addClassName, type Element, getClassNames, h, select, toHtml } from '@expressive-code/core/hast';
import { syncTokenKeys, toKeyedTokens } from '@shikijs/magic-move/core';
import type { KeyedTokensInfo } from '@shikijs/magic-move/types';
import { fromHtml } from 'hast-util-from-html';
import { markDecorations, nameFigure } from '../expressive-code/core.ts';
import { removeAutoExpandable } from '../expressive-code/expandable.ts';
import { stepsHead } from '../expressive-code/walkthrough.ts';
import { readTokens } from './tokens.ts';

const S = 'scb-steps';

/** A step for the browser: each token is `[key, content, style]`. */
export type StepTokens = [number, string, string][];

function navButton(go: 'prev' | 'next', disabled: boolean) {
  const text = go === 'prev' ? 'Previous' : 'Next';
  const icon = h('span', { class: `${S}-nav-icon`, ariaHidden: 'true' }, go === 'prev' ? '‹' : '›');
  const label = h('span', { class: `${S}-nav-text` }, text);
  return h('button', { type: 'button', class: `${S}-nav`, dataScbStepsGo: go, ariaLabel: text, disabled }, [
    ...(go === 'prev' ? [icon, label] : [label, icon]),
  ]);
}

/** The Previous and Next buttons and a "Step N of M" counter, in a row under the block. */
function controlsRow(current: number, total: number) {
  return h('div', { class: `${S}-controls scb-no-print` }, [
    navButton('prev', current === 0),
    h('span', { class: `${S}-count` }, `Step ${current + 1} of ${total}`),
    navButton('next', current === total - 1),
  ]);
}

/**
 * The tokens of each block, keyed so that a token in two neighbouring blocks has the same key, as JSON for
 * a `<script type="application/json">`.
 */
export function stepsData(blocks: Element[]): string {
  let previous: KeyedTokensInfo | undefined;
  const keys = new Map<string, number>();
  const steps = blocks.map((block, index) => {
    const { code, lines } = readTokens(block);
    // The salt stops a step whose code repeats an earlier step's from reusing keys that tokens carried forward.
    let info = toKeyedTokens(code, lines as never, String(index));
    if (previous) info = syncTokenKeys(previous, info).to;
    previous = info;
    return info.tokens.map((t): StepTokens[number] => {
      if (!keys.has(t.key)) keys.set(t.key, keys.size);
      return [keys.get(t.key) as number, t.content, typeof t.htmlStyle === 'string' ? t.htmlStyle : ''];
    });
  });
  return JSON.stringify(steps).replaceAll('<', '\\u003c');
}

/** The steps as separate blocks, for `<CodeWalkthrough>` with the walkthrough off. */
export function plainSteps(html: string): string {
  const root = fromHtml(html, { fragment: true });
  removeAutoExpandable(root);
  return toHtml(root);
}

/**
 * Turns the blocks that Expressive Code rendered inside `<CodeWalkthrough>` into steps: adds the numbered steps
 * to each title bar, a Previous/Next/counter row under each block, and keys the tokens for the animation.
 */
export function codeWalkthrough(html: string): string {
  const root = fromHtml(html, { fragment: true });
  removeAutoExpandable(root);
  const groups = root.children.filter(
    (node): node is Element =>
      node.type === 'element' && getClassNames(node).includes('expressive-code') && !!select('figure', node),
  );
  if (groups.length === 0) return html;
  const labels = groups.map(
    (group) =>
      select(`.${S}-label`, group)
        ?.children.map((c) => ('value' in c ? c.value : ''))
        .join('') ?? '',
  );
  const name = (i: number) => `Step ${i + 1}${labels[i] ? `: ${labels[i]}` : ''}`;

  groups.forEach((group, current) => {
    const figure = select('figure', group) as Element;
    const header = select('.header', figure);
    if (header) {
      const stepper = h(
        'span',
        { class: `${S}-stepper scb-no-print`, role: 'group', ariaLabel: 'Steps' },
        groups.flatMap((_, i) => {
          const done = i <= current ? ` ${S}-done` : '';
          const dot = h(
            'button',
            {
              type: 'button',
              class: `${S}-dot${done}`,
              dataScbStepsGo: String(i),
              ariaLabel: name(i),
              ariaCurrent: i === current ? 'step' : undefined,
            },
            String(i + 1),
          );
          return i === 0 ? [dot] : [h('span', { class: `${S}-line${done}`, ariaHidden: 'true' }), dot];
        }),
      );
      stepsHead(header).children.unshift(stepper);
      nameFigure(figure);
    }
    group.children.push(controlsRow(current, groups.length));
    if (current === 0) addClassName(group, `${S}-current`);
  });
  const data = stepsData(groups);
  markDecorations(root);
  return `<div class="${S}" data-scb-steps>${toHtml(root)}<div class="sr-only" aria-live="polite"></div><script type="application/json">${data}</script></div>`;
}
