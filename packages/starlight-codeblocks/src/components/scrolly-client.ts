import type { StepTokens } from './steps.ts';

const S = 'scb-scrolly';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const list = (value: string | undefined) => new Set(value ? value.split(',').map(Number) : []);

function setup(root: HTMLElement) {
  if (root.dataset.scbScrollyReady !== undefined) return;
  root.dataset.scbScrollyReady = '';
  const steps = [...root.querySelectorAll<HTMLElement>(`.${S}-step`)];
  const versions = [...root.querySelectorAll<HTMLElement>(`.${S}-code > .expressive-code`)];
  const data = root.querySelector(`.${S}-code > script`)?.textContent;
  const tokens = data ? (JSON.parse(data) as StepTokens[]) : [];
  // Only blocks with several versions load the animation.
  const animation = tokens.length > 0 ? import('./animate.ts') : undefined;
  let version = 0;
  let active: HTMLElement | undefined;
  let stop = () => {};
  const show = async (step: HTMLElement) => {
    active = step;
    for (const s of steps) s.classList.toggle(`${S}-on`, s === step);
    const v = Number(step.dataset.scbVersion ?? 0);
    const group = versions[v];
    if (!group) return;
    if (v !== version) {
      stop();
      const from = version;
      version = v;
      // The old version turns `visibility: hidden`, which would drop keyboard focus to the body.
      const focused = focusables(versions[from]).indexOf(document.activeElement as HTMLElement);
      for (const g of versions) g.classList.toggle(`${S}-current`, g === group);
      const next = focused < 0 ? undefined : focusables(group);
      const target = next?.[Math.min(focused, next.length - 1)];
      target?.focus({ preventScroll: true });
      // The animation hides the real code, and with it a focused line.
      const hides = target && group.querySelector('pre > code')?.contains(target);
      if (animation && tokens[from] && tokens[v] && !reduce.matches && !hides) {
        const { animate } = await animation;
        if (active !== step) return;
        stop = animate(group, tokens[from], tokens[v]);
      }
    }
    const focus = list(step.dataset.scbFocus);
    const mark = list(step.dataset.scbMark);
    const marked = list(group.dataset.scbMarked);
    group.querySelectorAll('.ec-line:not(summary > *)').forEach((line, i) => {
      line.classList.toggle('scb-focus-out', focus.size > 0 && !focus.has(i));
      line.classList.toggle('mark', mark.has(i) || marked.has(i));
    });
  };
  // The active step is the one at the middle of the sticky block (or of the window, in the narrow layout), or
  // the nearest one. Reading the positions on each scroll also catches jumps, such as the End key or an anchor.
  const code = root.querySelector<HTMLElement>(`.${S}-code`);
  let line = 0;
  let frame = 0;
  // A view transition removes the root, but not its window listeners.
  const listening = new AbortController();
  const gone = () => {
    if (!root.isConnected) listening.abort();
    return listening.signal.aborted;
  };
  const pick = () => {
    frame = 0;
    if (gone()) return;
    let best: HTMLElement | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const step of steps) {
      const { top, bottom } = step.getBoundingClientRect();
      const distance = Math.max(top - line, line - bottom, 0);
      if (distance < bestDistance) [best, bestDistance] = [step, distance];
    }
    if (best && !best.classList.contains(`${S}-on`)) void show(best);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(pick);
  };
  const measure = () => {
    if (gone()) return;
    const height = code?.offsetHeight ?? 0;
    const top = code && height ? Number.parseFloat(getComputedStyle(code).top) || 0 : 0;
    line = Math.round(height ? Math.min(top + height / 2, (top + innerHeight) / 2) : innerHeight / 2);
    root.style.setProperty('--scb-scrolly-line', `${line}px`);
    root.style.setProperty('--scb-scrolly-lead', `${line - top}px`);
    root.style.setProperty('--scb-scrolly-height', `${height}px`);
    schedule();
  };
  if (code) {
    const observer = new ResizeObserver(measure);
    observer.observe(code);
    listening.signal.addEventListener('abort', () => observer.disconnect());
  }
  addEventListener('resize', measure, { signal: listening.signal });
  addEventListener('scroll', schedule, { passive: true, signal: listening.signal });
  measure();

  // Each copy of the block has its own line ids, and each layout hides some copies. A permalink to a hidden copy
  // moves to the same lines in the copy on screen, and shows the step of those lines.
  let moving = false;
  const reveal = (el: Element) => {
    const own = steps.findIndex((step) => step.contains(el));
    const v = versions.findIndex((group) => group.contains(el));
    const wide = (code?.offsetHeight ?? 0) > 0;
    if (moving || (wide ? own < 0 && v === version : own >= 0)) return;
    const step = steps[own >= 0 ? own : steps.findIndex((s) => Number(s.dataset.scbVersion ?? 0) === v)];
    if (!step) return;
    const visible = wide ? versions[Number(step.dataset.scbVersion ?? 0)] : step;
    const from = el.closest('[data-scb-permalinks]')?.id;
    const to = visible?.querySelector('[data-scb-permalinks]')?.id;
    if (from && to && from !== to && location.hash.startsWith(`#${from}-L`)) {
      history.replaceState(history.state, '', `#${to}${location.hash.slice(from.length + 1)}`);
      moving = true;
      dispatchEvent(new HashChangeEvent('hashchange'));
      moving = false;
    }
    if (!wide) return;
    void show(step);
    // After the permalinks script scrolls to the line, which in the sticky column need not reach the step.
    requestAnimationFrame(() =>
      scrollBy({ top: step.getBoundingClientRect().top - line + 1, behavior: reduce.matches ? 'auto' : 'smooth' }),
    );
  };
  root.addEventListener('beforematch', (event) => reveal(event.target as Element), true);
  // A permalink can target a line before this script is ready.
  const target = root.querySelector('.scb-permalink-target');
  if (target) reveal(target);
}

const focusables = (group: Element) => [
  ...group.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'),
];

const init = () => {
  for (const root of document.querySelectorAll<HTMLElement>('[data-scb-scrolly]')) setup(root);
};
init();
document.addEventListener('astro:page-load', init);
