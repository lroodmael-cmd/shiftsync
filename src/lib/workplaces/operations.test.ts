import { describe, it, expect } from "vitest";
import {
  emptyWorkspace,
  associationOf,
  type WorkLocation,
  type Workplace,
  type WorkspaceSchedule,
} from "./types";
import {
  saveWorkplace,
  saveLocation,
  selectionDefaults,
  archiveWorkplace,
  archiveLocation,
  deleteLocation,
  deleteWorkplace,
  locationReferenced,
} from "./operations";
import { saveShift } from "../schedule/mutations";
import { occurrence } from "../schedule/recurrence";
import { expandSchedule } from "../schedule/occurrences";
import { conflictsForOccurrence } from "../schedule/conflicts";
import { decodeWorkspace } from "./persistence";
const workplace: Workplace = {
  id: "amazon",
  name: "Amazon",
  color: "#5b8cff",
  icon: "warehouse",
  archived: false,
  isPrimary: true,
};
const location: WorkLocation = {
  id: "north",
  workplaceId: "amazon",
  name: "North warehouse",
  address: "10 North St",
  timeZone: "America/New_York",
  commute: { beforeMinutes: 30, afterMinutes: 45 },
  archived: false,
};
function fixture() {
  return saveLocation(saveWorkplace(emptyWorkspace(), workplace), location);
}
const base = {
  id: "shift",
  title: "Night",
  startAt: "2026-10-22T02:00:00Z",
  endAt: "2026-10-22T10:00:00Z",
  color: "#5b8cff",
};
function attached(data = fixture()) {
  const defaults = selectionDefaults(data, "amazon");
  return {
    ...base,
    ...associationOf(defaults),
    color: defaults.color,
    commute: defaults.commute,
  };
}
const repeat = {
  frequency: "weekly" as const,
  timeZone: "America/New_York",
  weekdays: [3],
  startLocal: "2026-10-21T22:00",
  endLocal: "2026-10-22T06:00",
};
describe("workplace and location management", () => {
  it("creates and edits workplace identity without changing its ID", () => {
    const data = fixture();
    const changed = saveWorkplace(data, {
      ...workplace,
      name: "Amazon Operations",
      icon: "building",
      color: "#10b981",
    });
    expect(changed.workplaces[0]).toMatchObject({
      id: "amazon",
      name: "Amazon Operations",
      icon: "building",
    });
    expect(data.workplaces[0].name).toBe("Amazon");
  });
  it("keeps a single optional active primary workplace", () => {
    const data = saveWorkplace(fixture(), {
      ...workplace,
      id: "mco",
      name: "MCO",
      isPrimary: true,
    });
    expect(data.workplaces.filter((w) => w.isPrimary).map((w) => w.id)).toEqual(
      ["mco"],
    );
    const archived = archiveWorkplace(data, "mco", true);
    expect(archived.workplaces.some((w) => w.isPrimary)).toBe(false);
  });
  it("supports multiple locations and explicit default selection", () => {
    const data = fixture();
    expect(data.workplaces[0].defaultLocationId).toBe("north");
    const changed = saveLocation(
      data,
      {
        ...location,
        id: "south",
        name: "South",
        commute: { beforeMinutes: 10, afterMinutes: 15 },
        color: "#8b5cf6",
      },
      true,
    );
    expect(changed.locations).toHaveLength(2);
    const defaults = selectionDefaults(changed, "amazon");
    expect(defaults.locationId).toBe("south");
    expect(defaults.commute).toEqual({ beforeMinutes: 10, afterMinutes: 15 });
    expect(defaults.color).toBe("#8b5cf6");
  });
  it("copies inherited color, time zone and commute values into a shift snapshot", () => {
    const shift = attached();
    expect(shift).toMatchObject({
      workplaceId: "amazon",
      locationId: "north",
      color: workplace.color,
      timeZone: "America/New_York",
      assignment: {
        workplaceName: "Amazon",
        locationName: "North warehouse",
        defaultCommute: { beforeMinutes: 30, afterMinutes: 45 },
      },
    });
  });
  it("never rewrites snapshots or custom commutes when workplace/location settings change", () => {
    let data: WorkspaceSchedule = {
      ...fixture(),
      singles: [
        {
          ...attached(),
          commute: { beforeMinutes: 77, afterMinutes: 12 },
          commuteSource: "custom",
        },
      ],
    };
    const history = JSON.stringify(data.singles);
    data = saveWorkplace(data, {
      ...data.workplaces[0],
      name: "Renamed",
      color: "#10b981",
    });
    data = saveLocation(data, {
      ...location,
      name: "Renamed location",
      timeZone: "Europe/Paris",
      commute: { beforeMinutes: 5, afterMinutes: 8 },
    });
    expect(JSON.stringify(data.singles)).toBe(history);
    expect(selectionDefaults(data, "amazon").commute?.beforeMinutes).toBe(5);
    expect(selectionDefaults(data, "amazon").color).toBe("#10b981");
  });
  it("archives a referenced workplace instead of permanently deleting it", () => {
    const data = { ...fixture(), singles: [attached()] };
    const next = deleteWorkplace(data, "amazon");
    expect(next.workplaces[0].archived).toBe(true);
    expect(next.workplaces[0].isPrimary).toBe(false);
    expect(next.singles).toEqual(data.singles);
    expect(next.locations).toEqual(data.locations);
    expect(() => selectionDefaults(next, "amazon")).toThrow("active workplace");
  });
  it("archives a referenced location and changes the default to another active location", () => {
    let data = saveLocation(fixture(), {
      ...location,
      id: "south",
      name: "South",
    });
    data = { ...data, singles: [attached(data)] };
    const next = deleteLocation(data, "north");
    expect(next.locations.find((l) => l.id === "north")?.archived).toBe(true);
    expect(next.workplaces[0].defaultLocationId).toBe("south");
    expect(next.singles[0].assignment?.locationName).toBe("North warehouse");
    expect(decodeWorkspace(JSON.stringify(next))).toEqual(next);
  });
  it("handles the last active default location and restoration", () => {
    const archived = archiveLocation(fixture(), "north", true);
    expect(archived.workplaces[0].defaultLocationId).toBeUndefined();
    const restored = archiveLocation(archived, "north", false);
    expect(restored.workplaces[0].defaultLocationId).toBe("north");
  });
  it("deletes unused locations/workplaces without affecting unrelated records", () => {
    const data = saveWorkplace(fixture(), {
      ...workplace,
      id: "mco",
      name: "MCO",
      isPrimary: false,
    });
    const next = deleteLocation(data, "north");
    expect(next.locations).toHaveLength(0);
    expect(
      next.workplaces.find((w) => w.id === "amazon")?.defaultLocationId,
    ).toBeUndefined();
    expect(deleteWorkplace(data, "amazon").workplaces.map((w) => w.id)).toEqual(
      ["mco"],
    );
  });
  it("rejects invalid zones, cross-workplace locations and fractional travel durations", () => {
    expect(() =>
      saveLocation(fixture(), { ...location, timeZone: "Wrong/Zone" }),
    ).toThrow();
    expect(() =>
      saveLocation(fixture(), {
        ...location,
        commute: { beforeMinutes: 1.5, afterMinutes: 0 },
      }),
    ).toThrow();
    expect(() =>
      saveLocation(fixture(), { ...location, workplaceId: "missing" }),
    ).toThrow();
  });
});
describe("recurrence and commute integration", () => {
  it("preserves workplace/location snapshots and occurrence IDs on recurring shifts", () => {
    const data = saveShift(fixture(), attached(), repeat);
    expect(data.series[0].assignment?.locationName).toBe("North warehouse");
    const result = expandSchedule(
      data,
      new Date("2026-10-21T00:00Z"),
      new Date("2026-10-29T12:00Z"),
    );
    expect(result.map((s) => s.id)).toEqual([
      "shift@2026-10-21",
      "shift@2026-10-28",
    ]);
    expect(result[1].commute).toEqual(location.commute);
    expect(result[1].workplaceId).toBe("amazon");
    expect(decodeWorkspace(JSON.stringify(data))).toEqual(data);
  });
  it("supports reassignment for one occurrence and following occurrences without altering history", () => {
    let data = saveShift(fixture(), attached(), repeat);
    data = saveWorkplace(data, {
      ...workplace,
      id: "mco",
      name: "MCO",
      isPrimary: false,
    });
    data = saveLocation(data, {
      ...location,
      id: "airport",
      workplaceId: "mco",
      name: "Airport",
    });
    const old = occurrence(data.series[0], "2026-10-28");
    const defaults = selectionDefaults(data, "mco");
    const updated = {
      ...old,
      ...associationOf(defaults),
      color: defaults.color,
      commute: { beforeMinutes: 99, afterMinutes: 10 },
      commuteSource: "custom" as const,
    };
    const only = saveShift(data, updated, repeat, old, "only");
    expect(only.series[0].workplaceId).toBe("amazon");
    expect(only.exceptions[0].override?.workplaceId).toBe("mco");
    expect(locationReferenced(only, "airport")).toBe(true);
    const following = saveShift(
      only,
      updated,
      {
        ...repeat,
        startLocal: "2026-10-28T22:00",
        endLocal: "2026-10-29T06:00",
      },
      old,
      "following",
    );
    const past = expandSchedule(
      following,
      new Date("2026-10-21T00:00Z"),
      new Date("2026-10-22T15:00Z"),
    )[0];
    expect(past.id).toBe("shift@2026-10-21");
    expect(past.workplaceId).toBe("amazon");
    expect(following.series[1].workplaceId).toBe("mco");
    expect(following.series[1].commute.beforeMinutes).toBe(99);
    expect(decodeWorkspace(JSON.stringify(following))).toEqual(following);
  });
  it("includes inherited travel in conflict detection even across workplaces", () => {
    const shift = attached();
    const data = { ...fixture(), singles: [shift] };
    const candidate = {
      ...base,
      id: "other",
      startAt: "2026-10-22T01:35:00Z",
      endAt: "2026-10-22T01:50:00Z",
    };
    expect(
      conflictsForOccurrence(data, candidate).some(
        (e) => e.kind === "before" && e.work.workplaceId === "amazon",
      ),
    ).toBe(true);
  });
  it("keeps unassigned shifts unassigned", () => {
    const data = saveShift(fixture(), base, { ...repeat, frequency: "none" });
    expect(data.singles[0].workplaceId).toBeUndefined();
    expect(
      decodeWorkspace(JSON.stringify(data)).singles[0].workplaceId,
    ).toBeUndefined();
  });
});
