import { overlaps } from "../shifts";
import { calendarEvents, withCommutes } from "./commute";
import type { CalendarEvent, Occurrence, Schedule } from "./types";
export function conflictsForOccurrence(
  data: Schedule,
  candidate: Occurrence,
): CalendarEvent[] {
  const proposed = withCommutes([candidate]);
  const from = new Date(Math.min(...proposed.map((e) => +new Date(e.startAt))));
  const to = new Date(Math.max(...proposed.map((e) => +new Date(e.endAt))));
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || +to <= +from)
    return [];
  return calendarEvents(data, from, to).filter(
    (e) => e.work.id !== candidate.id && proposed.some((p) => overlaps(e, p)),
  );
}
