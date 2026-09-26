const PREFIX = '#mention:';
const ON = 'scb-mention-on';
const ACTIVE = 'scb-mentioning';

// Prose links are outside the code blocks, where the Expressive Code styles do not reach.
const STYLES = `a[href^="${PREFIX}"] { text-decoration-style: dotted; text-underline-offset: 3px; }
a[href^="${PREFIX}"]:hover, a[href^="${PREFIX}"]:focus-visible { text-decoration-style: solid; }`;

const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

let uid = 0;

/** The next block in the link's section with lines for `name`, or else the nearest block before the link. */
function pair(link: Element, name: string) {
  const blocks = [...document.querySelectorAll('[data-scb-mentions]')].filter((b) =>
    b.querySelector(`[data-scb-mention~="${CSS.escape(name)}"]`),
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
  const block = pair(link, name);
  if (!block) return;
  const lines = [...block.querySelectorAll<HTMLElement>(`[data-scb-mention~="${CSS.escape(name)}"]`)];
  for (const line of lines) line.id ||= `scb-mention-${++uid}`;
  link.setAttribute('aria-describedby', lines.map((l) => l.id).join(' '));
  const on = () => {
    block.classList.add(ACTIVE);
    for (const line of lines) line.classList.add(ON);
  };
  const off = () => {
    block.classList.remove(ACTIVE);
    for (const line of block.querySelectorAll(`.${ON}`)) line.classList.remove(ON);
  };
  link.addEventListener('mouseenter', on);
  link.addEventListener('focus', on);
  link.addEventListener('mouseleave', () => document.activeElement !== link && off());
  link.addEventListener('blur', off);
  link.addEventListener('click', (event) => {
    event.preventDefault();
    on();
    const { top, bottom } = block.getBoundingClientRect();
    if (top >= 0 && bottom <= innerHeight) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    block.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
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
