import { decodeCode } from './shared/copy.ts';

const timers = new WeakMap<HTMLElement, number>();

async function click(event: MouseEvent) {
  const button = (event.target as Element).closest?.<HTMLButtonElement>('.scb-shell-copy');
  if (!button) return;
  try {
    await navigator.clipboard.writeText(decodeCode(button.dataset.code));
  } catch {
    return;
  }
  const live = button.parentElement?.querySelector('[aria-live]');
  // Keeps the width, so that the shorter label does not move the buttons beside it.
  button.style.minWidth = `${button.getBoundingClientRect().width}px`;
  button.textContent = 'Copied';
  if (live) live.textContent = 'Copied';
  clearTimeout(timers.get(button));
  timers.set(
    button,
    window.setTimeout(() => {
      button.textContent = 'Copy commands';
      if (live) live.textContent = '';
    }, 1500),
  );
}

let ready = false;

/** Copies the commands of a terminal block, without the prompts or the output, from its title bar button. */
export default function initShellCopy() {
  if (ready) return;
  ready = true;
  document.addEventListener('click', click);
}
