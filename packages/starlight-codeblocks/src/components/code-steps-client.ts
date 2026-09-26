import { MagicMoveRenderer } from '@shikijs/magic-move/renderer';
import type { KeyedTokensInfo } from '@shikijs/magic-move/types';
import { swapInto } from '../client/shared/swap.ts';
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

const roots: HTMLElement[][] = [];

function setup(root: HTMLElement) {
  if (root.dataset.scbStepsReady !== undefined) return;
  root.dataset.scbStepsReady = '';
  const steps = JSON.parse(root.querySelector(':scope > script')?.textContent ?? '[]') as StepTokens[];
  const groups = [...root.querySelectorAll<HTMLElement>(':scope > .expressive-code')];
  for (const group of groups) group.dataset.scbStepsOf = String(roots.length);
  roots.push(groups);
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
    if (control) focus(groups[k], control, k);
    if (!reduce.matches && steps[from] && steps[k]) stop = animate(groups[k], steps[from], steps[k]);
  };

  root.addEventListener('click', (event) => {
    const target = goTarget(event);
    if (target) go(target.to(current), target.control);
  });
  root.addEventListener('keydown', (event) => {
    const step = arrow(event);
    if (step) go(current + step, 'dot');
  });
}

function focus(group: Element, control: string, k: number) {
  const same = group.querySelector<HTMLButtonElement>(`[data-scb-steps-go="${control}"]`);
  (same && !same.disabled ? same : group.querySelector<HTMLElement>(`[data-scb-steps-go="${k}"]`))?.focus();
}

function goTarget(event: Event) {
  const go = (event.target as Element).closest<HTMLElement>('[data-scb-steps-go]')?.dataset.scbStepsGo;
  if (!go) return;
  if (go === 'prev' || go === 'next') return { control: go, to: (k: number) => k + (go === 'next' ? 1 : -1) };
  return { control: 'dot', to: () => Number(go) };
}

function arrow(event: KeyboardEvent) {
  if (!(event.target as Element).matches(`.${S}-dot`)) return;
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (step) event.preventDefault();
  return step;
}

/**
 * A copy of one step, as full screen plugins show, has no other steps. It moves by swapping in the step it
 * goes to, without the animation.
 */
function goInCopy(copy: HTMLElement, to: (k: number) => number, control: string) {
  const k = to(Number(copy.querySelector('[aria-current="step"]')?.getAttribute('data-scb-steps-go')));
  const next = roots[Number(copy.dataset.scbStepsOf)]?.[k];
  if (!next) return;
  swapInto(copy, next);
  focus(copy, control, k);
}

let listening = false;

const init = () => {
  for (const root of document.querySelectorAll<HTMLElement>('[data-scb-steps]')) setup(root);
  if (listening) return;
  listening = true;
  const copyOf = (event: Event) => {
    const group = (event.target as Element).closest<HTMLElement>('[data-scb-steps-of]');
    return group && !group.closest('[data-scb-steps]') ? group : undefined;
  };
  document.addEventListener('click', (event) => {
    const copy = copyOf(event);
    const target = copy && goTarget(event);
    if (copy && target) goInCopy(copy, target.to, target.control);
  });
  document.addEventListener('keydown', (event) => {
    const copy = copyOf(event);
    const step = copy && arrow(event);
    if (copy && step) goInCopy(copy, (k) => k + step, 'dot');
  });
};
init();
document.addEventListener('astro:page-load', init);
