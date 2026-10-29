import { GENDERS, type Gender } from '../lib/auth';
import { PhoneInput, TextField } from './Form';
import { COUNTRIES, countryOfPhone, digitsOnly, toE164, validatePhone, type Country } from '../lib/validation';
import { COUNTRY_LIST, STATES_BY_COUNTRY } from '../lib/places';
import { ftInToCm } from '../lib/bmi';
import { ageOn } from '../lib/audience';
import { Picker } from './Picker';

export type Loc = { country: string; state: string; city: string };
export type Body = { height_cm: string; weight_kg: string };

export function validateLoc(l: Loc): string | null {
  if (!l.country) return 'Choose your country.';
  if (!l.state.trim()) return l.country === 'India' ? 'Choose your state.' : 'Enter your state, province or county.';
  return null;
}

export function validateBody(b: Body): string | null {
  const h = parseFloat(b.height_cm), w = parseFloat(b.weight_kg);
  if (b.height_cm && !(h >= 90 && h <= 250)) return 'Height should be between 90 and 250 cm.';
  if (b.weight_kg && !(w >= 20 && w <= 300)) return 'Weight should be between 20 and 300 kg.';
  return null;
}

export function LocationFields({ v, onChange }: { v: Loc; onChange: (v: Loc) => void }) {
  return (
    <div className="stack tight">
      <Picker label="Country" title="Choose your country" placeholder="Choose your country" value={v.country} onChange={(c) => onChange({ ...v, country: c, state: c === v.country ? v.state : '' })}
        options={COUNTRY_LIST.map((c) => ({ value: c, label: c }))} search />
      {STATES_BY_COUNTRY[v.country] ? (
        <Picker label={v.country === 'India' ? 'State / UT' : v.country === 'Canada' ? 'Province / territory' : 'State / region'} title="Choose your state" value={v.state}
          onChange={(st) => onChange({ ...v, state: st })} options={STATES_BY_COUNTRY[v.country].map((st) => ({ value: st, label: st }))} search />
      ) : v.country ? (
        <TextField label="State / province" autoComplete="address-level1" autoCapitalize="words" value={v.state} onChange={(e) => onChange({ ...v, state: e.target.value })} />
      ) : null}
      <TextField label="City or town" autoComplete="address-level2" autoCapitalize="words" placeholder="e.g. Ludhiana" value={v.city} onChange={(e) => onChange({ ...v, city: e.target.value })} />
    </div>
  );
}

const HEIGHTS = Array.from({ length: (7 - 4) * 12 + 1 }, (_, i) => 4 * 12 + i).map((inch) => {
  const ft = Math.floor(inch / 12), r = inch % 12, cm = ftInToCm(ft, r);
  return { value: String(cm), label: `${ft} ft ${r} in`, sub: `${cm} cm` };
});

/** Height from a list (feet and inches, with cm shown), weight in kg. Stored as cm and kg. */
export function BodyFields({ v, onChange }: { v: Body; onChange: (v: Body) => void }) {
  // Snap any stored cm to the nearest list entry so the picker shows it.
  const cur = v.height_cm ? HEIGHTS.reduce((best, h) => (Math.abs(+h.value - +v.height_cm) < Math.abs(+best.value - +v.height_cm) ? h : best), HEIGHTS[0]).value : '';
  return (
    <div className="stack tight">
      <Picker label="Height" title="Your height" value={cur} placeholder="Choose your height" onChange={(cm) => onChange({ ...v, height_cm: cm })} options={HEIGHTS} search={false} near={String(ftInToCm(5, 6))} />
      <TextField label="Weight (kg)" type="number" inputMode="decimal" step="0.1" placeholder="e.g. 70" value={v.weight_kg} onChange={(e) => onChange({ ...v, weight_kg: e.target.value })} />
      <p className="hint">Only you can see your height and weight. They’re never shared with admins or other members.</p>
    </div>
  );
}

/** Date of birth must give an age between 5 and 110. */
export function validateDob(dob: string): string | null {
  if (!dob) return 'Enter your date of birth.';
  const a = ageOn(dob);
  if (a === null || a < 5 || a > 110) return 'Check your date of birth.';
  return null;
}

/** Native date wheel on phones. Private: used only to show age-group challenges. */
export function DobField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const max = new Date(); max.setFullYear(max.getFullYear() - 5);
  const a = ageOn(value);
  return (
    <div className="field">
      <label htmlFor="dob">Date of birth</label>
      <input id="dob" className="input date-input" type="date" autoComplete="bday" min="1915-01-01" max={max.toISOString().slice(0, 10)}
        value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="hint">{a !== null && a >= 5 ? `You’re ${a}. ` : ''}Used only to show challenges for your age group. Never shared.</p>
    </div>
  );
}


/* ---------- mobile number: optional and private (sign-in is by email) ---------- */
export type Mobile = { country: Country; national: string };

/** Calling code for the member's country, e.g. "Canada" → +1 (CA). Falls back to India. */
export function countryForPlace(place?: string | null): Country {
  const alias: Record<string, string> = { 'United Arab Emirates': 'AE' };
  return COUNTRIES.find((c) => c.name === place || c.code === alias[place ?? '']) ?? COUNTRIES[0];
}

export function mobileFrom(e164: string | null | undefined, place?: string | null): Mobile {
  const c = e164 ? countryOfPhone(e164) : undefined;
  return c && e164 ? { country: c, national: e164.slice(c.dial.length) } : { country: countryForPlace(place), national: '' };
}

/** Empty is fine (it's optional); otherwise it must be a valid number. */
export function validateMobile(m: Mobile): string | null {
  return digitsOnly(m.national) ? validatePhone(m.country, m.national) : null;
}

export function mobileValue(m: Mobile): string | null {
  return digitsOnly(m.national) ? toE164(m.country, m.national) : null;
}

export function MobileField({ v, onChange, error }: { v: Mobile; onChange: (v: Mobile) => void; error?: string | null }) {
  return (
    <PhoneInput label="Mobile number (optional)" country={v.country} onCountry={(c) => onChange({ ...v, country: c })}
      value={v.national} onChange={(n) => onChange({ ...v, national: n })} error={error} />
  );
}

/* ---------- gender: required, three clear choices ---------- */
export function GenderField({ value, onChange, error }: { value: Gender | null | undefined; onChange: (g: Gender) => void; error?: boolean }) {
  return (
    <div className="field">
      <span className="label" id="gender-l">Gender</span>
      <div className={`seg gender-seg${error ? ' err' : ''}`} role="radiogroup" aria-labelledby="gender-l">
        {GENDERS.map((g) => (
          <button key={g.value} type="button" role="radio" aria-checked={value === g.value} aria-selected={value === g.value} onClick={() => onChange(g.value)}>{g.label}</button>
        ))}
      </div>
      <p className="hint">Only you and the admins can see this. Used for group stats.</p>
    </div>
  );
}
