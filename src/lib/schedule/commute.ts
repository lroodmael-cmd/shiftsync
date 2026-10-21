import type { CalendarEvent, Occurrence, Schedule } from "./types";
import { expandSchedule } from "./occurrences";
export function withCommutes(shifts: Occurrence[]): CalendarEvent[] {
  return shifts.flatMap((work) => {
    const events: CalendarEvent[] = [{ ...work, kind: "work", work }];
    if (work.commute?.beforeMinutes)
      events.push({
        id: `${work.id}::before`,
        kind: "before",
        work,
        title: `Commute to ${work.title}`,
        color: "#147d80",
        startAt: new Date(
          +new Date(work.startAt) - work.commute.beforeMinutes * 60000,
        ).toISOString(),
        endAt: work.startAt,
      });
    if (work.commute?.afterMinutes)
      events.push({
        id: `${work.id}::after`,
        kind: "after",
        work,
        title: `Commute from ${work.title}`,
        color: "#147d80",
        startAt: work.endAt,
        endAt: new Date(
          +new Date(work.endAt) + work.commute.afterMinutes * 60000,
        ).toISOString(),
      });
    return events;
  });
}
export function calendarEvents(data: Schedule, from: Date, to: Date) {
  const work = expandSchedule(
    data,
    new Date(+from - 12 * 3600000),
    new Date(+to + 12 * 3600000),
  );
  return withCommutes(work).filter(
    (e) => +new Date(e.startAt) < +to && +new Date(e.endAt) > +from,
  );
}
