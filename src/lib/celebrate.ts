/**
 * A small confetti burst out of the confirmation message, plus a light pop + shine on its text
 * (in the spirit of Outlook's celebration effects). Shapes are drawn with SVG — no emoji fonts —
 * so it looks the same on iPhone and Android. Skipped when the device asks for reduced motion.
 *
 * big = the day's goal was reached: a few more pieces and a soft ring.
 */
const COLORS = ['#F5B92E', '#3BC17A', '#FF6B8B', '#3DAAF2', '#FF8A3D', '#A78BFA'];
const SHAPES = [
  // heart
  '<path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.4 5c2 0 3.6 1.1 4.6 2.7C12 6.1 13.6 5 15.6 5 19 5 21 8.6 21.6 11.8 19.5 16.4 12 21 12 21z"/>',
  // star
  '<path d="M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z"/>',
  // dot
  '<circle cx="12" cy="12" r="8"/>',
  // ribbon strip
  '<rect x="8" y="2" width="8" height="20" rx="3"/>',
  // sparkle
  '<path d="M12 1.5l2.2 8.3 8.3 2.2-8.3 2.2L12 22.5l-2.2-8.3L1.5 12l8.3-2.2z"/>',
];

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function celebrate(big = false) {
  if (typeof document === 'undefined' || reduced()) return;
  // The toast renders in the same tick as the save; wait a frame so we can find it.
  requestAnimationFrame(() => requestAnimationFrame(() => burst(big)));
}

function burst(big: boolean) {
  const toast = document.querySelector<HTMLElement>('.toast');
  if (toast) toast.classList.add('cheer-pop');
  const r = toast?.getBoundingClientRect();
  const ox = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const oy = r ? r.top + r.height / 2 : window.innerHeight * 0.3;
  const halfW = r ? r.width / 2 : 80;

  const layer = document.createElement('div');
  layer.className = 'cheer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  if (big) {
    const ring = document.createElement('i');
    ring.className = 'cheer-ring';
    ring.style.left = `${ox}px`; ring.style.top = `${oy}px`;
    layer.appendChild(ring);
  }

  const n = big ? 18 : 12;
  let longest = 0;
  for (let i = 0; i < n; i++) {
    const size = 8 + Math.random() * 6;
    const color = COLORS[i % COLORS.length];
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const el = document.createElement('span');
    el.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}">${shape}</svg>`;
    // Start along the message box, fly out and a little up, then fall gently.
    const sx = ox + (Math.random() - 0.5) * halfW * 1.6;
    el.style.left = `${sx}px`; el.style.top = `${oy}px`;
    layer.appendChild(el);
    const side = sx < ox ? -1 : 1;
    const dx = side * (24 + Math.random() * 70);
    const up = -(18 + Math.random() * 34);
    const fall = 70 + Math.random() * 90;
    const spin = (Math.random() - 0.5) * 540;
    const dur = 1000 + Math.random() * 500;
    const delay = Math.random() * 120;
    longest = Math.max(longest, dur + delay);
    el.animate([
      { transform: 'translate(-50%, -50%) scale(.3) rotate(0deg)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${up}px)) scale(1) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${fall}px)) scale(.85) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: dur, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
  }
  window.setTimeout(() => layer.remove(), longest + 150);
}
