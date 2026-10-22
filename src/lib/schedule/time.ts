import { Temporal } from "@js-temporal/polyfill";
export const browserZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export function zonedLocal(iso: string, zone: string) {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(zone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function instant(local: string, zone: string) {
  return Temporal.PlainDateTime.from(local)
    .toZonedDateTime(zone, { disambiguation: "compatible" })
    .toInstant()
    .toString();
}
export function dateInZone(date: Date, zone: string) {
  return Temporal.Instant.from(date.toISOString())
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
}
export function shiftDate(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function validZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return !/^[+-]/.test(zone);
  } catch {
    return false;
  }
}

export function localWeekday(local: string) {
  return Temporal.PlainDateTime.from(local).dayOfWeek;
}
