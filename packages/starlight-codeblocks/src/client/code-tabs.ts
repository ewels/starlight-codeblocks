import { scrollTo } from './shared/scroll.ts';
import { swapInto } from './shared/swap.ts';

const KEY = 'scb-code-tabs:';

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
const labels = (group: HTMLElement): string[] => JSON.parse(group.dataset.scbLabels ?? '[]');

/** Scrolls the tab row of a variant so that its own tab shows, as on a phone with many tabs. */
function scrollToTab(variant: Element) {
  const list = variant.querySelector<HTMLElement>('.scb-tabs-list');
  const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
  if (list && tab) list.scrollLeft = Math.max(0, tab.offsetLeft - list.offsetLeft + tab.offsetWidth - list.clientWidth);
}

function show(group: Element, index: number) {
  variants(group).forEach((variant, i) => {
    variant.hidden = i !== index;
    if (i === index) scrollToTab(variant);
  });
  for (const menu of group.querySelectorAll('select')) menu.selectedIndex = index;
}

/** Shows variant `index` of the group, and the variant with its label in every group with the same sync key. */
function pick(group: HTMLElement, index: number) {
  const sync = group.dataset.scbCodeTabs;
  if (!sync) return show(group, index);
  const label = labels(group)[index] ?? '';
  save(sync, label);
  for (const other of document.querySelectorAll<HTMLElement>(`[data-scb-code-tabs="${CSS.escape(sync)}"]`)) {
    show(other, other === group ? index : Math.max(0, labels(other).indexOf(label)));
  }
}

/** Turns the editor tab of each variant into a row with a tab for every variant, its own selected. */
function addTabs(group: HTMLElement) {
  const titles = variants(group).map((variant) => variant.querySelector('.header .title'));
  const contents = titles.map((title) => title?.cloneNode(true).childNodes ?? []);
  titles.forEach((title, i) => {
    if (!title) return;
    const list = document.createElement('div');
    list.className = 'scb-tabs-list';
    list.role = 'tablist';
    list.ariaLabel = 'Variant';
    contents.forEach((nodes, j) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.role = 'tab';
      // The selected tab keeps the class of the editor tab, so it looks as Expressive Code draws it.
      tab.className = i === j ? 'title' : 'scb-tabs-tab';
      tab.ariaSelected = String(i === j);
      tab.tabIndex = i === j ? 0 : -1;
      for (const node of nodes) tab.append(node.cloneNode(true));
      list.append(tab);
    });
    title.replaceWith(list);
  });
}

const groups: HTMLElement[] = [];
let listening = false;

function focusControl(block: Element | undefined, index: number) {
  const tab = block?.querySelector('.scb-tabs-list')?.children[index] as HTMLElement | undefined;
  (tab ?? block?.querySelector('select'))?.focus();
}

/**
 * Shows variant `index` from a tab or menu. In a copy of one variant, as full screen plugins show, the copy
 * becomes a copy of that variant.
 */
function choose(control: Element, index: number) {
  const group = control.closest<HTMLElement>('[data-scb-code-tabs]');
  if (group) {
    pick(group, index);
    return focusControl(variants(group)[index], index);
  }
  const copy = control.closest<HTMLElement>('[data-scb-tabs-of]');
  const source = copy && groups[Number(copy.dataset.scbTabsOf)];
  const variant = source && variants(source)[index];
  if (!copy || !source || !variant) return;
  pick(source, index);
  swapInto(copy, variant);
  focusControl(copy, index);
}

const tabFor = (event: Event) => (event.target as Element).closest?.('.scb-tabs-list > [role="tab"]');

function onKey(event: KeyboardEvent) {
  const tab = tabFor(event);
  if (!tab?.parentElement) return;
  const tabs = [...tab.parentElement.children];
  const i = tabs.indexOf(tab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1 + tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  choose(tab, next % tabs.length);
}

/** Shows the hidden variant that holds `target`, as a line permalink asks with a `beforematch` event. */
// show(), not pick(): following a link must not change the reader's saved choice.
function reveal(target: Element) {
  const variant = target.closest<HTMLElement>('[data-scb-code-tabs] > .expressive-code[hidden]');
  const group = variant?.parentElement;
  if (!variant || !group) return false;
  show(group, variants(group).indexOf(variant));
  return true;
}

/** Switches the variants of a `:::code-tabs` block from its tabs or menu, and keeps groups with one sync key in step. */
export default function initCodeTabs() {
  if (!listening) {
    listening = true;
    document.addEventListener('click', (event) => {
      const tab = tabFor(event);
      if (tab) choose(tab, [...(tab.parentElement?.children ?? [])].indexOf(tab));
    });
    document.addEventListener('keydown', onKey);
    document.addEventListener('change', (event) => {
      const menu = event.target as HTMLSelectElement;
      if (menu.tagName === 'SELECT' && menu.closest('.scb-tabs-field')) choose(menu, menu.selectedIndex);
    });
    document.addEventListener('beforematch', (event) => reveal(event.target as Element), true);
  }
  // After a page swap, the groups of the old page are gone, and so are any copies that point to them.
  if (!groups.some((group) => group.isConnected)) groups.length = 0;
  for (const group of document.querySelectorAll<HTMLElement>('[data-scb-code-tabs]:not([data-scb-ready])')) {
    group.dataset.scbReady = '';
    if (group.dataset.scbControl === 'tabs') addTabs(group);
    for (const variant of variants(group)) variant.dataset.scbTabsOf = String(groups.length);
    groups.push(group);
    const saved = group.dataset.scbCodeTabs && read(group.dataset.scbCodeTabs);
    if (saved) show(group, Math.max(0, labels(group).indexOf(saved)));
  }
  // A line permalink can target a hidden variant before this script is ready, and could not scroll to it then.
  const target = document.querySelector('[data-scb-code-tabs] > .expressive-code[hidden] .scb-permalink-target');
  if (target && reveal(target)) scrollTo(target, 'center');
}
