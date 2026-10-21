import { Temporal } from "@js-temporal/polyfill";
import type { Occurrence, RepeatSettings, Series, WorkShift } from "./types";
import { noCommute } from "./types";
import { dateInZone, instant, shiftDate, zonedLocal } from "./time";
export const occurrenceId = (seriesId: string, date: string) =>
  `${seriesId}@${date}`;
export function matches(series: Series, date: string) {
  return (
    date >= series.rule.startDate &&
    (!series.rule.until || date <= series.rule.until) &&
    (series.rule.frequency === "daily" ||
      series.rule.weekdays.includes(Temporal.PlainDate.from(date).dayOfWeek))
  );
}
export function occurrence(series: Series, date: string): Occurrence {
  const startAt = instant(`${date}T${series.startTime}`, series.rule.timeZone);
  let endAt = instant(
    `${shiftDate(date, series.endDayOffset)}T${series.endTime}`,
    series.rule.timeZone,
  );
  // A spring gap can collapse a short wall-clock interval. Preserve its nominal duration in that case.
  if (+new Date(endAt) <= +new Date(startAt)) {
    const nominal = Temporal.PlainDateTime.from(
      `2000-01-01T${series.startTime}`,
    )
      .until(
        Temporal.PlainDateTime.from(
          `${shiftDate("2000-01-01", series.endDayOffset)}T${series.endTime}`,
        ),
      )
      .total("minutes");
    endAt = new Date(+new Date(startAt) + nominal * 60000).toISOString();
  }
  return {
    id: occurrenceId(series.id, date),
    seriesId: series.id,
    occurrenceDate: date,
    rule: series.rule,
    title: series.title,
    color: series.color,
    startAt,
    endAt,
    commute: series.commute,
  };
}
export function seriesFromDraft(
  draft: WorkShift,
  repeat: RepeatSettings,
  id: string,
): Series {
  const start = Temporal.PlainDateTime.from(
    repeat.startLocal ?? zonedLocal(draft.startAt, repeat.timeZone),
  );
  const end = Temporal.PlainDateTime.from(
    repeat.endLocal ?? zonedLocal(draft.endAt, repeat.timeZone),
  );
  const endDayOffset = start.toPlainDate().until(end.toPlainDate()).days;
  const nominal = start.until(end).total("hours");
  if (nominal <= 0 || nominal > 36)
    throw Error(
      "A recurring shift must last between 0 and 36 wall-clock hours.",
    );
  if (repeat.until && repeat.until < start.toPlainDate().toString())
    throw Error("Repeat until must be on or after the first shift date.");
  if (repeat.frequency === "weekly" && !repeat.weekdays.length)
    throw Error("Select at least one weekday.");
  return {
    id,
    title: draft.title,
    color: draft.color,
    startTime: start.toPlainTime().toString({ smallestUnit: "minute" }),
    endTime: end.toPlainTime().toString({ smallestUnit: "minute" }),
    endDayOffset,
    commute: draft.commute ?? noCommute,
    rule: {
      frequency: repeat.frequency === "daily" ? "daily" : "weekly",
      startDate: start.toPlainDate().toString(),
      until: repeat.until || undefined,
      weekdays: [...repeat.weekdays],
      timeZone: repeat.timeZone,
    },
  };
}
// Expand dates around the requested interval only. Padding covers night work and a 12h commute on either side.
export function datesForPeriod(series: Series, from: Date, to: Date) {
  let date = shiftDate(dateInZone(from, series.rule.timeZone), -3);
  const last = shiftDate(dateInZone(to, series.rule.timeZone), 1);
  if (date < series.rule.startDate) date = series.rule.startDate;
  const dates: string[] = [];
  while (date <= last && (!series.rule.until || date <= series.rule.until)) {
    if (matches(series, date)) dates.push(date);
    date = shiftDate(date, 1);
  }
  return dates;
}
