import type { Shift } from "./shifts";
export function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}
export function daySegments<T extends Shift>(shifts: T[], day: Date) {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = addDays(from, 1);
  return shifts
    .filter((s) => new Date(s.startAt) < to && new Date(s.endAt) > from)
    .map((shift) => {
      const start = new Date(Math.max(+new Date(shift.startAt), +from));
      const end = new Date(Math.min(+new Date(shift.endAt), +to));
      const top = ((start.getHours() * 60 + start.getMinutes()) / 1440) * 100;
      const bottom =
        +end === +to
          ? 100
          : ((end.getHours() * 60 + end.getMinutes()) / 1440) * 100;
      return { shift, start, end, top, height: Math.max(1, bottom - top) };
    })
    .sort((a, b) => +a.start - +b.start);
}

// Allocate stable lanes within connected overlap groups, including chained overlaps.
export function layoutSegments<T extends Shift>(shifts: T[], day: Date) {
  const segments = daySegments(shifts, day);
  const result: ((typeof segments)[number] & {
    column: number;
    columns: number;
  })[] = [];
  let group: typeof result = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  function flush() {
    const columns = laneEnds.length;
    for (const segment of group) result.push({ ...segment, columns });
    group = [];
    laneEnds = [];
  }
  for (const segment of segments) {
    if (+segment.start >= groupEnd) {
      flush();
      groupEnd = -Infinity;
    }
    let column = laneEnds.findIndex((end) => end <= +segment.start);
    if (column < 0) column = laneEnds.length;
    laneEnds[column] = +segment.end;
    groupEnd = Math.max(groupEnd, +segment.end);
    group.push({ ...segment, column, columns: 0 });
  }
  flush();
  return result;
}
