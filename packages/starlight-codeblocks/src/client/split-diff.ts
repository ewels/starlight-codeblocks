const S = 'scb-split';
const KEY = 'scb-diff-view';

/** The reader's stored view, or `null` if there is none. */
const remembered = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

// Line permalinks replace the number with a link.
const lineNumber = (el: Element) => el.querySelector<HTMLElement>('.gutter :is(.ln, a.scb-permalink)');

function renumber(el: Element, n: number) {
  const ln = lineNumber(el);
  if (!ln) return;
  ln.dataset.scbLn ??= ln.textContent ?? '';
  ln.textContent = String(n);
  // A permalink's name says its number, and must keep saying the one that readers see.
  const label = ln.getAttribute('aria-label');
  if (!label) return;
  ln.dataset.scbLabel ??= label;
  ln.setAttribute('aria-label', ln.dataset.scbLabel.replace(ln.dataset.scbLn, String(n)));
}

function place(el: HTMLElement, row: number, side?: 'left' | 'right') {
  el.style.setProperty('--scb-row', String(row));
  if (side) el.classList.add(`${S}-${side}`);
}

function gap(after: Element, row: number, side: 'left' | 'right') {
  const el = document.createElement('div');
  el.className = `${S}-gap`;
  place(el, row, side);
  // Next to its row partner, so that CSS can hide it with a hidden line.
  after.after(el);
}

/**
 * Lays the lines out in two columns: unchanged lines on both sides, each run of removed lines next to the added
 * lines that follow it. The right side's unchanged lines are copies, inert apart from a permalink, so the DOM still reads as a unified diff.
 */
function split(pre: HTMLElement) {
  const code = pre.querySelector('code');
  if (!code) return;
  pre.classList.add(S);
  const start = Number(lineNumber(code)?.textContent || 1);
  let before = start;
  let after = start;
  let row = 0;
  // Callouts and hidden-line markers sit above the line they belong to, on its side.
  const above: HTMLElement[] = [];
  let dels: { el: HTMLElement; above: HTMLElement[] }[] = [];
  let adds: typeof dels = [];
  const flush = () => {
    for (let i = 0; i < Math.max(dels.length, adds.length); i++) {
      const del = dels[i];
      const add = adds[i];
      for (let j = 0; j < Math.max(del?.above.length ?? 0, add?.above.length ?? 0); j++) {
        row++;
        if (del?.above[j]) place(del.above[j], row, 'left');
        if (add?.above[j]) place(add.above[j], row, 'right');
      }
      row++;
      if (del) {
        place(del.el, row, 'left');
        renumber(del.el, before++);
        if (!add) gap(del.el, row, 'right');
      }
      if (add) {
        place(add.el, row, 'right');
        renumber(add.el, after++);
        if (!del) gap(add.el, row, 'left');
      }
    }
    dels = [];
    adds = [];
  };
  for (const el of [...code.children] as HTMLElement[]) {
    if (el.matches('.ec-line.del')) dels.push({ el, above: above.splice(0) });
    else if (el.matches('.ec-line.ins')) adds.push({ el, above: above.splice(0) });
    else if (!el.matches('.ec-line')) above.push(el);
    else {
      flush();
      for (const deco of above.splice(0)) place(deco, ++row);
      const copy = el.cloneNode(true) as HTMLElement;
      place(el, ++row, 'left');
      for (const node of [copy, ...copy.querySelectorAll('[id]')]) node.removeAttribute('id');
      // Expandable and mentions act on the original line only. CSS shows or hides the copy with it.
      copy.removeAttribute('hidden');
      delete copy.dataset.scbMention;
      copy.classList.add(`${S}-copy`);
      // A pointer can use the copy's permalink, which opens the same line. Keyboards use the one on the left.
      for (const part of copy.children) if (!part.classList.contains('gutter')) (part as HTMLElement).inert = true;
      copy.querySelector('a.scb-permalink')?.setAttribute('tabindex', '-1');
      copy.ariaHidden = 'true';
      place(copy, row, 'right');
      renumber(el, before++);
      renumber(copy, after++);
      el.after(copy);
    }
  }
  flush();
  for (const deco of above) place(deco, ++row);
}

function unsplit(pre: HTMLElement) {
  pre.classList.remove(S);
  for (const el of pre.querySelectorAll(`.${S}-copy, .${S}-gap`)) el.remove();
  for (const el of pre.querySelectorAll<HTMLElement>('code > *')) {
    el.classList.remove(`${S}-left`, `${S}-right`);
    el.style.removeProperty('--scb-row');
    const ln = lineNumber(el);
    if (ln?.dataset.scbLn !== undefined) {
      ln.textContent = ln.dataset.scbLn;
      delete ln.dataset.scbLn;
    }
    if (ln?.dataset.scbLabel !== undefined) {
      ln.setAttribute('aria-label', ln.dataset.scbLabel);
      delete ln.dataset.scbLabel;
    }
  }
}

function apply(pre: HTMLElement, view?: string) {
  const on = view === 'split';
  if (pre.classList.contains(S) !== on) {
    (on ? split : unsplit)(pre);
    pre.dispatchEvent(new Event('scb-split-change', { bubbles: true }));
  }
  for (const toggle of pre.closest('.expressive-code')?.querySelectorAll<HTMLElement>('.scb-split-toggle') ?? []) {
    toggle.setAttribute('aria-pressed', String((toggle.dataset.scbView === 'split') === on));
  }
}

/** The block of the switch, or with `sync`, every synced diff block on the page. */
function choose(button: HTMLElement) {
  const pre = button.closest('.expressive-code')?.querySelector<HTMLElement>('pre[data-scb-split-diff]');
  if (!pre) return;
  const view = button.dataset.scbView ?? 'unified';
  if (!pre.hasAttribute('data-scb-split-sync')) return apply(pre, view);
  try {
    localStorage.setItem(KEY, view);
  } catch {}
  const top = button.getBoundingClientRect().top;
  for (const other of document.querySelectorAll<HTMLElement>('pre[data-scb-split-sync]')) apply(other, view);
  // Blocks above the button change height. Keep the button where the reader clicked it.
  scrollBy({ top: button.getBoundingClientRect().top - top, behavior: 'instant' });
}

let ready = false;

/** Shows diff blocks in their start view, or the reader's stored one, and switches them between unified and split. */
export default function initSplitDiff() {
  if (!ready) {
    ready = true;
    document.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLElement>('.scb-split-toggle');
      if (button && button.getAttribute('aria-pressed') !== 'true') choose(button);
    });
  }
  const stored = remembered();
  for (const pre of document.querySelectorAll<HTMLElement>('pre[data-scb-split-diff]:not([data-scb-split-ready])')) {
    pre.dataset.scbSplitReady = '';
    apply(pre, pre.hasAttribute('data-scb-split-sync') && stored ? stored : pre.dataset.scbSplitDiff);
  }
}
