import type { Schedule, Occurrence, Series } from "./types";
import { datesForPeriod, matches, occurrence } from "./recurrence";
import { dateInZone, shiftDate } from "./time";
import { activeOverrides, exceptionIndex } from "./exceptions";
const intersects = (s: Occurrence, from: Date, to: Date) =>
  +new Date(s.startAt) < +to && +new Date(s.endAt) > +from;
export function expandSchedule(
  data: Schedule,
  from: Date,
  to: Date,
): Occurrence[] {
  if (
    !Number.isFinite(+from) ||
    !Number.isFinite(+to) ||
    +to <= +from ||
    +to - +from > 400 * 86400000
  )
    throw Error("Invalid occurrence query period (maximum 400 days).");
  const output: Occurrence[] = data.singles.filter((s) =>
    intersects(s, from, to),
  );
  const exceptions = exceptionIndex(data);
  for (const series of data.series) {
    for (const date of datesForPeriod(series, from, to)) {
      const key = `${series.id}@${date}`,
        exception = exceptions.get(key);
      if (exception) continue; // Overrides are checked independently, including moves into/out of the requested window.
      const value = occurrence(series, date);
      if (intersects(value, from, to)) output.push(value);
    }
    for (const value of activeOverrides(data, series)) {
      if (intersects(value, from, to)) output.push(value);
    }
  }
  return output.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
}
export function nextInSeries(
  data: Schedule,
  series: Series,
  now: Date,
): Occurrence | undefined {
  const exceptions = data.exceptions.filter((e) => e.seriesId === series.id);
  const overrides = activeOverrides(data, series).filter(
    (s) => +new Date(s.endAt) > +now,
  );
  let date = shiftDate(dateInZone(now, series.rule.timeZone), -2);
  if (date < series.rule.startDate) date = series.rule.startDate;
  let next: Occurrence | undefined;
  // At least one weekly match in seven days; only explicit exceptions can postpone it further.
  for (
    let i = 0;
    i < (exceptions.length + 2) * 7 + 7;
    i++, date = shiftDate(date, 1)
  ) {
    if (series.rule.until && date > series.rule.until) break;
    if (!matches(series, date) || exceptions.some((e) => e.date === date))
      continue;
    const value = occurrence(series, date);
    if (+new Date(value.endAt) > +now) {
      next = value;
      break;
    }
  }
  return [...overrides, ...(next ? [next] : [])].sort(
    (a, b) => +new Date(a.startAt) - +new Date(b.startAt),
  )[0];
}
