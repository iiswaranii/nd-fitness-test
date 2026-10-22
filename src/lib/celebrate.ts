/**
 * Full-screen burst from the centre after a log.
 *  - celebrate(big): colourful confetti (hearts, stars, sparkles…) shoots out and falls with gravity.
 *  - commiserate(): a gentle shower of small sad faces and raindrops for a missed day.
 * Shapes are drawn with SVG — no emoji fonts — so iPhone and Android look identical.
 * Skipped when the device asks for reduced motion.
 */
const HAPPY = ['#F5B92E', '#3BC17A', '#FF6B8B', '#3DAAF2', '#FF8A3D', '#A78BFA'];
const FACE = ['#FFCC33', '#FFC21A', '#FFD54F', '#F9B90F'];
const DROPC = ['#7FB6E6', '#5FA3DD'];

const HEART = '<path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.4 5c2 0 3.6 1.1 4.6 2.7C12 6.1 13.6 5 15.6 5 19 5 21 8.6 21.6 11.8 19.5 16.4 12 21 12 21z"/>';
const STAR = '<path d="M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z"/>';
const DOT = '<circle cx="12" cy="12" r="8"/>';
const STRIP = '<rect x="8" y="2" width="8" height="20" rx="3"/>';
const SPARK = '<path d="M12 1.5l2.2 8.3 8.3 2.2-8.3 2.2L12 22.5l-2.2-8.3L1.5 12l8.3-2.2z"/>';
const SADFACE = '<circle cx="12" cy="12" r="10.5"/><circle cx="8.4" cy="10" r="1.4" fill="#1F2A37"/><circle cx="15.6" cy="10" r="1.4" fill="#1F2A37"/><path d="M8 17.2c1.1-1.6 2.5-2.3 4-2.3s2.9.7 4 2.3" fill="none" stroke="#1F2A37" stroke-width="1.6" stroke-linecap="round"/>';
const DROP = '<path d="M12 2.5C9 7 6 10.4 6 14a6 6 0 0 0 12 0c0-3.6-3-7-6-11.5z"/>';

/** Many Android phones turn on “reduce motion” with battery saver, so we don't skip — we just play a lighter version. */
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const canAnimate = () => typeof document !== 'undefined' && typeof Element !== 'undefined' && 'animate' in Element.prototype;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function layer() {
  const el = document.createElement('div');
  el.className = 'cheer';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  return el;
}

function piece(root: HTMLElement, shape: string, color: string, size: number, x: number, y: number) {
  const el = document.createElement('span');
  el.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}">${shape}</svg>`;
  // Centre on (x, y) with plain pixels — no calc()/percent inside animated transforms (older Android WebViews).
  el.style.left = `${x - size / 2}px`; el.style.top = `${y - size / 2}px`;
  el.style.width = `${size}px`; el.style.height = `${size}px`;
  root.appendChild(el);
  return el;
}

/** Path of a thrown piece: x = vx·t, y = vy·t + g·t² (sampled into keyframes). */
function arc(vx: number, vy: number, g: number, spin: number, steps = 8): Keyframe[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const x = vx * t, y = vy * t + g * t * t;
    return {
      transform: `translate(${x}px, ${y}px) rotate(${spin * t}deg) scale(${i === 0 ? 0.3 : 1})`,
      opacity: i === 0 ? 0 : t > 0.75 ? (1 - t) * 4 : 1,
      offset: t,
    };
  });
}

function popToast() {
  document.querySelector<HTMLElement>('.toast')?.classList.add('cheer-pop');
}

export function celebrate(big = false) {
  if (!canAnimate()) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    popToast();
    const W = window.innerWidth, H = window.innerHeight;
    const cx = W / 2, cy = H * 0.45;
    const root = layer();
    if (big) {
      const ring = document.createElement('i');
      ring.className = 'cheer-ring';
      ring.style.left = `${cx}px`; ring.style.top = `${cy}px`;
      root.appendChild(ring);
    }
    const shapes = [HEART, STAR, DOT, STRIP, SPARK, HEART, STAR];
    const n = Math.round((big ? 54 : 40) * (reduced() ? 0.5 : 1));
    const reach = Math.max(W, H) * 0.55;
    let longest = 0;
    for (let i = 0; i < n; i++) {
      const el = piece(root, shapes[i % shapes.length], HAPPY[i % HAPPY.length], rnd(14, 26), cx, cy);
      const ang = rnd(0, Math.PI * 2);
      const sp = rnd(0.45, 1) * reach;
      const dur = rnd(1500, 2300), delay = rnd(0, 140);
      longest = Math.max(longest, dur + delay);
      el.animate(arc(Math.cos(ang) * sp, Math.sin(ang) * sp - reach * 0.35, H * 0.55, rnd(-540, 540)),
        { duration: dur, delay, easing: 'cubic-bezier(.15,.6,.35,1)', fill: 'both' });
    }
    window.setTimeout(() => root.remove(), longest + 150);
  }));
}

export function commiserate() {
  if (!canAnimate()) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const W = window.innerWidth, H = window.innerHeight;
    const cx = W / 2, cy = H * 0.42;
    const root = layer();
    const n = reduced() ? 12 : 22;
    let longest = 0;
    for (let i = 0; i < n; i++) {
      const face = i % 3 !== 2;
      const el = piece(root, face ? SADFACE : DROP, face ? FACE[i % FACE.length] : DROPC[i % DROPC.length], face ? rnd(20, 30) : rnd(12, 18), cx, cy);
      // A soft puff outwards, then a slow, swaying drift down.
      const ang = rnd(0, Math.PI * 2);
      const sp = rnd(0.25, 0.5) * W;
      const ox = Math.cos(ang) * sp, oy = Math.sin(ang) * sp * 0.6;
      const sway = rnd(12, 26) * (Math.random() < 0.5 ? -1 : 1);
      const down = H * rnd(0.35, 0.55);
      const dur = rnd(2200, 3000), delay = rnd(0, 250);
      longest = Math.max(longest, dur + delay);
      el.animate([
        { transform: 'translate(0px, 0px) rotate(0deg) scale(.3)', opacity: 0 },
        { transform: `translate(${ox}px, ${oy}px) rotate(0deg) scale(1)`, opacity: 0.95, offset: 0.22 },
        { transform: `translate(${ox + sway}px, ${oy + down * 0.45}px) rotate(${sway / 2}deg) scale(1)`, opacity: 0.9, offset: 0.6 },
        { transform: `translate(${ox - sway}px, ${oy + down}px) rotate(${-sway / 2}deg) scale(1)`, opacity: 0 },
      ], { duration: dur, delay, easing: 'ease-out', fill: 'both' });
    }
    window.setTimeout(() => root.remove(), longest + 150);
  }));
}
