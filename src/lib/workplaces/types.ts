import type { Schedule } from "../schedule/types";
export type CommuteSettings = { beforeMinutes: number; afterMinutes: number };
export const workplaceIcons = [
  "briefcase",
  "warehouse",
  "hospital",
  "restaurant",
  "building",
] as const;
export type WorkplaceIcon = (typeof workplaceIcons)[number];
export type Workplace = {
  id: string;
  name: string;
  color: string;
  icon: WorkplaceIcon;
  archived: boolean;
  isPrimary: boolean;
  defaultLocationId?: string;
};
export type WorkLocation = {
  id: string;
  workplaceId: string;
  name: string;
  address?: string;
  timeZone: string;
  commute: CommuteSettings;
  color?: string;
  archived: boolean;
};
export type AssignmentSnapshot = {
  workplaceName: string;
  workplaceIcon: WorkplaceIcon;
  workplaceColor: string;
  locationName?: string;
  address?: string;
  timeZone?: string;
  defaultCommute?: CommuteSettings;
};
export type ShiftAssociation = {
  workplaceId?: string;
  locationId?: string;
  assignment?: AssignmentSnapshot;
  commuteSource?: "location" | "custom";
  timeZone?: string;
};
export type WorkspaceSchedule = Schedule & {
  version: 3;
  workplaces: Workplace[];
  locations: WorkLocation[];
};
export const emptyWorkspace = (): WorkspaceSchedule => ({
  version: 3,
  singles: [],
  series: [],
  exceptions: [],
  workplaces: [],
  locations: [],
});
// Copy relationships and historical labels explicitly through recurrence generation.
export function associationOf(value: ShiftAssociation): ShiftAssociation {
  return {
    workplaceId: value.workplaceId,
    locationId: value.locationId,
    assignment: value.assignment,
    commuteSource: value.commuteSource,
    timeZone: value.timeZone,
  };
}
