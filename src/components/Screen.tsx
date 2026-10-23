import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { DEMO_AUTH } from '../lib/config';

/**
 * Page wrapper: keeps content inside the safe area (notch, status bar, home indicator)
 * and adds an iOS-style swipe-from-left-edge to go back, which installed PWAs lack.
 */
export function Screen({
  children, back, onBack, right, center, className = '',
}: { children: ReactNode; back?: boolean; onBack?: () => void; right?: ReactNode; center?: boolean; className?: string }) {
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const goBack = onBack ?? (() => (history.length > 1 ? nav(-1) : nav('/')));

  useEffect(() => {
    if (!back) return;
    const el = ref.current;
    if (!el) return;
    let x0 = -1, y0 = 0, dx = 0;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t.clientX > 28) { x0 = -1; return; }
      x0 = t.clientX; y0 = t.clientY; dx = 0;
    };
    const move = (e: TouchEvent) => {
      if (x0 < 0) return;
      const t = e.touches[0];
      dx = t.clientX - x0;
      if (Math.abs(t.clientY - y0) > 40 && dx < 30) { x0 = -1; el.style.transform = ''; return; }
      if (dx > 0) el.style.transform = `translateX(${Math.min(dx * 0.5, 80)}px)`;
    };
    const end = () => {
      if (x0 < 0) return;
      el.style.transition = 'transform .2s';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 220);
      if (dx > 90) goBack();
      x0 = -1;
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end);
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); };
  });

  return (
    <div ref={ref} className={`screen screen-enter ${center ? 'center' : ''} ${className}`}>
      {back || right ? (
        <div className="topbar">
          {back ? (
            <button className="icon-btn" onClick={goBack} aria-label="Back"><Icon name="back" /></button>
          ) : <span />}
          {right}
        </div>
      ) : null}
      {children}
      {DEMO_AUTH ? <p className="demo-banner" style={{ marginTop: 'auto', paddingTop: 20 }}>Demo mode · no real accounts</p> : null}
    </div>
  );
}
