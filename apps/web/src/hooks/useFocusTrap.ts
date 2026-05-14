import { useEffect, useRef } from 'react';

/**
 * Keep keyboard focus inside `ref` while `active` is true. On activation we focus the first
 * tabbable inside the container (or the container itself); on deactivation focus returns to
 * whatever element was focused before. Tab / Shift+Tab cycle is rewritten so it never escapes
 * the modal.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, open);
 *   return open ? <div ref={ref} role="dialog" aria-modal="true">...</div> : null;
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  active: boolean
): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;

    /**
     * Defer the initial focus to next tick so any state-driven autofocus inside the modal
     * (e.g. Formik or `autoFocus` on a field) wins. If nothing claims focus, we focus the
     * first tabbable.
     */
    const t = window.setTimeout(() => {
      if (!node.contains(document.activeElement)) {
        const focusables = tabbables(node);
        const target = focusables[0] ?? node;
        target.focus({ preventScroll: true });
      }
    }, 0);

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusables = tabbables(node!);
      if (focusables.length === 0) {
        e.preventDefault();
        node!.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (current === first || !node!.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      const prev = previouslyFocused.current;
      if (prev && document.body.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [active, ref]);
}

/**
 * Tabbable element discovery without depending on a focus-trap library. Mirrors what
 * `focus-trap` considers tabbable (positive or zero tabindex, visible, not disabled).
 */
function tabbables(root: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), iframe, audio[controls], video[controls], ' +
    '[contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return nodes.filter((n) => {
    if (n.hasAttribute('disabled')) return false;
    if (n.getAttribute('aria-hidden') === 'true') return false;
    const rects = n.getClientRects();
    if (rects.length === 0) return false;
    const style = window.getComputedStyle(n);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return true;
  });
}
