import type {
  Occurrence,
  RepeatSettings,
  Schedule,
  Scope,
  WorkShift,
} from "./types";
import { seriesFromDraft } from "./recurrence";
import { shiftDate, zonedLocal } from "./time";
import { putException } from "./exceptions";
export function saveShift<T extends Schedule>(
  data: T,
  draft: WorkShift,
  repeat: RepeatSettings,
  original?: Occurrence,
  scope: Scope = "only",
): T {
  if (!original?.seriesId) {
    const singles = data.singles.filter((s) => s.id !== draft.id);
    return repeat.frequency === "none"
      ? { ...data, singles: [...singles, draft] }
      : {
          ...data,
          singles,
          series: [...data.series, seriesFromDraft(draft, repeat, draft.id)],
        };
  }
  const source = data.series.find((s) => s.id === original.seriesId);
  if (!source || !original.occurrenceDate)
    throw Error("This series no longer exists. Reload your schedule.");
  if (scope === "only")
    return putException(data, {
      seriesId: source.id,
      date: original.occurrenceDate,
      override: draft,
    });
  const boundary = original.occurrenceDate;
  if (scope === "all") {
    const series =
      repeat.frequency === "none"
        ? undefined
        : seriesFromDraft(draft, { ...repeat, until: undefined }, source.id);
    if (series) {
      series.rule.startDate = source.rule.startDate;
      series.rule.until = repeat.until || undefined;
      if (series.rule.until && series.rule.until < series.rule.startDate)
        throw Error("Repeat until is before the series start.");
    }
    return {
      ...data,
      series: data.series.flatMap((s) =>
        s.id !== source.id ? [s] : series ? [series] : [],
      ),
      singles: series
        ? data.singles
        : [...data.singles, { ...draft, id: source.id }],
      exceptions: series
        ? data.exceptions.filter(
            (e) =>
              e.seriesId !== source.id ||
              (e.date !== boundary &&
                (!series.rule.until || e.date <= series.rule.until)),
          )
        : data.exceptions.filter((e) => e.seriesId !== source.id),
    };
  }
  const nextDate = (
    (repeat.frequency === "none" ? undefined : repeat.startLocal) ??
    zonedLocal(draft.startAt, repeat.timeZone)
  ).slice(0, 10);
  if (nextDate < boundary)
    throw Error(
      "Following shifts cannot start before the selected occurrence date. Use This shift only to move it earlier.",
    );
  const trimmed = {
    ...source,
    rule: { ...source.rule, until: shiftDate(boundary, -1) },
  };
  const remaining = data.series.flatMap((s) =>
    s.id !== source.id
      ? [s]
      : trimmed.rule.until! < source.rule.startDate
        ? []
        : [trimmed],
  );
  const oldExceptions = data.exceptions.filter(
    (e) => e.seriesId !== source.id || e.date < boundary,
  );
  if (repeat.frequency === "none")
    return {
      ...data,
      series: remaining,
      exceptions: oldExceptions,
      singles: [...data.singles, { ...draft, id: crypto.randomUUID() }],
    };
  const series = seriesFromDraft(draft, repeat, crypto.randomUUID());
  // Overrides are explicit appointments: retain their dates/times, even if weekdays change.
  const future = data.exceptions
    .filter(
      (e) =>
        e.seriesId === source.id &&
        e.date > boundary &&
        e.date >= series.rule.startDate &&
        (!series.rule.until || e.date <= series.rule.until),
    )
    .map((e) => ({ ...e, seriesId: series.id }));
  return {
    ...data,
    series: [...remaining, series],
    exceptions: [...oldExceptions, ...future],
  };
}
export function deleteShift<T extends Schedule>(
  data: T,
  original: Occurrence,
  scope: Scope = "only",
): T {
  if (!original.seriesId)
    return {
      ...data,
      singles: data.singles.filter((s) => s.id !== original.id),
    };
  const id = original.seriesId,
    date = original.occurrenceDate!;
  if (scope === "only")
    return putException(data, { seriesId: id, date, deleted: true });
  if (scope === "all")
    return {
      ...data,
      series: data.series.filter((s) => s.id !== id),
      exceptions: data.exceptions.filter((e) => e.seriesId !== id),
    };
  return {
    ...data,
    series: data.series.flatMap((s) =>
      s.id !== id
        ? [s]
        : date <= s.rule.startDate
          ? []
          : [{ ...s, rule: { ...s.rule, until: shiftDate(date, -1) } }],
    ),
    exceptions: data.exceptions.filter(
      (e) => e.seriesId !== id || e.date < date,
    ),
  };
}
