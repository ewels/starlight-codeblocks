import { MagicMoveRenderer } from '@shikijs/magic-move/renderer';
import type { KeyedTokensInfo } from '@shikijs/magic-move/types';
import type { StepTokens } from './steps.ts';

const S = 'scb-steps';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

/** Animates the tokens from one step to the next inside the `pre` of the new step, then shows its real code again. */
function animate(group: HTMLElement, from: StepTokens, to: StepTokens) {
  const pre = group.querySelector('pre');
  const code = pre?.querySelector('code');
  if (!pre || !code) return () => {};
  const style = getComputedStyle(group.querySelector('figure') ?? group);
  const i = style.getPropertyValue('--ec-codeblocksTransitions-themeIndex').trim() || '0';
  const duration = Number.parseFloat(style.getPropertyValue('--ec-codeblocksTransitions-duration')) || 500;
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
  code.style.display = 'none';
  pre.append(box);
  const done = () => {
    box.remove();
    code.style.display = '';
  };
  const renderer = new MagicMoveRenderer(box, { duration, containerStyle: false });
  renderer.render(info(from));
  renderer.render(info(to)).then(done);
  return done;
}

function setup(root: HTMLElement) {
  if (root.dataset.scbStepsReady !== undefined) return;
  root.dataset.scbStepsReady = '';
  const steps = JSON.parse(root.querySelector(':scope > script')?.textContent ?? '[]') as StepTokens[];
  const groups = [...root.querySelectorAll<HTMLElement>(':scope > .expressive-code')];
  const live = root.querySelector(':scope > [aria-live]');
  let current = 0;
  let stop = () => {};

  const go = (k: number, control?: string) => {
    if (k === current || k < 0 || k >= groups.length) return;
    stop();
    const from = current;
    current = k;
    groups[from].classList.remove(`${S}-current`);
    groups[k].classList.add(`${S}-current`);
    const dot = groups[k].querySelector<HTMLElement>(`[data-scb-steps-go="${k}"]`);
    if (live) live.textContent = dot?.getAttribute('aria-label') ?? '';
    if (control) {
      const same = groups[k].querySelector<HTMLButtonElement>(`[data-scb-steps-go="${control}"]`);
      (same && !same.disabled ? same : dot)?.focus();
    }
    if (!reduce.matches && steps[from] && steps[k]) stop = animate(groups[k], steps[from], steps[k]);
  };

  root.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-scb-steps-go]');
    const target = button?.dataset.scbStepsGo;
    if (!target) return;
    if (target === 'prev' || target === 'next') go(current + (target === 'next' ? 1 : -1), target);
    else go(Number(target), 'dot');
  });
  root.addEventListener('keydown', (event) => {
    if (!(event.target as Element).matches(`.${S}-dot`)) return;
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    go(current + step, 'dot');
  });
}

const init = () => {
  for (const root of document.querySelectorAll<HTMLElement>('[data-scb-steps]')) setup(root);
};
init();
document.addEventListener('astro:page-load', init);
