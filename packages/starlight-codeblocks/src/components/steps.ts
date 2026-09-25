import { type Element, h, select, selectAll, toHtml } from '@expressive-code/core/hast';
import { syncTokenKeys, toKeyedTokens } from '@shikijs/magic-move/core';
import type { KeyedTokensInfo } from '@shikijs/magic-move/types';
import { fromHtml } from 'hast-util-from-html';
import { readTokens } from './tokens.ts';

const S = 'scb-steps';

/** A step for the browser: each token is `[key, content, style]`. */
export type StepTokens = [number, string, string][];

function navButton(go: 'prev' | 'next', disabled: boolean) {
  const text = go === 'prev' ? 'Previous' : 'Next';
  return h('button', { type: 'button', class: `scb-btn ${S}-nav`, dataScbStepsGo: go, ariaLabel: text, disabled }, [
    h('span', { class: `${S}-nav-text` }, text),
    h('span', { class: `${S}-nav-icon`, ariaHidden: 'true' }, go === 'prev' ? '‹' : '›'),
  ]);
}

/**
 * Turns the blocks that Expressive Code rendered inside `<CodeSteps>` into steps: adds the numbered steps
 * and the Previous and Next buttons to each title bar, and keys the tokens of every step for the animation.
 */
export function codeSteps(html: string): string {
  const root = fromHtml(html, { fragment: true });
  const groups = selectAll('.expressive-code', root).filter((group) => select('figure', group));
  if (groups.length === 0) return html;
  const labels = groups.map(
    (group) =>
      select(`.${S}-label`, group)
        ?.children.map((c) => ('value' in c ? c.value : ''))
        .join('') ?? '',
  );
  const name = (i: number) => `Step ${i + 1}${labels[i] ? `: ${labels[i]}` : ''}`;

  let previous: KeyedTokensInfo | undefined;
  const keys = new Map<string, number>();
  const steps = groups.map((group, current) => {
    const figure = select('figure', group) as Element;
    const header = select('.header', figure);
    if (header) {
      let head = select(`.${S}-head`, header);
      if (!head) {
        head = h('span', { class: `${S}-head` });
        const title = select('.title', header);
        header.children.splice(title ? header.children.indexOf(title) + 1 : 0, 0, head);
      }
      const stepper = h(
        'span',
        { class: `${S}-stepper`, role: 'group', ariaLabel: 'Steps' },
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
      head.children.unshift(stepper);
      let tools = select('.scb-tools', header);
      if (!tools) {
        tools = h('span', { class: 'scb-tools' });
        header.children.push(tools);
      }
      tools.children.push(navButton('prev', current === 0), navButton('next', current === groups.length - 1));
    }
    if (current === 0)
      group.properties.className = [...((group.properties.className as string[]) ?? []), `${S}-current`];

    const { code, lines } = readTokens(figure);
    let info = toKeyedTokens(code, lines as never);
    if (previous) info = syncTokenKeys(previous, info).to;
    previous = info;
    return info.tokens.map((t): StepTokens[number] => {
      if (!keys.has(t.key)) keys.set(t.key, keys.size);
      return [keys.get(t.key) as number, t.content, typeof t.htmlStyle === 'string' ? t.htmlStyle : ''];
    });
  });

  const data = JSON.stringify(steps).replaceAll('<', '\\u003c');
  return `<div class="${S}" data-scb-steps>${toHtml(root)}<div class="sr-only" aria-live="polite"></div><script type="application/json">${data}</script></div>`;
}
