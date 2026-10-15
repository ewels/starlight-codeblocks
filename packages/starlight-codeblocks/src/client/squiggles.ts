import { dismiss, hoverPopovers } from './shared/hover.ts';
import { anchored, EDGE, follow } from './shared/position.ts';

const SELECT = 'data-scb-squiggle-select';
const stops = new WeakMap<Element, () => void>();
let touch = false;
let selectable: Element | undefined;

const popoverOf = (squiggle: Element) => squiggle.querySelector<HTMLElement>(':scope > .scb-squiggle-popover');

/** The script version of the popover styles: above the text from its first character, else below it. */
function above(popover: HTMLElement, squiggle: HTMLElement) {
  const gap = 6;
  const a = squiggle.getBoundingClientRect();
  const { width, height } = popover.getBoundingClientRect();
  const top = a.top - gap - height >= EDGE ? a.top - gap - height : a.bottom + gap;
  const left = Math.max(EDGE, Math.min(a.left, innerWidth - width - EDGE));
  Object.assign(popover.style, { margin: '0', top: `${top}px`, left: `${left}px` });
}

function show(squiggle: HTMLElement) {
  const popover = popoverOf(squiggle);
  if (!popover || popover.matches(':popover-open')) return;
  popover.showPopover();
  if (!anchored())
    stops.set(
      popover,
      follow(popover, () => above(popover, squiggle)),
    );
}

function hide(squiggle: Element) {
  const popover = popoverOf(squiggle);
  if (!popover?.matches(':popover-open')) return;
  popover.hidePopover();
  stops.get(popover)?.();
}

/**
 * The squiggle that holds the message under `target`. A later annotation that overlaps a squiggle splits it,
 * and a part inside a link, for example, finds its message through the first part.
 */
function squiggleAt(target: EventTarget | null) {
  const el = target as Element | null;
  const head = el?.closest?.<HTMLElement>('.scb-squiggle[tabindex]');
  if (head) return head;
  const part = el?.closest?.<HTMLElement>('.scb-squiggle');
  return (
    part
      ?.closest('.ec-line')
      ?.querySelector<HTMLElement>(`.scb-squiggle[tabindex][data-scb-squiggle="${part.dataset.scbSquiggle}"]`) ??
    undefined
  );
}

const keyboard = (squiggle: Element) => squiggle.matches(':focus-visible, :has(:focus-visible)');

/** Keyboard focus, or a tap, opens the message at once. A mouse click focuses the squiggle too, but hover handles the mouse. */
function focusIn(event: FocusEvent) {
  const squiggle = squiggleAt(event.target);
  if (squiggle && (touch || keyboard(squiggle)) && squiggleAt(event.relatedTarget) !== squiggle) show(squiggle);
}

function focusOut(event: FocusEvent) {
  const squiggle = squiggleAt(event.target);
  if (squiggle && squiggleAt(event.relatedTarget) !== squiggle && !squiggle.matches(':hover')) hide(squiggle);
}

function keydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  for (const popover of document.querySelectorAll('.scb-squiggle-popover:popover-open')) {
    const squiggle = popover.parentElement as HTMLElement;
    dismiss(squiggle);
    // Before it hides, so that focus on a link in the message does not fall to the page.
    if (squiggle.contains(document.activeElement)) squiggle.focus();
    hide(squiggle);
  }
}

/**
 * Makes a message's text selectable for a selection that starts in it, so that a drag across the code
 * still leaves the message out.
 */
function pointerDown(event: PointerEvent) {
  touch = event.pointerType !== 'mouse';
  selectable?.removeAttribute(SELECT);
  selectable = (event.target as Element).closest?.('.scb-squiggle-popover') ?? undefined;
  selectable?.setAttribute(SELECT, '');
}

let ready = false;

/** Opens the message of a squiggle on hover, on keyboard focus and on a tap. Escape closes it. */
export default function initSquiggles() {
  if (ready) return;
  ready = true;
  hoverPopovers(
    (target) => {
      const key = squiggleAt(target);
      return key && { key, trigger: true };
    },
    300,
    show,
    (squiggle) => keyboard(squiggle) || hide(squiggle),
  );
  document.addEventListener('pointerdown', pointerDown);
  document.addEventListener('focusin', focusIn);
  document.addEventListener('focusout', focusOut);
  document.addEventListener('keydown', keydown);
}
