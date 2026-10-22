import { decodeSchedule, SCHEDULE_KEY } from "../schedule/persistence";
import { decodeShifts, SHIFT_KEY } from "../storage";
import { validZone } from "../schedule/time";
import {
  emptyWorkspace,
  workplaceIcons,
  type WorkspaceSchedule,
} from "./types";
export const WORKSPACE_KEY = "shiftsync:v3:schedule";
export const V2_BACKUP_KEY = "shiftsync:backup:v2";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown) => typeof v === "string" && v.length > 0;
const name = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 120;
const color = (v: unknown) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const commute = (v: unknown) =>
  record(v) &&
  ["beforeMinutes", "afterMinutes"].every(
    (k) =>
      typeof v[k] === "number" &&
      Number.isInteger(v[k]) &&
      v[k] >= 0 &&
      v[k] <= 720,
  );
const fail = (): never => {
  throw Error(
    "Invalid v3 workspace. Existing data must be backed up before recovery.",
  );
};
export function decodeWorkspace(raw: string): WorkspaceSchedule {
  const value: unknown = JSON.parse(raw);
  if (
    !record(value) ||
    value.version !== 3 ||
    !Array.isArray(value.workplaces) ||
    !Array.isArray(value.locations)
  )
    return fail();
  // Keep Sprint 03's schema checks for all rules, dates, exceptions and actual work intervals.
  decodeSchedule(JSON.stringify({ ...value, version: 2 }));
  const data = value as WorkspaceSchedule;
  for (const w of data.workplaces) {
    if (
      !record(w) ||
      !id(w.id) ||
      !name(w.name) ||
      !color(w.color) ||
      !workplaceIcons.includes(w.icon) ||
      typeof w.archived !== "boolean" ||
      typeof w.isPrimary !== "boolean" ||
      (w.archived && w.isPrimary) ||
      (w.defaultLocationId !== undefined && !id(w.defaultLocationId))
    )
      return fail();
  }
  for (const l of data.locations) {
    if (
      !record(l) ||
      !id(l.id) ||
      !name(l.name) ||
      !id(l.workplaceId) ||
      !data.workplaces.some((w) => w.id === l.workplaceId) ||
      typeof l.timeZone !== "string" ||
      !validZone(l.timeZone) ||
      !commute(l.commute) ||
      typeof l.archived !== "boolean" ||
      (l.address !== undefined &&
        (typeof l.address !== "string" || l.address.length > 500)) ||
      (l.color !== undefined && !color(l.color))
    )
      return fail();
  }
  const ids = [...data.workplaces, ...data.locations].map((v) => v.id);
  if (
    new Set(ids).size !== ids.length ||
    data.workplaces.filter((w) => w.isPrimary).length > 1
  )
    return fail();
  for (const w of data.workplaces) {
    if (
      w.defaultLocationId &&
      !data.locations.some(
        (l) =>
          l.id === w.defaultLocationId && l.workplaceId === w.id && !l.archived,
      )
    )
      return fail();
  }
  for (const s of [
    ...data.singles,
    ...data.series,
    ...data.exceptions.flatMap((e) => (e.override ? [e.override] : [])),
  ]) {
    if (
      (s.timeZone !== undefined && !validZone(s.timeZone)) ||
      (s.commuteSource !== undefined &&
        !["location", "custom"].includes(s.commuteSource))
    )
      return fail();
    if (s.workplaceId === undefined) {
      if (
        s.locationId !== undefined ||
        s.assignment !== undefined ||
        s.commuteSource === "location"
      )
        return fail();
      continue;
    }
    if (
      !id(s.workplaceId) ||
      !data.workplaces.some((w) => w.id === s.workplaceId)
    )
      return fail();
    const a = s.assignment;
    if (
      !record(a) ||
      !name(a.workplaceName) ||
      !color(a.workplaceColor) ||
      !workplaceIcons.includes(a.workplaceIcon)
    )
      return fail();
    if (
      (a.locationName !== undefined && !name(a.locationName)) ||
      (a.timeZone !== undefined &&
        (typeof a.timeZone !== "string" || !validZone(a.timeZone))) ||
      (a.defaultCommute !== undefined && !commute(a.defaultCommute))
    )
      return fail();
    if (s.locationId !== undefined) {
      if (
        !id(s.locationId) ||
        !data.locations.some(
          (l) => l.id === s.locationId && l.workplaceId === s.workplaceId,
        ) ||
        !name(a.locationName) ||
        typeof a.timeZone !== "string" ||
        !validZone(a.timeZone) ||
        !commute(a.defaultCommute)
      )
        return fail();
    }
    if (
      a.address !== undefined &&
      (typeof a.address !== "string" || a.address.length > 500)
    )
      return fail();
    if (
      s.commuteSource === "location" &&
      (!s.locationId || !commute(s.commute))
    )
      return fail();
  }
  return data;
}
function migrate(
  storage: Storage,
  raw: string,
  backupBase: string,
  data: WorkspaceSchedule,
) {
  const serialized = JSON.stringify(data);
  decodeWorkspace(serialized);
  const previous = storage.getItem(backupBase);
  const backup =
    previous === null || previous === raw
      ? backupBase
      : `${backupBase}:${crypto.randomUUID()}`;
  storage.setItem(backup, raw);
  if (storage.getItem(backup) !== raw)
    throw Error("Backup verification failed. Migration stopped.");
  storage.setItem(WORKSPACE_KEY, serialized);
  if (storage.getItem(WORKSPACE_KEY) !== serialized)
    throw Error(
      "Migration write verification failed. Original data and backup are preserved.",
    );
  return data;
}
export function loadWorkspace(storage: Storage): WorkspaceSchedule {
  const current = storage.getItem(WORKSPACE_KEY);
  if (current !== null) return decodeWorkspace(current);
  const v2 = storage.getItem(SCHEDULE_KEY);
  if (v2 !== null) {
    const data = decodeSchedule(v2);
    return migrate(storage, v2, V2_BACKUP_KEY, {
      ...data,
      version: 3,
      workplaces: [],
      locations: [],
    });
  }
  const v1 = storage.getItem(SHIFT_KEY);
  if (v1 === null) return emptyWorkspace();
  const singles = decodeShifts(v1).map((s) => ({
    ...s,
    startAt: new Date(s.startAt).toISOString(),
    endAt: new Date(s.endAt).toISOString(),
  }));
  return migrate(storage, v1, "shiftsync:backup:v1", {
    ...emptyWorkspace(),
    singles,
  });
}
