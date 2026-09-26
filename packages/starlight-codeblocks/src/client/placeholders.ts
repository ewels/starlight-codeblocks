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

function setup(block: HTMLElement) {
  block.dataset.scbPlaceholdersReady = '';
  const inputs = [...block.querySelectorAll<HTMLInputElement>(FIELD)];
  const texts = [...new Set(inputs.map((input) => input.placeholder))];
  const raw = filler(texts, (s) => s);
  const encoded = filler(texts, encodeURIComponent);
  const targets: (() => void)[] = [];
  const button = block.querySelector<HTMLElement>('.copy button[data-code]');
  if (button) {
    const template = button.dataset.code as string;
    targets.push(() => {
      button.dataset.code = raw(template);
    });
  }
  // A link with data-scb-playground is rebuilt from the copied text by its own module.
  for (const link of block.querySelectorAll<HTMLAnchorElement>('a.scb-playground:not([data-scb-playground])')) {
    const template = link.href;
    targets.push(() => {
      link.href = encoded(template);
    });
  }
  for (const field of block.querySelectorAll<HTMLInputElement>('form.scb-playground input[type="hidden"]')) {
    const template = field.value;
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
    const block = input.closest('[data-scb-placeholders]');
    if (block) updates.get(block)?.();
  }
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
    document.addEventListener('keydown', (event) => {
      const input = (event.target as Element).closest?.<HTMLInputElement>(FIELD);
      if (input && event.key === 'Escape') change(input.placeholder, '');
    });
  }
  for (const [block] of updates) if (!block.isConnected) updates.delete(block);
  for (const block of blocks) setup(block);
}
