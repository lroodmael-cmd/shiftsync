import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { expandSchedule, nextInSeries } from "./occurrences";
import { seriesFromDraft, occurrence } from "./recurrence";
import { saveShift, deleteShift } from "./mutations";
import { calendarEvents, withCommutes } from "./commute";
import { conflictsForOccurrence } from "./conflicts";
import { emptySchedule, type RepeatSettings, type WorkShift } from "./types";
import { instant } from "./time";
import { scheduleSummary } from "./summary";
const zone = "America/New_York";
const draft: WorkShift = {
  id: "series",
  title: "Night",
  color: "#5b8cff",
  startAt: "2026-10-19T22:00:00Z",
  endAt: "2026-10-20T06:00:00Z",
  commute: { beforeMinutes: 30, afterMinutes: 45 },
};
const settings: RepeatSettings = {
  frequency: "weekly",
  timeZone: zone,
  weekdays: [1, 3, 5],
  startLocal: "2026-10-19T22:00",
  endLocal: "2026-10-20T06:00",
};
const series = seriesFromDraft(draft, settings, "series");
const data = { ...emptySchedule(), series: [series] };
const expand = (from: string, to: string, schedule = data) =>
  expandSchedule(schedule, new Date(from), new Date(to));
describe("recurrence engine", () => {
  it("expands weekly selected weekdays with stable IDs and no persisted copies", () => {
    const result = expand("2026-10-19T00:00Z", "2026-10-26T00:00Z");
    expect(result.map((s) => s.occurrenceDate)).toEqual([
      "2026-10-19",
      "2026-10-21",
      "2026-10-23",
    ]);
    expect(result[0].id).toBe("series@2026-10-19");
    expect(data.series).toHaveLength(1);
    expect(data.singles).toHaveLength(0);
  });
  it("includes a shift whose start is the previous local day", () => {
    const result = expand("2026-10-20T04:00Z", "2026-10-20T10:00Z");
    expect(result).toHaveLength(1);
    expect(result[0].occurrenceDate).toBe("2026-10-19");
  });
  it("uses inclusive until and rejects end dates before the first date", () => {
    const ended = {
      ...data,
      series: [{ ...series, rule: { ...series.rule, until: "2026-10-21" } }],
    };
    expect(
      expand("2026-10-19T00:00Z", "2026-10-30T00:00Z", ended),
    ).toHaveLength(2);
    expect(() =>
      seriesFromDraft(draft, { ...settings, until: "2026-10-18" }, "x"),
    ).toThrow();
  });
  it("maintains local clock time across fall DST while UTC changes", () => {
    const daily = seriesFromDraft(
      draft,
      {
        ...settings,
        frequency: "daily",
        startLocal: "2026-10-31T22:00",
        endLocal: "2026-11-01T06:00",
      },
      "fall",
    );
    const first = occurrence(daily, "2026-10-31"),
      next = occurrence(daily, "2026-11-01");
    expect(first.startAt).toBe("2026-11-01T02:00:00Z");
    expect(first.endAt).toBe("2026-11-01T11:00:00Z");
    expect((+new Date(first.endAt) - +new Date(first.startAt)) / 3600000).toBe(
      9,
    );
    expect(next.startAt).toBe("2026-11-02T03:00:00Z");
  });
  it("calculates actual paid duration across spring DST", () => {
    const daily = seriesFromDraft(
      draft,
      {
        ...settings,
        frequency: "daily",
        startLocal: "2026-03-07T22:00",
        endLocal: "2026-03-08T06:00",
      },
      "spring",
    );
    const value = occurrence(daily, "2026-03-07");
    expect((+new Date(value.endAt) - +new Date(value.startAt)) / 3600000).toBe(
      7,
    );
  });
  it("has an explicit policy for skipped and repeated local times", () => {
    expect(instant("2026-03-08T02:30", zone)).toBe("2026-03-08T07:30:00Z");
    expect(instant("2026-11-01T01:30", zone)).toBe("2026-11-01T05:30:00Z");
  });
  it("queries a distant future week without generating the intervening years", () => {
    expect(
      expand("2040-01-02T00:00Z", "2040-01-09T00:00Z").length,
    ).toBeLessThanOrEqual(4);
    expect(JSON.stringify(data).length).toBeLessThan(600);
  });
  it("finds next shifts with future start dates and skips cancelled dates", () => {
    const far = {
      ...series,
      rule: { ...series.rule, startDate: "2030-01-01" },
    };
    expect(
      nextInSeries(
        { ...data, series: [far] },
        far,
        new Date("2026-10-01T00:00Z"),
      )?.occurrenceDate,
    ).toBe("2030-01-02");
  });
});
describe("exceptions and scopes", () => {
  const original = occurrence(series, "2026-10-21");
  it("edits only one occurrence and retains its stable identity", () => {
    const changed = saveShift(
      data,
      { ...original, title: "Custom" },
      settings,
      original,
      "only",
    );
    expect(changed.series).toEqual(data.series);
    const values = expand("2026-10-19T00:00Z", "2026-10-26T00:00Z", changed);
    expect(values.map((s) => s.title)).toEqual(["Night", "Custom", "Night"]);
    expect(values[1].id).toBe(original.id);
  });
  it("handles moved overrides outside their nominal date and removes the original", () => {
    const changed = saveShift(
      data,
      {
        ...original,
        startAt: "2026-12-01T14:00:00Z",
        endAt: "2026-12-01T18:00:00Z",
      },
      settings,
      original,
      "only",
    );
    expect(
      expand("2026-10-21T12:00Z", "2026-10-22T12:00Z", changed),
    ).toHaveLength(0);
    expect(
      expand("2026-12-01T12:00Z", "2026-12-01T20:00Z", changed)[0].id,
    ).toBe(original.id);
  });
  it("keeps historical rules and exceptions unchanged when editing following occurrences", () => {
    const past = occurrence(series, "2026-10-19");
    const exceptional = saveShift(
      data,
      { ...past, title: "Historical exception" },
      settings,
      past,
      "only",
    );
    const changed = saveShift(
      exceptional,
      { ...original, title: "Future" },
      {
        ...settings,
        startLocal: "2026-10-21T22:00",
        endLocal: "2026-10-22T06:00",
      },
      original,
      "following",
    );
    expect(changed.series).toHaveLength(2);
    expect(changed.series[0].rule.until).toBe("2026-10-20");
    expect(changed.exceptions).toEqual(exceptional.exceptions);
    const before = expand(
      "2026-10-19T00:00Z",
      "2026-10-20T12:00Z",
      exceptional,
    )[0];
    const after = expand("2026-10-19T00:00Z", "2026-10-20T12:00Z", changed)[0];
    const { rule: beforeRule, ...beforeEvent } = before;
    const { rule: afterRule, ...afterEvent } = after;
    expect(afterEvent).toEqual(beforeEvent);
    expect(
      expand("2026-10-21T12:00Z", "2026-10-24T12:00Z", changed).map(
        (s) => s.title,
      ),
    ).toEqual(["Future", "Future"]);
  });
  it("deletes one occurrence, following occurrences, or the whole series", () => {
    const only = deleteShift(data, original, "only");
    expect(expand("2026-10-19T00:00Z", "2026-10-26T00:00Z", only)).toHaveLength(
      2,
    );
    expect(only.exceptions[0].deleted).toBe(true);
    const following = deleteShift(data, original, "following");
    expect(
      expand("2026-10-19T00:00Z", "2026-10-26T00:00Z", following),
    ).toHaveLength(1);
    expect(deleteShift(only, original, "all").series).toHaveLength(0);
    expect(deleteShift(only, original, "all").exceptions).toHaveLength(0);
  });
  it("applies all-series edits from the original start date and replaces the selected override", () => {
    const custom = saveShift(
      data,
      { ...original, title: "Custom" },
      settings,
      original,
      "only",
    );
    const next = saveShift(
      custom,
      { ...original, title: "All" },
      settings,
      original,
      "all",
    );
    expect(next.series[0].rule.startDate).toBe("2026-10-19");
    expect(next.series[0].title).toBe("All");
    expect(next.exceptions).toHaveLength(0);
  });
  it("can stop repetition for following shifts without removing history", () => {
    const changed = saveShift(
      data,
      { ...original, title: "One final shift" },
      { ...settings, frequency: "none" },
      original,
      "following",
    );
    expect(changed.singles).toHaveLength(1);
    expect(changed.series[0].rule.until).toBe("2026-10-20");
  });
});
describe("commutes and conflicts", () => {
  const work = {
    ...draft,
    id: "one",
    startAt: "2026-10-21T04:15:00Z",
    endAt: "2026-10-21T12:15:00Z",
  };
  it("derives commutes across midnight and follows edited start/end times", () => {
    const events = withCommutes([work]);
    expect(events.find((e) => e.kind === "before")?.startAt).toBe(
      "2026-10-21T03:45:00.000Z",
    );
    const updated = withCommutes([
      { ...work, startAt: "2026-10-21T05:00:00Z" },
    ]);
    expect(updated.find((e) => e.kind === "before")?.startAt).toBe(
      "2026-10-21T04:30:00.000Z",
    );
  });
  it("includes travel even when its linked work starts outside the query window", () => {
    const events = calendarEvents(
      { ...emptySchedule(), singles: [work] },
      new Date("2026-10-21T03:40Z"),
      new Date("2026-10-21T04:00Z"),
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("before");
  });
  it("detects commute/work and commute/commute overlaps while excluding the same shift", () => {
    const candidate = {
      ...draft,
      id: "two",
      startAt: "2026-10-21T03:30:00Z",
      endAt: "2026-10-21T04:00:00Z",
      commute: { beforeMinutes: 0, afterMinutes: 0 },
    };
    const schedule = { ...emptySchedule(), singles: [work] };
    expect(conflictsForOccurrence(schedule, candidate)[0].kind).toBe("before");
    expect(conflictsForOccurrence(schedule, work)).toEqual([]);
    const travelling = {
      ...candidate,
      endAt: "2026-10-21T03:40:00Z",
      commute: { beforeMinutes: 0, afterMinutes: 20 },
    };
    expect(conflictsForOccurrence(schedule, travelling)).toHaveLength(1);
  });
  it("excludes commutes from paid dashboard hours and reports no free day within its explicit horizon", () => {
    const summary = scheduleSummary(
      { ...emptySchedule(), singles: [work] },
      new Date("2026-10-21T10:00Z"),
    );
    expect(summary.hours).toBe(8);
    const daily = {
      ...series,
      rule: { ...series.rule, frequency: "daily" as const },
    };
    expect(
      scheduleSummary(
        { ...data, series: [daily] },
        new Date("2026-10-21T10:00Z"),
      ).free,
    ).toBeNull();
  });
});

it("applies a following edit even when the selected occurrence already has an override", () => {
  const original = occurrence(series, "2026-10-21");
  const custom = saveShift(
    data,
    { ...original, title: "Old exception" },
    settings,
    original,
    "only",
  );
  const changed = saveShift(
    custom,
    { ...original, title: "New future" },
    {
      ...settings,
      startLocal: "2026-10-21T22:00",
      endLocal: "2026-10-22T06:00",
    },
    original,
    "following",
  );
  const values = expand("2026-10-21T12:00Z", "2026-10-24T12:00Z", changed);
  expect(values.map((s) => s.title)).toEqual(["New future", "New future"]);
});

it("prevents future-only edits from adding occurrences before the historical cut", () => {
  const original = occurrence(series, "2026-10-21");
  expect(() =>
    saveShift(
      data,
      original,
      {
        ...settings,
        startLocal: "2026-10-18T22:00",
        endLocal: "2026-10-19T06:00",
      },
      original,
      "following",
    ),
  ).toThrow("cannot start before");
  expect(data.series[0].rule.until).toBeUndefined();
});
