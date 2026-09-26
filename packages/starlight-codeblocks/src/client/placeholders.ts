const KEY = 'scb-placeholders';
const FIELD = 'input.scb-placeholder';

type Values = Record<string, string>;

let store: Storage | undefined;
let values: Values | undefined;
const updates = new Map<Element, () => void>();

function openStore(mode: string | undefined) {
  try {
    return mode === 'session' ? sessionStorage : mode === 'local' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

function save() {
  try {
    store?.setItem(KEY, JSON.stringify(values));
  } catch {}
}

const size = (input: HTMLInputElement) => {
  input.style.width = `${Math.max(input.placeholder.length, input.value.length)}ch`;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replaces each placeholder text in a template with the reader's value, in the template's encoding.
 * Longer texts first, so that one text inside another does not match first.
 */
function filler(texts: string[], encode: (s: string) => string) {
  const byEncoded = new Map(texts.map((t) => [encode(t), t]));
  const pattern = new RegExp(
    [...byEncoded.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|'),
    'g',
  );
  return (template: string) =>
    template.replace(pattern, (m) => {
      const text = byEncoded.get(m) as string;
      return encode(values?.[text] || text);
    });
}

function templateOf(el: HTMLElement, value: string) {
  el.dataset.scbTemplate ??= value;
  return el.dataset.scbTemplate;
}

function setup(block: HTMLElement) {
  block.dataset.scbPlaceholdersReady = '';
  const inputs = [...block.querySelectorAll<HTMLInputElement>(FIELD)];
  const texts = [...new Set(inputs.map((input) => input.placeholder))];
  const raw = filler(texts, (s) => s);
  const encoded = filler(texts, encodeURIComponent);
  const targets: (() => void)[] = [];
  const button = block.querySelector<HTMLElement>('.copy button[data-code]');
  // Templates go in an attribute, so that a copy of the block, as full screen plugins show, starts from them too.
  if (button) {
    const template = templateOf(button, button.dataset.code as string);
    targets.push(() => {
      button.dataset.code = raw(template);
    });
  }
  // A link with data-scb-playground is rebuilt from the copied text by its own module.
  for (const link of block.querySelectorAll<HTMLAnchorElement>('a.scb-playground:not([data-scb-playground])')) {
    const template = templateOf(link, link.href);
    targets.push(() => {
      link.href = encoded(template);
    });
  }
  for (const field of block.querySelectorAll<HTMLInputElement>('form.scb-playground input[type="hidden"]')) {
    const template = templateOf(field, field.value);
    targets.push(() => {
      field.value = raw(template);
    });
  }
  const update = () => {
    for (const target of targets) target();
    block.dispatchEvent(new CustomEvent('scb-placeholders-change', { bubbles: true }));
  };
  updates.set(block, update);
  for (const input of inputs) {
    input.value = values?.[input.placeholder] ?? '';
    size(input);
  }
  update();
}

function change(text: string, value: string) {
  if (!values) return;
  if (value) values[text] = value;
  else delete values[text];
  save();
  for (const input of document.querySelectorAll<HTMLInputElement>(FIELD)) {
    if (input.placeholder !== text) continue;
    if (input.value !== value) input.value = value;
    size(input);
    const block = input.closest<HTMLElement>('[data-scb-placeholders]');
    if (block && !updates.has(block)) setup(block);
    else if (block) updates.get(block)?.();
  }
}

/**
 * The selected text of a block with fields, as a manual copy of a block without fields gives it: one
 * line for each line, fields as their value or text, and nothing that cannot be seen or selected.
 */
function selectedText(pre: HTMLElement, range: Range) {
  const hidden = (el: Element) => {
    if (!el.checkVisibility()) return true;
    for (let e: Element | null = el; e && e !== pre; e = e.parentElement) {
      if (getComputedStyle(e).userSelect === 'none') return true;
    }
    return false;
  };
  let text = '';
  let line: Element | null | undefined;
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node instanceof Element ? node : node.parentElement;
    const field = node instanceof HTMLInputElement ? node : undefined;
    if (!el || (!field && !(node instanceof Text)) || !range.intersectsNode(node) || hidden(el)) continue;
    const next = el.closest('.ec-line');
    if (line !== undefined && next !== line) text += '\n';
    line = next;
    if (field) text += field.value || field.placeholder;
    else {
      const value = node.nodeValue ?? '';
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : value.length;
      text += value.slice(start, end);
    }
  }
  return text;
}

function copy(event: ClipboardEvent) {
  const selection = getSelection();
  if (!selection || selection.isCollapsed || !event.clipboardData) return;
  const range = selection.getRangeAt(0);
  const common = range.commonAncestorContainer;
  const el = common instanceof Element ? common : common.parentElement;
  const pre = el?.closest('[data-scb-placeholders]')?.querySelector<HTMLElement>('pre');
  if (!pre?.contains(common) || !pre.querySelector(FIELD)) return;
  event.clipboardData.setData('text/plain', selectedText(pre, range));
  event.preventDefault();
}

/** Fills every field with the reader's saved values, and keeps fields with the same text in step. */
export default function initPlaceholders() {
  const blocks = [
    ...document.querySelectorAll<HTMLElement>('[data-scb-placeholders]:not([data-scb-placeholders-ready])'),
  ];
  if (blocks.length === 0) return;
  if (!values) {
    store = openStore(blocks[0]?.dataset.scbPlaceholders);
    try {
      const saved = JSON.parse(store?.getItem(KEY) ?? '{}');
      values = Object.assign(Object.create(null), saved && typeof saved === 'object' ? saved : {});
    } catch {
      values = Object.create(null);
    }
    document.addEventListener('input', (event) => {
      const input = (event.target as Element).closest?.<HTMLInputElement>(FIELD);
      if (input) change(input.placeholder, input.value);
    });
    document.addEventListener('copy', copy);
    document.addEventListener('keydown', (event) => {
      const input = (event.target as Element).closest?.<HTMLInputElement>(FIELD);
      if (input && event.key === 'Escape') change(input.placeholder, '');
    });
  }
  for (const [block] of updates) if (!block.isConnected) updates.delete(block);
  for (const block of blocks) setup(block);
}
