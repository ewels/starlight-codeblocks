import { swapInto } from './shared/swap.ts';

const KEY = 'scb-code-switcher:';

function read(sync: string) {
  try {
    return localStorage.getItem(KEY + sync);
  } catch {
    return null;
  }
}

function save(sync: string, label: string) {
  try {
    localStorage.setItem(KEY + sync, label);
  } catch {}
}

const variants = (group: Element) => [...group.querySelectorAll<HTMLElement>(':scope > .expressive-code')];
const labels = (group: Element) => [...(group.querySelector('select')?.options ?? [])].map((o) => o.text);

function show(group: Element, index: number) {
  variants(group).forEach((variant, i) => {
    variant.hidden = i !== index;
  });
  for (const menu of group.querySelectorAll('select')) menu.selectedIndex = index;
}

/** Shows variant `index` of the group, and the variant with its label in every group with the same sync key. */
function pick(group: HTMLElement, index: number) {
  const sync = group.dataset.scbCodeSwitcher;
  if (!sync) return show(group, index);
  const label = labels(group)[index] ?? '';
  save(sync, label);
  for (const other of document.querySelectorAll(`[data-scb-code-switcher="${CSS.escape(sync)}"]`)) {
    show(other, Math.max(0, labels(other).indexOf(label)));
  }
}

const groups: HTMLElement[] = [];
let listening = false;

/** A copy of one variant, as full screen plugins show, becomes a copy of the variant that its menu picks. */
function changeInCopy(event: Event) {
  const menu = event.target as HTMLSelectElement;
  const copy = menu.closest<HTMLElement>('[data-scb-switcher-of]');
  if (menu.tagName !== 'SELECT' || !copy || copy.closest('[data-scb-code-switcher]')) return;
  const group = groups[Number(copy.dataset.scbSwitcherOf)];
  const variant = group && variants(group)[menu.selectedIndex];
  if (!variant) return;
  pick(group, menu.selectedIndex);
  swapInto(copy, variant);
  copy.querySelector('select')?.focus();
}

/** Switches the variants of a `:::code-switcher` block from its menu, and keeps groups with one sync key in step. */
export default function initCodeSwitcher() {
  if (!listening) {
    listening = true;
    document.addEventListener('change', changeInCopy);
  }
  for (const group of document.querySelectorAll<HTMLElement>('[data-scb-code-switcher]:not([data-scb-ready])')) {
    group.dataset.scbReady = '';
    for (const variant of variants(group)) variant.dataset.scbSwitcherOf = String(groups.length);
    groups.push(group);
    const saved = group.dataset.scbCodeSwitcher && read(group.dataset.scbCodeSwitcher);
    if (saved) show(group, Math.max(0, labels(group).indexOf(saved)));
    group.addEventListener('change', (event) => {
      const menu = event.target as HTMLSelectElement;
      if (menu.tagName !== 'SELECT') return;
      pick(group, menu.selectedIndex);
      variants(group)[menu.selectedIndex]?.querySelector('select')?.focus();
    });
  }
}
