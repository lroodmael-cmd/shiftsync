import { Temporal } from "@js-temporal/polyfill";
import { decodeShifts, SHIFT_KEY } from "../storage";
import { validateShift } from "../shifts";
import type { Schedule, WorkShift, Series } from "./types";
import { emptySchedule } from "./types";
import { validZone } from "./time";
export const SCHEDULE_KEY = "shiftsync:v2:schedule";
export const BACKUP_KEY = "shiftsync:backup:v1";
const fail = (): never => {
  throw Error(
    "Invalid saved schedule. Export a JSON backup before repairing storage.",
  );
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const date = (v: unknown) => {
  try {
    return (
      typeof v === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Temporal.PlainDate.from(v).toString() === v
    );
  } catch {
    return false;
  }
};
const time = (v: unknown) =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const utc = (v: unknown) => {
  try {
    return (
      typeof v === "string" && v.endsWith("Z") && !!Temporal.Instant.from(v)
    );
  } catch {
    return false;
  }
};
const color = (v: unknown) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
function commute(v: unknown) {
  return (
    record(v) &&
    ["beforeMinutes", "afterMinutes"].every(
      (k) =>
        typeof v[k] === "number" &&
        Number.isInteger(v[k]) &&
        v[k] >= 0 &&
        v[k] <= 720,
    )
  );
}
function work(v: unknown): v is WorkShift {
  return (
    record(v) &&
    typeof v.id === "string" &&
    !!v.id &&
    typeof v.title === "string" &&
    utc(v.startAt) &&
    utc(v.endAt) &&
    color(v.color) &&
    (v.commute === undefined || commute(v.commute)) &&
    !validateShift(v as WorkShift)
  );
}
function series(v: unknown): v is Series {
  if (
    !record(v) ||
    typeof v.id !== "string" ||
    !v.id ||
    typeof v.title !== "string" ||
    !v.title.trim() ||
    !color(v.color) ||
    !time(v.startTime) ||
    !time(v.endTime) ||
    !Number.isInteger(v.endDayOffset) ||
    Number(v.endDayOffset) < 0 ||
    Number(v.endDayOffset) > 2 ||
    !commute(v.commute) ||
    !record(v.rule)
  )
    return false;
  const r = v.rule;
  if (
    !["daily", "weekly"].includes(String(r.frequency)) ||
    !date(r.startDate) ||
    (r.until !== undefined &&
      (!date(r.until) || String(r.until) < String(r.startDate))) ||
    typeof r.timeZone !== "string" ||
    !validZone(r.timeZone) ||
    !Array.isArray(r.weekdays) ||
    r.weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7) ||
    new Set(r.weekdays).size !== r.weekdays.length ||
    (r.frequency === "weekly" && !r.weekdays.length)
  )
    return false;
  const minutes = (s: string) =>
    Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const duration =
    Number(v.endDayOffset) * 1440 +
    minutes(v.endTime as string) -
    minutes(v.startTime as string);
  return duration > 0 && duration <= 2160;
}
export function decodeSchedule(raw: string): Schedule {
  const value: unknown = JSON.parse(raw);
  if (
    !record(value) ||
    value.version !== 2 ||
    !Array.isArray(value.singles) ||
    !Array.isArray(value.series) ||
    !Array.isArray(value.exceptions)
  )
    return fail();
  if (!value.singles.every(work) || !value.series.every(series)) return fail();
  const ids = [...value.singles, ...value.series].map((s) => s.id);
  if (new Set(ids).size !== ids.length) return fail();
  const keys = new Set<string>();
  for (const e of value.exceptions) {
    if (
      !record(e) ||
      typeof e.seriesId !== "string" ||
      !date(e.date) ||
      !value.series.some((s) => s.id === e.seriesId) ||
      (e.deleted === true
        ? e.override !== undefined
        : !work(e.override) || e.deleted !== undefined)
    )
      return fail();
    const owner = value.series.find((s) => s.id === e.seriesId)!;
    if (
      String(e.date) < owner.rule.startDate ||
      (owner.rule.until && String(e.date) > owner.rule.until)
    )
      return fail();
    const key = `${e.seriesId}@${e.date}`;
    if (keys.has(key)) return fail();
    keys.add(key);
  }
  return value as Schedule;
}
export function loadSchedule(storage: Storage): Schedule {
  const current = storage.getItem(SCHEDULE_KEY);
  if (current !== null) return decodeSchedule(current);
  const legacy = storage.getItem(SHIFT_KEY);
  if (legacy === null) return emptySchedule();
  const shifts = decodeShifts(legacy);
  const migrated: Schedule = {
    ...emptySchedule(),
    singles: shifts.map((s) => ({
      ...s,
      startAt: new Date(s.startAt).toISOString(),
      endAt: new Date(s.endAt).toISOString(),
    })),
  };
  decodeSchedule(JSON.stringify(migrated));
  const key =
    storage.getItem(BACKUP_KEY) === null ||
    storage.getItem(BACKUP_KEY) === legacy
      ? BACKUP_KEY
      : `${BACKUP_KEY}:${crypto.randomUUID()}`;
  // Never write v2 until the exact legacy payload has a verified backup. v1 remains untouched.
  storage.setItem(key, legacy);
  if (storage.getItem(key) !== legacy)
    throw Error("Backup could not be verified. Migration stopped.");
  storage.setItem(SCHEDULE_KEY, JSON.stringify(migrated));
  return migrated;
}
export function backupPayload(storage: Storage) {
  const backups: Record<string, string | null> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith("shiftsync:")) backups[key] = storage.getItem(key);
  }
  return JSON.stringify(
    {
      format: "shiftsync-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      storage: backups,
    },
    null,
    2,
  );
}
