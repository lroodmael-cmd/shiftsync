import type { Exception, Occurrence, Schedule, Series } from "./types";
import { occurrenceId } from "./recurrence";
export function exceptionIndex(data: Schedule) {
  return new Map(
    data.exceptions.map((e) => [occurrenceId(e.seriesId, e.date), e]),
  );
}
export function putException(data: Schedule, value: Exception): Schedule {
  return {
    ...data,
    exceptions: [
      ...data.exceptions.filter(
        (e) => e.seriesId !== value.seriesId || e.date !== value.date,
      ),
      value,
    ],
  };
}
export function activeOverrides(data: Schedule, series: Series): Occurrence[] {
  return data.exceptions
    .filter(
      (e) =>
        e.seriesId === series.id &&
        e.override &&
        e.date >= series.rule.startDate &&
        (!series.rule.until || e.date <= series.rule.until),
    )
    .map((e) => ({
      ...e.override!,
      id: occurrenceId(series.id, e.date),
      seriesId: series.id,
      occurrenceDate: e.date,
      rule: series.rule,
    }));
}
