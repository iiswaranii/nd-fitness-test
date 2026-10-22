import { flagOf } from '../lib/flags';

/** Small country flag shown after a member's name. Nothing when the country is unknown. */
export function Flag({ country }: { country: string | null | undefined }) {
  const f = flagOf(country);
  if (!f) return null;
  return <span className="flag" role="img" aria-label={country ?? ''} title={country ?? ''}>{f}</span>;
}
