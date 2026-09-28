const S = 'scb-scrolly';
const list = (value: string | undefined) => new Set(value ? value.split(',').map(Number) : []);

function setup(root: HTMLElement) {
  if (root.dataset.scbScrollyReady !== undefined) return;
  root.dataset.scbScrollyReady = '';
  const steps = [...root.querySelectorAll<HTMLElement>(`.${S}-step`)];
  const lines = [...root.querySelectorAll(`.${S}-code .ec-line:not(summary > *)`)];
  const show = (step: HTMLElement) => {
    for (const s of steps) s.classList.toggle(`${S}-on`, s === step);
    const focus = list(step.dataset.scbFocus);
    const mark = list(step.dataset.scbMark);
    lines.forEach((line, i) => {
      line.classList.toggle('scb-focus-out', focus.size > 0 && !focus.has(i));
      line.classList.toggle('mark', mark.has(i));
    });
  };
  // The active step is the one at the middle of the sticky block (or of the window, in the narrow layout), or
  // the nearest one. Reading the positions on each scroll also catches jumps, such as the End key or an anchor.
  const code = root.querySelector<HTMLElement>(`.${S}-code`);
  let line = 0;
  let frame = 0;
  const pick = () => {
    frame = 0;
    let best: HTMLElement | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const step of steps) {
      const { top, bottom } = step.getBoundingClientRect();
      const distance = Math.max(top - line, line - bottom, 0);
      if (distance < bestDistance) [best, bestDistance] = [step, distance];
    }
    if (best && !best.classList.contains(`${S}-on`)) show(best);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(pick);
  };
  const measure = () => {
    const height = code?.offsetHeight ?? 0;
    const top = code && height ? Number.parseFloat(getComputedStyle(code).top) || 0 : 0;
    line = Math.round(height ? Math.min(top + height / 2, (top + innerHeight) / 2) : innerHeight / 2);
    root.style.setProperty('--scb-scrolly-line', `${line}px`);
    root.style.setProperty('--scb-scrolly-lead', `${line - top}px`);
    root.style.setProperty('--scb-scrolly-height', `${height}px`);
    schedule();
  };
  if (code) new ResizeObserver(measure).observe(code);
  addEventListener('resize', measure);
  addEventListener('scroll', schedule, { passive: true });
  measure();
}

const init = () => {
  for (const root of document.querySelectorAll<HTMLElement>('[data-scb-scrolly]')) setup(root);
};
init();
document.addEventListener('astro:page-load', init);
