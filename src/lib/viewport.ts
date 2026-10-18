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

/**
 * iPhone Home Screen apps on some iOS versions report a page shorter than the screen (by about the
 * status-bar height), so bars fixed to the bottom float above a blank strip. Measure that gap and
 * expose it as --vgap. Only for iOS standalone; Android's screen size includes its system bars.
 */
export function fixStandaloneGap(): void {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!ios || !standalone) return;
  const update = () => {
    const portrait = window.innerHeight > window.innerWidth;
    const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    const kbOpen = !!window.visualViewport && window.innerHeight - window.visualViewport.height > 80;
    const gap = screenH - window.innerHeight;
    const v = !kbOpen && gap > 8 && gap < 100 ? gap : 0;
    document.documentElement.style.setProperty('--vgap', `${v}px`);
  };
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => setTimeout(update, 300));
}

/** When a field gets focus behind the keyboard, bring it into view. */
export function keepFocusedFieldVisible(): void {
  document.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement;
    if (!t.matches?.('input, textarea, select')) return;
    setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });
}
