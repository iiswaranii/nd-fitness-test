/** Tracks the on-screen keyboard so fixed sheets and footers stay visible above it. */
export function watchKeyboard(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}

/** When a field gets focus behind the keyboard, bring it into view. */
export function keepFocusedFieldVisible(): void {
  document.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement;
    if (!t.matches?.('input, textarea, select')) return;
    setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });
}

/**
 * iOS sometimes leaves the whole window shifted after the keyboard closes (or after a fast fling),
 * which drags fixed bars up the screen. The app shell never needs the window scrolled, so put it back.
 */
export function pinWindow(): void {
  const typing = () => !!(document.activeElement as HTMLElement | null)?.matches?.('input, textarea, select, [contenteditable="true"]');
  // Never while typing: the phone may move the window to keep the field above the keyboard.
  const reset = () => { if (!typing() && document.querySelector('.app') && (window.scrollY !== 0 || window.scrollX !== 0)) window.scrollTo(0, 0); };
  document.addEventListener('focusout', () => setTimeout(reset, 50));
  window.addEventListener('scroll', reset, { passive: true });
  window.visualViewport?.addEventListener('resize', () => setTimeout(reset, 50));
  window.addEventListener('orientationchange', () => setTimeout(reset, 300));
}

/**
 * No pinch-zoom anywhere in the app (it should feel like a native app).
 * Android/Chrome obey the viewport meta; iPhone Safari ignores user-scalable=no, so we also stop
 * its gesture events and two-finger moves. Single-finger scrolling is untouched.
 */
export function blockZoom(): void {
  const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, stop, { passive: false }));
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) stop(e); }, { passive: false });
  // Double-tap zoom is turned off in CSS (touch-action), which keeps fast repeated taps working.
}
