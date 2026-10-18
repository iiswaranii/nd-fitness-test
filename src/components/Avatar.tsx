export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const ini = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <span className="avatar" style={{ ['--s' as string]: `${size}px`, background: `hsl(${h} 42% 46%)` }} aria-hidden="true">
      {ini}
    </span>
  );
}
