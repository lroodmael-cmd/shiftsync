import type { Shift } from "../shifts";
import type { CommuteSettings, ShiftAssociation } from "../workplaces/types";
export type Commute = CommuteSettings;
export type WorkShift = Shift & ShiftAssociation & { commute?: Commute };
export type Frequency = "none" | "daily" | "weekly";
export type Rule = {
  frequency: "daily" | "weekly";
  startDate: string;
  until?: string;
  weekdays: number[];
  timeZone: string;
};
export type Series = ShiftAssociation & {
  id: string;
  title: string;
  color: string;
  startTime: string;
  endTime: string;
  endDayOffset: number;
  commute: Commute;
  rule: Rule;
};
export type Exception =
  | { seriesId: string; date: string; deleted: true; override?: never }
  | { seriesId: string; date: string; override: WorkShift; deleted?: never };
export type Schedule = {
  version: 2 | 3;
  singles: WorkShift[];
  series: Series[];
  exceptions: Exception[];
};
export type Occurrence = WorkShift & {
  seriesId?: string;
  occurrenceDate?: string;
  rule?: Rule;
  seriesOnly?: boolean;
};
export type CalendarEvent = Shift & {
  kind: "work" | "before" | "after";
  work: Occurrence;
};
export type Scope = "only" | "following" | "all";
export type RepeatSettings = {
  frequency: Frequency;
  timeZone: string;
  weekdays: number[];
  until?: string;
  startLocal?: string;
  endLocal?: string;
};
export const emptySchedule = (): Schedule => ({
  version: 2,
  singles: [],
  series: [],
  exceptions: [],
});
export const noCommute: Commute = { beforeMinutes: 0, afterMinutes: 0 };
