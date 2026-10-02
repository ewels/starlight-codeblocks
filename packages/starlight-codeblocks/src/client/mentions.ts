import { reveal, unhide } from './shared/scroll.ts';

const PREFIX = '#mention:';
const ON = 'scb-mention-on';
const ACTIVE = 'scb-mentioning';

// Prose links are outside the code blocks, where the Expressive Code styles do not reach. The hover colour
// overrides Starlight's, so that only the underline changes.
const STYLES = `a[href^="${PREFIX}"] { text-decoration-style: dotted; text-underline-offset: 3px; }
a[href^="${PREFIX}"]:hover, a[href^="${PREFIX}"]:focus-visible { text-decoration-style: solid; color: var(--sl-color-text-accent, revert-layer); }
a[href^="${PREFIX}"]:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }`;

const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

let uid = 0;
// One link's highlight shows at a time, so a hover on a second link cannot clear the lines of the focused one.
let shown: { link: Element; block: Element; lines: Element[] } | undefined;
const highlights = new WeakMap<Element, () => unknown>();

function clear(link?: Element) {
  if (!shown || (link && shown.link !== link)) return;
  shown.block.classList.remove(ACTIVE);
  for (const line of shown.lines) line.classList.remove(ON);
  shown = undefined;
}

/**
 * The next block in the link's section with lines for `name`, or else the nearest block before the link.
 * Only blocks that show count: not a hidden code tabs variant, walkthrough step or scrollycoding copy.
 */
function pair(link: Element, name: string) {
  const blocks = [...document.querySelectorAll('[data-scb-mentions]')].filter(
    (b) =>
      b.checkVisibility({ visibilityProperty: true }) && b.querySelector(`[data-scb-mention~="${CSS.escape(name)}"]`),
  );
  const heading = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].find((h) => before(link, h));
  return (
    blocks.find((b) => before(link, b) && (!heading || before(b, heading))) ??
    blocks.filter((b) => before(b, link)).at(-1)
  );
}

function setUp(link: HTMLAnchorElement) {
  let name: string;
  try {
    name = decodeURIComponent(link.getAttribute('href')?.slice(PREFIX.length) ?? '');
  } catch {
    return;
  }
  const selector = `[data-scb-mention~="${CSS.escape(name)}"]`;
  const find = () => {
    const block = pair(link, name);
    if (!block) return undefined;
    const lines = [...block.querySelectorAll<HTMLElement>(selector)];
    for (const line of lines) line.id ||= `scb-mention-${++uid}`;
    link.setAttribute('aria-describedby', lines.map((l) => l.id).join(' '));
    return { block, lines };
  };
  const on = () => {
    clear();
    const found = find();
    if (!found) return undefined;
    shown = { link, ...found };
    found.block.classList.add(ACTIVE);
    for (const line of found.lines) line.classList.add(ON);
    return found;
  };
  highlights.set(link, on);
  find();
  link.addEventListener('mouseenter', on);
  link.addEventListener('focus', on);
  link.addEventListener('mouseleave', () => {
    if (document.activeElement === link) return;
    clear(link);
    if (document.activeElement) highlights.get(document.activeElement)?.();
  });
  link.addEventListener('blur', () => clear(link));
  link.addEventListener('click', (event) => {
    event.preventDefault();
    // Safari does not focus a clicked link, and focus is what keeps the highlight after the pointer leaves.
    link.focus({ preventScroll: true });
    const found = on();
    if (!found) return;
    for (const line of found.lines) unhide(line);
    reveal(found.lines[0] ?? found.block, 'nearest');
  });
}

/** Pairs each `#mention:<name>` link with its block, and highlights the tagged lines on hover and focus. */
export default function initMentions() {
  if (!document.getElementById('scb-mentions-style')) {
    const style = document.createElement('style');
    style.id = 'scb-mentions-style';
    style.textContent = STYLES;
    document.head.append(style);
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>(`a[href^="${PREFIX}"]:not([data-scb-ready])`)) {
    link.dataset.scbReady = '';
    setUp(link);
  }
}
