import { place } from './shared/position.ts';

const SHOW_DELAY = 150;
// Time to move the pointer from a link onto its card, which readers can hover (WCAG 1.4.13).
const HIDE_DELAY = 200;

const part = (name: string, text: string) => {
  const span = document.createElement('span');
  span.className = `scb-api-card-${name}`;
  span.textContent = text;
  return span;
};

let card: HTMLElement;
let current: HTMLElement | undefined;
let showTimer = 0;
let hideTimer = 0;
let stop = () => {};

function hide() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  if (!current) return;
  current = undefined;
  stop();
  card.hidePopover();
}

function show(link: HTMLElement) {
  clearTimeout(hideTimer);
  if (link === current) return;
  hide();
  const { scbApiHead = '', scbApiSummary, scbApiSource = '' } = link.dataset;
  card.replaceChildren(
    part('head', scbApiHead),
    ...(scbApiSummary ? [part('summary', scbApiSummary)] : []),
    part('source', scbApiSource),
  );
  // Inside the link's own block, which can be a copy of a block in a full screen overlay.
  link.closest('[data-scb-api-links]')?.append(card);
  current = link;
  card.showPopover();
  stop = place(card, link);
}

const linkOf = (target: EventTarget | null) =>
  (target as Element | null)?.closest?.<HTMLElement>('[data-scb-api-links] .scb-api-link') ?? undefined;

/** Shows a card with the signature, summary and source of an API link on hover and focus. */
export default function initApiLinks() {
  if (card) return;
  // Screen readers get the same text from each link's `aria-description`.
  card = document.createElement('span');
  card.className = 'scb-float scb-api-card';
  card.popover = 'manual';
  card.setAttribute('aria-hidden', 'true');
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  document.addEventListener('mouseover', (event) => {
    const link = linkOf(event.target);
    if (link) {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      showTimer = window.setTimeout(() => show(link), SHOW_DELAY);
    } else if (card.contains(event.target as Node)) {
      clearTimeout(hideTimer);
    }
  });
  document.addEventListener('mouseout', (event) => {
    const from = linkOf(event.target) ?? (card.contains(event.target as Node) ? card : undefined);
    if (!from || from.contains(event.relatedTarget as Node)) return;
    clearTimeout(showTimer);
    if (current && document.activeElement !== current) hideTimer = window.setTimeout(hide, HIDE_DELAY);
  });
  document.addEventListener('focusin', (event) => {
    const link = linkOf(event.target);
    if (link) show(link);
  });
  document.addEventListener('focusout', (event) => {
    if (linkOf(event.target)) hide();
  });
}
