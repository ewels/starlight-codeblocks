import { anchored, place } from './shared/position.ts';

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
  popover.showPopover();
  if (!anchored()) stops.set(popover, place(popover, squiggle));
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
  if (event.pointerType !== 'mouse') return;
  const squiggle = squiggleAt(event.target);
  if (!squiggle) return;
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
  const target = event.target as HTMLElement;
  if (target.matches?.(`${SQUIGGLE}:focus-visible`)) show(target);
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
