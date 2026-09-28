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
  // A step is active while it crosses the middle of the sticky block (or of the window, in the narrow layout).
  const code = root.querySelector<HTMLElement>(`.${S}-code`);
  let observer: IntersectionObserver | undefined;
  const observe = () => {
    observer?.disconnect();
    const height = code?.offsetHeight ?? 0;
    const top = code && height ? Number.parseFloat(getComputedStyle(code).top) || 0 : 0;
    const line = Math.round(height ? Math.min(top + height / 2, (top + innerHeight) / 2) : innerHeight / 2);
    root.style.setProperty('--scb-scrolly-line', `${line}px`);
    root.style.setProperty('--scb-scrolly-lead', `${line - top}px`);
    root.style.setProperty('--scb-scrolly-height', `${height}px`);
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) show(entry.target as HTMLElement);
      },
      { rootMargin: `${-line}px 0px ${line + 1 - innerHeight}px 0px` },
    );
    for (const step of steps) observer.observe(step);
  };
  if (code) new ResizeObserver(observe).observe(code);
  addEventListener('resize', observe);
  observe();
}

const init = () => {
  for (const root of document.querySelectorAll<HTMLElement>('[data-scb-scrolly]')) setup(root);
};
init();
document.addEventListener('astro:page-load', init);
