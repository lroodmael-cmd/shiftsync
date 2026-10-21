// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from "vitest";
import { SHIFT_KEY } from "../storage";
import {
  BACKUP_KEY,
  SCHEDULE_KEY,
  loadSchedule,
  decodeSchedule,
  backupPayload,
} from "./persistence";
import { emptySchedule } from "./types";
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
const legacy = [
  {
    id: "old",
    title: "Saved night",
    color: "#5b8cff",
    startAt: "2026-10-21T22:00:00-04:00",
    endAt: "2026-10-22T06:00:00-04:00",
  },
];
it("backs up the exact original payload before migration, preserves IDs and instants, and leaves v1 untouched", () => {
  const raw = JSON.stringify(legacy);
  localStorage.setItem(SHIFT_KEY, raw);
  const result = loadSchedule(localStorage);
  expect(localStorage.getItem(BACKUP_KEY)).toBe(raw);
  expect(localStorage.getItem(SHIFT_KEY)).toBe(raw);
  expect(result.singles[0].id).toBe("old");
  expect(result.singles[0].startAt).toBe("2026-10-22T02:00:00.000Z");
  expect(loadSchedule(localStorage)).toEqual(result);
});
it("stops migration when a backup cannot be saved", () => {
  localStorage.setItem(SHIFT_KEY, JSON.stringify(legacy));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("quota");
  });
  expect(() => loadSchedule(localStorage)).toThrow();
  expect(localStorage.getItem(SCHEDULE_KEY)).toBeNull();
  expect(localStorage.getItem(SHIFT_KEY)).toBe(JSON.stringify(legacy));
});
it.each(["broken", "{}", "[{}]"])(
  "never overwrites invalid legacy data: %s",
  (raw) => {
    localStorage.setItem(SHIFT_KEY, raw);
    expect(() => loadSchedule(localStorage)).toThrow();
    expect(localStorage.getItem(SHIFT_KEY)).toBe(raw);
    expect(localStorage.getItem(SCHEDULE_KEY)).toBeNull();
    expect(JSON.parse(backupPayload(localStorage)).storage[SHIFT_KEY]).toBe(
      raw,
    );
  },
);
it.each([
  "broken",
  '{"version":99}',
  JSON.stringify({ ...emptySchedule(), singles: legacy }),
  JSON.stringify({
    ...emptySchedule(),
    exceptions: [{ seriesId: "missing", date: "2026-10-21", deleted: true }],
  }),
])("rejects unknown/corrupt v2 without falling back to stale v1: %s", (raw) => {
  localStorage.setItem(SCHEDULE_KEY, raw);
  expect(() => loadSchedule(localStorage)).toThrow();
  expect(localStorage.getItem(SCHEDULE_KEY)).toBe(raw);
});
it("round-trips the versioned model", () =>
  expect(decodeSchedule(JSON.stringify(emptySchedule()))).toEqual(
    emptySchedule(),
  ));
