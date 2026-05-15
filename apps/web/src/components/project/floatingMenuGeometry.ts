import type { CSSProperties } from 'react';

/** Sticky board toolbar uses z-10; stay above it, below Cmd+K (z 120+). */
export const FLOATING_MENU_Z = 110;

/** Fixed panel below a trigger, width clamped, right-aligned to trigger by default. */
export function menuBelowTrigger(
  trigger: HTMLButtonElement,
  opts: { minWidth: number; maxWidth: number }
): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  const vw = window.innerWidth;
  const width = Math.min(opts.maxWidth, Math.max(opts.minWidth, vw - margin * 2));
  let left = rect.right - width;
  left = Math.max(margin, Math.min(left, vw - width - margin));
  const top = rect.bottom + 6;
  const maxH = Math.max(120, Math.min(520, window.innerHeight - top - margin));
  return {
    position: 'fixed',
    zIndex: FLOATING_MENU_Z,
    left,
    top,
    width,
    maxHeight: maxH,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  };
}
