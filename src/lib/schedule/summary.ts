import { addDays, startOfWeek } from "../calendar";
import { dashboard } from "../dashboard";
import type { Schedule } from "./types";
import { expandSchedule, nextInSeries } from "./occurrences";
import { occurrence } from "./recurrence";
export function scheduleSummary(data: Schedule, now: Date) {
  const week = startOfWeek(now),
    today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const work = expandSchedule(data, week, addDays(week, 7));
  const base = dashboard(work, now);
  const next = [
    ...data.singles.filter((s) => +new Date(s.endAt) > +now),
    ...data.series.flatMap((s) => {
      const value = nextInSeries(data, s, now);
      return value ? [value] : [];
    }),
  ].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))[0];
  let free: Date | null = null;
  for (let i = 0; i < 366; i++) {
    const day = addDays(today, i);
    if (!expandSchedule(data, day, addDays(day, 1)).length) {
      free = day;
      break;
    }
  }
  return {
    ...base,
    next,
    free,
    events: expandSchedule(data, today, addDays(today, 1)),
  };
}
export function listOccurrences(data: Schedule, now: Date) {
  const week = startOfWeek(now);
  const list = [
    ...data.singles,
    ...expandSchedule(data, week, addDays(week, 7)),
    ...data.series.flatMap((s) => {
      const next = nextInSeries(data, s, now);
      return next ? [next] : [];
    }),
  ];
  // A finished series still has an editable representative (unless every occurrence was explicitly deleted).
  for (const series of data.series) {
    if (!list.some((s) => "seriesId" in s && s.seriesId === series.id)) {
      const start = new Date(`${series.rule.startDate}T00:00:00Z`);
      const first = expandSchedule(
        data,
        new Date(+start - 86400000),
        new Date(+start + 9 * 86400000),
      ).find((s) => s.seriesId === series.id);
      list.push(
        first ?? {
          ...occurrence(series, series.rule.startDate),
          seriesOnly: true,
        },
      );
    }
  }
  return [...new Map(list.map((s) => [s.id, s])).values()].sort(
    (a, b) => +new Date(a.startAt) - +new Date(b.startAt),
  );
}
