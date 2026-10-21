export type Shift = { id: string; title: string; startAt: string; endAt: string; color: string };
export function validateShift(shift: Pick<Shift, 'title' | 'startAt' | 'endAt'>) {
  if (!shift.title.trim()) return 'Give this shift a name.';
  const start = new Date(shift.startAt).getTime();
  const end = new Date(shift.endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'End must be after start.';
  if (end - start > 36 * 60 * 60 * 1000) return 'A shift cannot exceed 36 hours.';
  return null;
}
export function overlaps(a: Shift, b: Shift) {
  return new Date(a.startAt).getTime() < new Date(b.endAt).getTime() && new Date(b.startAt).getTime() < new Date(a.endAt).getTime();
}
export function conflicts(shifts: Shift[], candidate: Shift) {
  return shifts.filter(s => s.id !== candidate.id && overlaps(s, candidate));
}
