/**
 * A quiet burst of small emojis that float up from the bottom of the screen and fade.
 * Plain DOM (no React state), so it outlives the sheet that triggered it.
 * Skipped when the device asks for reduced motion.
 */
const SETS = {
  log: ['❤️', '💚', '💛', '✨', '⭐', '👏', '💪', '🎉'],
  move: ['❤️', '🧡', '✨', '⭐', '👏', '💪', '🔥', '🎉'],
} as const;

export function celebrate(kind: keyof typeof SETS = 'log', count = 26) {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const set = SETS[kind];
  const layer = document.createElement('div');
  layer.className = 'cheer';
  layer.setAttribute('aria-hidden', 'true');
  let longest = 0;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.textContent = set[Math.floor(Math.random() * set.length)];
    const dur = 1700 + Math.random() * 1300;
    const delay = Math.random() * 450;
    longest = Math.max(longest, dur + delay);
    s.style.left = `${4 + Math.random() * 92}%`;
    s.style.fontSize = `${13 + Math.random() * 11}px`;
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 70}px`);
    s.style.setProperty('--rise', `${38 + Math.random() * 34}vh`);
    s.style.setProperty('--rot', `${(Math.random() - 0.5) * 40}deg`);
    s.style.animationDuration = `${dur}ms`;
    s.style.animationDelay = `${delay}ms`;
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), longest + 200);
}
