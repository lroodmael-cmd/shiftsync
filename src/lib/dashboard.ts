import type { Shift } from "./shifts";
import { addDays, startOfWeek } from "./calendar";
export function dashboard(shifts: Shift[], now: Date) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const week = startOfWeek(now),
    end = addDays(week, 7);
  const sorted = [...shifts].sort(
    (a, b) => +new Date(a.startAt) - +new Date(b.startAt),
  );
  const next = sorted.find((s) => +new Date(s.endAt) > +now);
  const hours = shifts.reduce(
    (total, s) =>
      total +
      Math.max(
        0,
        Math.min(+new Date(s.endAt), +end) -
          Math.max(+new Date(s.startAt), +week),
      ) /
        3600000,
    0,
  );
  const events = sorted.filter(
    (s) =>
      +new Date(s.startAt) < +addDays(today, 1) && +new Date(s.endAt) > +today,
  );
  let free = today;
  while (
    shifts.some(
      (s) =>
        +new Date(s.startAt) < +addDays(free, 1) && +new Date(s.endAt) > +free,
    )
  )
    free = addDays(free, 1);
  return { next, hours, events, free };
}
export function countdown(startAt: string, now: Date) {
  const minutes = Math.max(0, Math.ceil((+new Date(startAt) - +now) / 60000));
  if (!minutes) return "In progress";
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    mins = minutes % 60;
  return `${days ? `${days}d ` : ""}${hours}h ${mins}m`;
}
