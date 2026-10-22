// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from "vitest";
import {
  WORKSPACE_KEY,
  V2_BACKUP_KEY,
  loadWorkspace,
  decodeWorkspace,
} from "./persistence";
import { emptyWorkspace } from "./types";
import { emptySchedule } from "../schedule/types";
import { SCHEDULE_KEY } from "../schedule/persistence";
import { SHIFT_KEY } from "../storage";
import { saveShift } from "../schedule/mutations";
const shift = {
  id: "legacy-amazon",
  title: "Amazon",
  color: "#5b8cff",
  startAt: "2026-10-22T02:00:00Z",
  endAt: "2026-10-22T10:00:00Z",
  commute: { beforeMinutes: 77, afterMinutes: 13 },
};
const repeat = {
  frequency: "weekly" as const,
  timeZone: "America/New_York",
  weekdays: [3],
  startLocal: "2026-10-21T22:00",
  endLocal: "2026-10-22T06:00",
};
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it("migrates v2 singles, recurring rules and exceptions without assigning workplaces by title", () => {
  let v2 = saveShift(emptySchedule(), { ...shift, id: "series" }, repeat);
  v2 = {
    ...v2,
    singles: [shift],
    exceptions: [
      {
        seriesId: "series",
        date: "2026-10-28",
        override: {
          ...shift,
          id: "series@2026-10-28",
          commute: { beforeMinutes: 99, afterMinutes: 12 },
        },
      },
    ],
  };
  const raw = JSON.stringify(v2);
  localStorage.setItem(SCHEDULE_KEY, raw);
  const data = loadWorkspace(localStorage);
  expect(data.version).toBe(3);
  expect(data.singles).toEqual(v2.singles);
  expect(data.series).toEqual(v2.series);
  expect(data.exceptions).toEqual(v2.exceptions);
  expect(data.workplaces).toEqual([]);
  expect(data.locations).toEqual([]);
  expect(data.singles[0].workplaceId).toBeUndefined();
  expect(localStorage.getItem(SCHEDULE_KEY)).toBe(raw);
  expect(localStorage.getItem(V2_BACKUP_KEY)).toBe(raw);
  expect(loadWorkspace(localStorage)).toEqual(data);
});
it("also preserves v1 on a direct v1 to v3 upgrade", () => {
  const raw = JSON.stringify([shift]);
  localStorage.setItem(SHIFT_KEY, raw);
  const data = loadWorkspace(localStorage);
  expect(data.singles[0].id).toBe(shift.id);
  expect(data.singles[0].commute).toEqual(shift.commute);
  expect(localStorage.getItem(SHIFT_KEY)).toBe(raw);
  expect(localStorage.getItem("shiftsync:backup:v1")).toBe(raw);
});
it("stops before v3 writes when backups cannot be written", () => {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(emptySchedule()));
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (key.startsWith(V2_BACKUP_KEY)) throw Error("quota");
    original.call(this, key, value);
  });
  expect(() => loadWorkspace(localStorage)).toThrow();
  expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
});
it("verifies backup bytes and does not replace a different existing backup", () => {
  const raw = JSON.stringify(emptySchedule());
  localStorage.setItem(SCHEDULE_KEY, raw);
  localStorage.setItem(V2_BACKUP_KEY, "previous backup");
  loadWorkspace(localStorage);
  expect(localStorage.getItem(V2_BACKUP_KEY)).toBe("previous backup");
  expect(
    Object.keys(localStorage).some(
      (k) =>
        k.startsWith(V2_BACKUP_KEY + ":") && localStorage.getItem(k) === raw,
    ),
  ).toBe(true);
});
it.each(["broken", "{}", '{"version":9}'])(
  "preserves invalid v2 and never falls back to v1: %s",
  (raw) => {
    localStorage.setItem(SCHEDULE_KEY, raw);
    localStorage.setItem(SHIFT_KEY, JSON.stringify([shift]));
    expect(() => loadWorkspace(localStorage)).toThrow();
    expect(localStorage.getItem(SCHEDULE_KEY)).toBe(raw);
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  },
);
it.each(["broken", "{}", '{"version":4}'])(
  "preserves invalid v3 and never overwrites it with v2: %s",
  (raw) => {
    localStorage.setItem(WORKSPACE_KEY, raw);
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(emptySchedule()));
    expect(() => loadWorkspace(localStorage)).toThrow();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(raw);
  },
);
it("rejects dangling workplace/location references and invalid primary settings", () => {
  expect(() =>
    decodeWorkspace(
      JSON.stringify({
        ...emptyWorkspace(),
        singles: [{ ...shift, workplaceId: "missing" }],
      }),
    ),
  ).toThrow();
  expect(() =>
    decodeWorkspace(
      JSON.stringify({
        ...emptyWorkspace(),
        workplaces: [
          {
            id: "a",
            name: "A",
            color: "#5b8cff",
            icon: "briefcase",
            isPrimary: true,
            archived: true,
          },
        ],
      }),
    ),
  ).toThrow();
});
it("stops migration if the exact backup cannot be read back", () => {
  const raw = JSON.stringify(emptySchedule());
  localStorage.setItem(SCHEDULE_KEY, raw);
  const original = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
    this: Storage,
    key: string,
  ) {
    return key.startsWith(V2_BACKUP_KEY) ? null : original.call(this, key);
  });
  expect(() => loadWorkspace(localStorage)).toThrow(
    "Backup verification failed",
  );
  expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  expect(localStorage.getItem(SCHEDULE_KEY)).toBe(raw);
});
it("preserves original data and verified backup if the v3 write fails verification", () => {
  const raw = JSON.stringify(emptySchedule());
  localStorage.setItem(SCHEDULE_KEY, raw);
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (key !== WORKSPACE_KEY) original.call(this, key, value);
  });
  expect(() => loadWorkspace(localStorage)).toThrow(
    "Migration write verification failed",
  );
  expect(localStorage.getItem(SCHEDULE_KEY)).toBe(raw);
  expect(localStorage.getItem(V2_BACKUP_KEY)).toBe(raw);
});
it("rejects invalid optional time zones even on workplace-only snapshots", () => {
  const workplace = {
    id: "a",
    name: "Amazon",
    icon: "warehouse",
    color: "#5b8cff",
    archived: false,
    isPrimary: false,
  };
  expect(() =>
    decodeWorkspace(
      JSON.stringify({
        ...emptyWorkspace(),
        workplaces: [workplace],
        singles: [
          {
            ...shift,
            workplaceId: "a",
            assignment: {
              workplaceName: "Amazon",
              workplaceIcon: "warehouse",
              workplaceColor: "#5b8cff",
              timeZone: "Invalid/Zone",
            },
          },
        ],
      }),
    ),
  ).toThrow();
});
