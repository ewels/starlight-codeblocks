const S = 'scb-scrolly';
const list = (value: string | undefined) => new Set(value ? value.split(',').map(Number) : []);

function setup(root: HTMLElement) {
  if (root.dataset.scbScrollyReady !== undefined) return;
  root.dataset.scbScrollyReady = '';
  const steps = [...root.querySelectorAll<HTMLElement>(`.${S}-step`)];
  const lines = [...root.querySelectorAll(`.${S}-code .ec-line`)];
  const show = (step: HTMLElement) => {
    for (const s of steps) s.classList.toggle(`${S}-on`, s === step);
    const focus = list(step.dataset.scbFocus);
    const mark = list(step.dataset.scbMark);
    lines.forEach((line, i) => {
      line.classList.toggle('scb-focus-out', focus.size > 0 && !focus.has(i));
      line.classList.toggle('mark', mark.has(i));
    });
  };
  // The band in the middle of the window: a step is active while it crosses it.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) show(entry.target as HTMLElement);
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  for (const step of steps) observer.observe(step);
}

const init = () => {
  for (const root of document.querySelectorAll<HTMLElement>('[data-scb-scrolly]')) setup(root);
};
init();
document.addEventListener('astro:page-load', init);
