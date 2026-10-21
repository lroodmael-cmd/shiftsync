import { describe, it, expect } from "vitest";
import { dashboard, countdown } from "./dashboard";
import { layoutSegments } from "./calendar";
import type { Shift } from "./shifts";
const make = (id: string, start: Date, end: Date): Shift => ({
  id,
  title: id,
  color: "#5b8cff",
  startAt: start.toISOString(),
  endAt: end.toISOString(),
});
describe("dashboard", () => {
  const now = new Date(2026, 9, 21, 12);
  it("handles an empty schedule", () => {
    const s = dashboard([], now);
    expect(s.next).toBeUndefined();
    expect(s.hours).toBe(0);
    expect(s.events).toEqual([]);
    expect(s.free.getDate()).toBe(21);
  });
  it("clips weekly hours and includes an overnight shift in Today", () => {
    const shifts = [
      make("week edge", new Date(2026, 9, 18, 22), new Date(2026, 9, 19, 6)),
      make("night", new Date(2026, 9, 20, 22), new Date(2026, 9, 21, 6)),
      make("next", new Date(2026, 9, 22, 9), new Date(2026, 9, 22, 17)),
    ];
    const s = dashboard(shifts, now);
    expect(s.hours).toBe(22);
    expect(s.next?.id).toBe("next");
    expect(s.events[0].id).toBe("night");
    expect(s.free.getDate()).toBe(23);
  });
  it("selects active shifts and labels countdowns", () => {
    const shift = make(
      "active",
      new Date(2026, 9, 21, 10),
      new Date(2026, 9, 21, 18),
    );
    expect(dashboard([shift], now).next?.id).toBe("active");
    expect(countdown(shift.startAt, now)).toBe("In progress");
    expect(countdown(new Date(+now + 90000000).toISOString(), now)).toBe(
      "1d 1h 0m",
    );
  });
  it("uses stable distinct lanes for chained overlaps and full width for separate events", () => {
    const d = (h: number) => new Date(2026, 9, 21, h);
    const result = layoutSegments(
      [
        make("a", d(8), d(11)),
        make("b", d(10), d(13)),
        make("c", d(12), d(14)),
        make("d", d(16), d(18)),
      ],
      d(0),
    );
    expect(result.map((s) => [s.column, s.columns])).toEqual([
      [0, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ]);
  });
});
