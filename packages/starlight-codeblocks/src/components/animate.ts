import { MagicMoveRenderer } from '@shikijs/magic-move/renderer';
import type { KeyedTokensInfo } from '@shikijs/magic-move/types';
import type { StepTokens } from './steps.ts';

const S = 'scb-steps';
const DELAY_ENTER = 0.7;

const lines = (tokens: StepTokens) =>
  tokens
    .map(([, content]) => content)
    .join('')
    .split('\n');

/** The indexes of the lines of `to` that are not in `from`, leaving out blank lines. */
function newLines(from: StepTokens, to: StepTokens) {
  const left = new Map<string, number>();
  for (const line of lines(from)) left.set(line, (left.get(line) ?? 0) + 1);
  return lines(to).flatMap((line, i) => {
    const n = left.get(line) ?? 0;
    left.set(line, n - 1);
    return n > 0 || !line.trim() ? [] : [i];
  });
}

/** Animates the tokens from one step to the next inside the `pre` of the new step, then shows its real code again. */
export function animate(group: HTMLElement, from: StepTokens, to: StepTokens) {
  const pre = group.querySelector('pre');
  const code = pre?.querySelector('code');
  if (!pre || !code) return () => {};
  const style = getComputedStyle(group.querySelector('figure') ?? group);
  const i = style.getPropertyValue('--ec-codeblocksTransitions-themeIndex').trim() || '0';
  const duration = Number.parseFloat(style.getPropertyValue('--ec-codeblocksTransitions-duration')) || 480;
  // New tokens enter at this point of the move, so the tint of a new line starts there too.
  const enter = duration * DELAY_ENTER;
  // Expressive Code picks the token colour of the theme with a selector that needs `.ec-line`, so each token names its own.
  const theme = `;color:var(--${i},inherit);font-style:var(--${i}fs,inherit);font-weight:var(--${i}fw,inherit)`;
  const info = (tokens: StepTokens) =>
    ({
      tokens: tokens.map(([key, content, htmlStyle]) => ({
        key: String(key),
        content,
        offset: 0,
        htmlStyle: htmlStyle + theme,
      })),
    }) as unknown as KeyedTokensInfo;

  const box = document.createElement('div');
  box.className = `${S}-anim`;
  box.setAttribute('aria-hidden', 'true');
  const move = document.createElement('div');
  move.className = `${S}-move`;
  const added = newLines(from, to);
  // magic-move replaces the children of its container, so the tints sit next to it.
  box.append(
    move,
    ...added.map((n) => {
      const tint = document.createElement('div');
      tint.className = `${S}-new`;
      tint.style.setProperty('--scb-steps-line', String(n));
      tint.style.animationDelay = `${enter}ms`;
      return tint;
    }),
  );
  code.style.display = 'none';
  pre.append(box);
  const start = performance.now();
  let finished = false;
  const done = (ended = false) => {
    if (finished) return;
    finished = true;
    box.remove();
    code.style.display = '';
    if (!ended) return;
    // The real lines take over the tint where the animation left it.
    const real = [...code.querySelectorAll<HTMLElement>('.ec-line')].filter(
      (l) => !l.parentElement?.matches('summary'),
    );
    for (const n of added) {
      const line = real[n];
      if (!line) continue;
      line.style.animationDelay = `${start + enter - performance.now()}ms`;
      line.classList.add(`${S}-new`);
      const clear = () => {
        line.classList.remove(`${S}-new`);
        line.style.animationDelay = '';
      };
      // Hiding the step cancels the animation, which would otherwise play again when the step shows.
      line.addEventListener('animationend', clear, { once: true });
      line.addEventListener('animationcancel', clear, { once: true });
    }
  };
  const renderer = new MagicMoveRenderer(move, {
    duration,
    delayEnter: DELAY_ENTER,
    easing: 'cubic-bezier(.2, .7, .2, 1)',
    containerStyle: false,
    animateContainer: false,
  });
  renderer.render(info(from));
  renderer.render(info(to)).then(() => done(true));
  return () => done();
}
