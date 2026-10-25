import { useEffect, useRef } from 'react';

// Open dialogs, innermost (most recently opened) last. One window listener serves them all.
const stack: Array<{ current: () => void }> = [];

/**
 * Escape handling for the open dialog stack. Exported for tests. Returns true when
 * a dialog consumed the key.
 */
export function handleDialogEscape(event: Pick<KeyboardEvent, 'key' | 'stopImmediatePropagation' | 'preventDefault'>): boolean {
  if (event.key !== 'Escape' || stack.length === 0) return false;
  // Capture phase on window runs before every bubble listener, so a host modal
  // that closes on Escape does not also close under the dialog.
  event.stopImmediatePropagation();
  event.preventDefault();
  stack[stack.length - 1].current();
  return true;
}

function onKeyDown(event: KeyboardEvent) {
  handleDialogEscape(event);
}

/** Register a dialog: while `isOpen`, Escape calls `onClose` and goes no further. */
export function pushDialog(onClose: { current: () => void }): () => void {
  if (stack.length === 0 && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown, true);
  }
  stack.push(onClose);
  return () => {
    const i = stack.lastIndexOf(onClose);
    if (i >= 0) stack.splice(i, 1);
    if (stack.length === 0 && typeof window !== 'undefined') {
      window.removeEventListener('keydown', onKeyDown, true);
    }
  };
}

/** While `isOpen`, Escape closes this dialog (the innermost open one) and nothing else. */
export function useDialogEscape(isOpen: boolean, onClose: () => void): void {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    return pushDialog(ref);
  }, [isOpen]);
}
