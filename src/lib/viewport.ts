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
