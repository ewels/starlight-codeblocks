const hiding = new WeakMap<Element, number>();
// Closed by the reader: hover does not show them again until the pointer leaves.
const dismissed = new WeakSet<Element>();
let showing = 0;

/** Stops hover from showing `key` again until the pointer leaves it. */
export const dismiss = (key: Element) => dismissed.add(key);

export interface HoverTarget {
  /** One per popover: the same element for its trigger and the popover. */
  key: HTMLElement;
  /** True on the trigger, false in the popover. Only the trigger starts the delay. */
  trigger: boolean;
}

/**
 * Calls `show` after `delay` ms of mouse hover over a trigger, and `hide` 200 ms after the pointer leaves the
 * trigger and its popover. The delay lets the pointer cross the gap into the popover.
 */
export function hoverPopovers(
  find: (target: Element) => HoverTarget | undefined,
  delay: number,
  show: (key: HTMLElement) => void,
  hide: (key: HTMLElement) => void,
) {
  const at = (target: EventTarget | null) => (target instanceof Element ? find(target) : undefined);
  document.addEventListener('pointerover', (event) => {
    const found = event.pointerType === 'mouse' ? at(event.target) : undefined;
    if (!found) return;
    clearTimeout(hiding.get(found.key));
    if (!found.trigger || dismissed.has(found.key)) return;
    clearTimeout(showing);
    showing = window.setTimeout(() => show(found.key), delay);
  });
  document.addEventListener('pointerout', (event) => {
    const found = event.pointerType === 'mouse' ? at(event.target) : undefined;
    if (!found || at(event.relatedTarget)?.key === found.key) return;
    clearTimeout(showing);
    dismissed.delete(found.key);
    hiding.set(
      found.key,
      window.setTimeout(() => hide(found.key), 200),
    );
  });
}
