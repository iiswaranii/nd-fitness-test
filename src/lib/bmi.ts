/**
 * BMI with the cut-offs recommended for Indian and other South Asian adults
 * (Indian consensus guidelines / WHO Asia-Pacific): risk starts at lower BMI than the global 25/30.
 */
export const BMI_BANDS = [
  { max: 18.5, label: 'Underweight', color: 'var(--ride)', meaning: 'Below the healthy range. Eating enough protein and calories, and talking to a doctor, can help.' },
  { max: 23, label: 'Healthy', color: 'var(--good)', meaning: 'You’re in the healthy range. Keep up your activity and good habits!' },
  { max: 25, label: 'Overweight', color: 'var(--warn)', meaning: 'A little above the healthy range. Daily walks and small food changes make a real difference.' },
  { max: Infinity, label: 'Obese', color: 'var(--bad)', meaning: 'Above the healthy range, which raises the risk of diabetes and heart disease. A doctor can help you plan safe steps.' },
] as const;

export function bmi(heightCm: number | null | undefined, weightKg: number | null | undefined): number | null {
  if (!heightCm || !weightKg || heightCm < 90 || weightKg < 20) return null;
  const m = heightCm / 100;
  return +(weightKg / (m * m)).toFixed(1);
}

export const bandOf = (v: number) => BMI_BANDS.find((b) => v < b.max) ?? BMI_BANDS[BMI_BANDS.length - 1];

/** Weight range (kg) that puts this height in the healthy band. */
export function healthyRange(heightCm: number): [number, number] {
  const m2 = (heightCm / 100) ** 2;
  return [Math.round(18.5 * m2), Math.round(22.9 * m2)];
}

export const cmToFtIn = (cm: number) => { const inch = Math.round(cm / 2.54); return { ft: Math.floor(inch / 12), inch: inch % 12 }; };
export const ftInToCm = (ft: number, inch: number) => Math.round((ft * 12 + inch) * 2.54);
