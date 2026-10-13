import { anchored, EDGE, place } from './shared/position.ts';

const SQUIGGLE = '.scb-squiggle[tabindex]';
const stops = new WeakMap<Element, () => void>();
const hiding = new WeakMap<Element, number>();
// Closed with Escape: the pointer must leave before hover shows it again.
const dismissed = new WeakSet<Element>();
let showing = 0;

const popoverOf = (squiggle: Element) => squiggle.querySelector<HTMLElement>(':scope > .scb-squiggle-popover');

function show(squiggle: HTMLElement) {
  const popover = popoverOf(squiggle);
  if (!popover || popover.matches(':popover-open')) return;
  popover.style.translate = '';
  popover.showPopover();
  if (!anchored()) {
    stops.set(popover, place(popover, squiggle));
    return;
  }
  // Text that the block scrolls past the edge of the window still fits its own position area.
  const { left, right } = popover.getBoundingClientRect();
  const width = document.documentElement.clientWidth;
  const shift = right > width - EDGE ? width - EDGE - right : left < EDGE ? EDGE - left : 0;
  if (shift) popover.style.translate = `${shift}px`;
}

function hide(squiggle: Element) {
  const popover = popoverOf(squiggle);
  if (!popover?.matches(':popover-open')) return;
  popover.hidePopover();
  stops.get(popover)?.();
}

const squiggleAt = (target: EventTarget | null) => (target as Element | null)?.closest?.<HTMLElement>(SQUIGGLE);

/** Hover shows the message after 300 ms, as in VS Code. The popover is inside the squiggle, so the pointer can move into it. */
function pointerOver(event: PointerEvent) {
  const squiggle = squiggleAt(event.target);
  if (!squiggle || event.pointerType !== 'mouse') return;
  clearTimeout(hiding.get(squiggle));
  if (dismissed.has(squiggle)) return;
  clearTimeout(showing);
  showing = window.setTimeout(() => show(squiggle), 300);
}

function pointerOut(event: PointerEvent) {
  const squiggle = squiggleAt(event.target);
  if (!squiggle || squiggleAt(event.relatedTarget) === squiggle) return;
  clearTimeout(showing);
  dismissed.delete(squiggle);
  if (squiggle.contains(document.activeElement)) return;
  hiding.set(
    squiggle,
    window.setTimeout(() => hide(squiggle), 200),
  );
}

function focusIn(event: FocusEvent) {
  const squiggle = squiggleAt(event.target);
  if (squiggle && event.target === squiggle && squiggle.matches(':focus-visible')) show(squiggle);
}

function focusOut(event: FocusEvent) {
  const squiggle = squiggleAt(event.target);
  if (squiggle && squiggleAt(event.relatedTarget) !== squiggle && !squiggle.matches(':hover')) hide(squiggle);
}

function keydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  for (const popover of document.querySelectorAll('.scb-squiggle-popover:popover-open')) {
    const squiggle = popover.parentElement as HTMLElement;
    dismissed.add(squiggle);
    hide(squiggle);
    if (squiggle.contains(document.activeElement)) squiggle.focus();
  }
}

let ready = false;

/** Opens the message of a squiggle on hover and on keyboard focus. Escape closes it. */
export default function initSquiggles() {
  if (ready) return;
  ready = true;
  document.addEventListener('pointerover', pointerOver);
  document.addEventListener('pointerout', pointerOut);
  document.addEventListener('focusin', focusIn);
  document.addEventListener('focusout', focusOut);
  document.addEventListener('keydown', keydown);
}
