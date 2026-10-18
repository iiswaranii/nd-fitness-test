import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom sheet. Drag the handle (or the top of the content when scrolled to top) downward
 * to dismiss; tap the dimmed backdrop or press Escape to close.
 */
export function Sheet({ open, onClose, children, label, dismissible = true }: {
  open: boolean; onClose: () => void; children: ReactNode; label: string; dismissible?: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && dismissible) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [open, onClose, dismissible]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!open || !el || !dismissible) return;
    let startY = 0, dy = 0, active = false, startT = 0;
    const onStart = (e: TouchEvent) => {
      const fromGrab = (e.target as HTMLElement).closest('.sheet-grab');
      const atTop = (bodyRef.current?.scrollTop ?? 0) <= 0;
      if (!fromGrab && !atTop) return;
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const inner = (e.target as HTMLElement).closest('.combo-list, .tbl');
      if (inner && inner.scrollTop > 0) return;
      active = true; startY = e.touches[0].clientY; dy = 0; startT = Date.now();
    };
    const onMove = (e: TouchEvent) => {
      if (!active) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      if (dy > 4) {
        el.classList.add('dragging');
        el.style.setProperty('--drag', `${dy}px`);
        if (e.cancelable) e.preventDefault();
      }
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      el.classList.remove('dragging');
      const fast = dy > 40 && Date.now() - startT < 250;
      if (dy > el.offsetHeight * 0.28 || fast) {
        el.style.setProperty('--drag', `${el.offsetHeight}px`);
        setTimeout(onClose, 200);
      } else el.style.setProperty('--drag', '0px');
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={dismissible ? onClose : undefined} aria-hidden="true" />
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-grab" aria-hidden="true"><span /></div>
        <div className="sheet-body" ref={bodyRef}>{children}</div>
      </div>
    </>,
    document.body,
  );
}
