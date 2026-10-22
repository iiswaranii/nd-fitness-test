import icon from '../assets/app-icon.svg?raw';

/** The app icon (pink ring, green progress arc, “NFC”), drawn inline so it stays sharp at any size. */
export function BrandMark({ size = 88 }: { size?: number }) {
  return (
    <span className="brand-mark" role="img" aria-label="Namdhari Fitness Connect"
      style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: icon.replace('<svg ', `<svg width="${size}" height="${size}" aria-hidden="true" `) }} />
  );
}
