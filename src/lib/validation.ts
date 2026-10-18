export type Country = { code: string; dial: string; name: string; min: number; max: number; pattern?: RegExp };

const MAIN: Country[] = [
  { code: 'IN', dial: '+91', name: 'India', min: 10, max: 10, pattern: /^[6-9]\d{9}$/ },
  { code: 'GB', dial: '+44', name: 'United Kingdom', min: 10, max: 10 },
  { code: 'CA', dial: '+1', name: 'Canada', min: 10, max: 10 },
  { code: 'US', dial: '+1', name: 'United States', min: 10, max: 10 },
  { code: 'AU', dial: '+61', name: 'Australia', min: 9, max: 9 },
  { code: 'NZ', dial: '+64', name: 'New Zealand', min: 8, max: 10 },
  { code: 'AE', dial: '+971', name: 'UAE', min: 9, max: 9 },
  { code: 'KE', dial: '+254', name: 'Kenya', min: 9, max: 9 },
];
// Every other country: ISO code + calling code. Numbers are checked loosely (6–13 digits).
const DIAL = 'AF93 AL355 DZ213 AD376 AO244 AG1 AR54 AM374 AT43 AZ994 BS1 BH973 BD880 BB1 BY375 BE32 BZ501 BJ229 BT975 BO591 BA387 BW267 BR55 BN673 BG359 BF226 BI257 KH855 CM237 CV238 CF236 TD235 CL56 CN86 CO57 KM269 CG242 CD243 CR506 CI225 HR385 CU53 CY357 CZ420 DK45 DJ253 DM1 DO1 EC593 EG20 SV503 GQ240 ER291 EE372 SZ268 ET251 FJ679 FI358 FR33 GA241 GM220 GE995 DE49 GH233 GR30 GD1 GT502 GN224 GW245 GY592 HT509 HN504 HK852 HU36 IS354 ID62 IR98 IQ964 IE353 IL972 IT39 JM1 JP81 JO962 KZ7 KI686 KW965 KG996 LA856 LV371 LB961 LS266 LR231 LY218 LI423 LT370 LU352 MO853 MG261 MW265 MY60 MV960 ML223 MT356 MH692 MR222 MU230 MX52 FM691 MD373 MC377 MN976 ME382 MA212 MZ258 MM95 NA264 NR674 NP977 NL31 NI505 NE227 NG234 KP850 MK389 NO47 OM968 PK92 PW680 PS970 PA507 PG675 PY595 PE51 PH63 PL48 PT351 QA974 RO40 RU7 RW250 KN1 LC1 VC1 WS685 SM378 ST239 SA966 SN221 RS381 SC248 SL232 SG65 SK421 SI386 SB677 SO252 ZA27 KR82 SS211 ES34 LK94 SD249 SR597 SE46 CH41 SY963 TW886 TJ992 TZ255 TH66 TL670 TG228 TO676 TT1 TN216 TR90 TM993 TV688 UG256 UA380 UY598 UZ998 VU678 VA39 VE58 VN84 YE967 ZM260 ZW263';
const regionName = (() => {
  try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); return (c: string) => dn.of(c) ?? c; }
  catch { return (c: string) => c; }
})();
const OTHERS: Country[] = DIAL.split(' ')
  .map((t) => ({ code: t.slice(0, 2), dial: '+' + t.slice(2), name: regionName(t.slice(0, 2)), min: 6, max: 13 }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Calling codes: where most members live first, then every country A–Z (searchable). */
export const COUNTRIES: Country[] = [...MAIN, ...OTHERS];

export type Identifier = { kind: 'email'; email: string } | { kind: 'phone'; phone: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

export function validateEmail(v: string): string | null {
  const e = normalizeEmail(v);
  if (!e) return 'Enter your email address.';
  if (!EMAIL_RE.test(e)) return 'That doesn’t look like a valid email address.';
  return null;
}

/** Keeps digits only and drops a leading trunk 0 (e.g. 098765… → 98765…). */
export function digitsOnly(v: string): string {
  return v.replace(/\D/g, '').replace(/^0+/, '');
}

export function validatePhone(country: Country, national: string): string | null {
  const d = digitsOnly(national);
  if (!d) return 'Enter your mobile number.';
  if (d.length < country.min || d.length > country.max)
    return country.min === country.max
      ? `${country.name} mobile numbers have ${country.min} digits.`
      : `Enter ${country.min}–${country.max} digits.`;
  if (country.pattern && !country.pattern.test(d)) return 'That doesn’t look like a valid mobile number.';
  return null;
}

export function toE164(country: Country, national: string): string {
  return country.dial + digitsOnly(national);
}

export function maskIdentifier(id: Identifier): string {
  if (id.kind === 'email') {
    const [u, d] = id.email.split('@');
    return (u.length <= 2 ? u[0] + '•' : u.slice(0, 2) + '•'.repeat(Math.min(5, u.length - 2))) + '@' + d;
  }
  const p = id.phone;
  return p.slice(0, p.length - 10 > 0 ? p.length - 10 : 3) + ' ••••• ' + p.slice(-4);
}

export type PasswordCheck = { id: string; label: string; ok: boolean };

export function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { id: 'len', label: '8+ characters', ok: pw.length >= 8 },
    { id: 'letter', label: 'A letter', ok: /[A-Za-z]/.test(pw) },
    { id: 'num', label: 'A number', ok: /\d/.test(pw) },
    { id: 'space', label: 'No spaces', ok: pw.length > 0 && !/\s/.test(pw) },
  ];
}

export function passwordValid(pw: string): boolean {
  return passwordChecks(pw).every((c) => c.ok);
}

export function validateName(v: string): string | null {
  const n = v.trim();
  if (!n) return 'Enter your name.';
  if (n.length < 2) return 'Name is too short.';
  return null;
}

/** "+919876543210" → "+91 98765 43210" for display. */
/** Longest matching calling code wins (+1 vs +1xxx, +44 vs +4…). */
export function countryOfPhone(e164: string): Country | undefined {
  return [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((x) => e164.startsWith(x.dial));
}

export function formatPhone(e164: string): string {
  const c = countryOfPhone(e164);
  if (!c) return e164;
  const n = e164.slice(c.dial.length);
  const mid = Math.ceil(n.length / 2);
  return `${c.dial} ${n.slice(0, mid)} ${n.slice(mid)}`;
}
