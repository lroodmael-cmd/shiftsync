import { validateShift, type Shift } from './shifts';
export const SHIFT_KEY = 'shiftsync:v1:shifts';
export const THEME_KEY = 'shiftsync:v1:theme';
export function decodeShifts(raw: string | null): Shift[] {
 const data: unknown = JSON.parse(raw ?? '[]');
 if (!Array.isArray(data)) throw new Error('Invalid saved schedule.');
 const ids = new Set<string>();
 return data.map((s: unknown) => {
  if (!s || typeof s !== 'object') throw new Error('Invalid saved shift.');
  const v = s as Shift;
  if (typeof v.id !== 'string' || !v.id || ids.has(v.id) || typeof v.title !== 'string' || typeof v.startAt !== 'string' || typeof v.endAt !== 'string' || typeof v.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(v.color) || validateShift(v)) throw new Error('Invalid saved shift.');
  ids.add(v.id); return v;
 });
}
