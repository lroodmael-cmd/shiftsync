import { validZone } from "../schedule/time";
import { workplaceIcons } from "./types";
import type {
  ShiftAssociation,
  Workplace,
  WorkLocation,
  WorkspaceSchedule,
} from "./types";
export function associationRecords(
  data: WorkspaceSchedule,
): ShiftAssociation[] {
  return [
    ...data.singles,
    ...data.series,
    ...data.exceptions.flatMap((e) => (e.override ? [e.override] : [])),
  ];
}
export function workplaceReferenced(data: WorkspaceSchedule, id: string) {
  return associationRecords(data).some((s) => s.workplaceId === id);
}
export function locationReferenced(data: WorkspaceSchedule, id: string) {
  return associationRecords(data).some((s) => s.locationId === id);
}
const color = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
export function saveWorkplace(
  data: WorkspaceSchedule,
  value: Workplace,
): WorkspaceSchedule {
  if (
    !value.name.trim() ||
    value.name.length > 120 ||
    !color(value.color) ||
    !workplaceIcons.includes(value.icon)
  )
    throw Error("Enter a workplace name and valid color.");
  const saved = {
    ...value,
    name: value.name.trim(),
    isPrimary: value.archived ? false : value.isPrimary,
  };
  return {
    ...data,
    workplaces: [
      ...data.workplaces
        .filter((w) => w.id !== value.id)
        .map((w) => (saved.isPrimary ? { ...w, isPrimary: false } : w)),
      saved,
    ],
  };
}
export function saveLocation(
  data: WorkspaceSchedule,
  value: WorkLocation,
  makeDefault = false,
): WorkspaceSchedule {
  const owner = data.workplaces.find((w) => w.id === value.workplaceId);
  if (!owner) throw Error("This workplace no longer exists.");
  if (
    !value.name.trim() ||
    value.name.length > 120 ||
    !validZone(value.timeZone) ||
    (value.color && !color(value.color)) ||
    (value.address && value.address.length > 500)
  )
    throw Error("Enter a location name, valid IANA time zone and color.");
  if (
    ["beforeMinutes", "afterMinutes"].some((k) => {
      const v = value.commute[k as keyof typeof value.commute];
      return !Number.isInteger(v) || v < 0 || v > 720;
    })
  )
    throw Error("Commute durations must be whole minutes from 0 to 720.");
  const existing = data.locations.find((l) => l.id === value.id);
  if (existing && existing.workplaceId !== value.workplaceId)
    throw Error("A location cannot be moved to another workplace.");
  const locations = [
    ...data.locations.filter((l) => l.id !== value.id),
    {
      ...value,
      name: value.name.trim(),
      address: value.address?.trim() || undefined,
    },
  ];
  const active = locations.filter(
    (l) => l.workplaceId === owner.id && !l.archived,
  );
  const defaultId =
    makeDefault && !value.archived
      ? value.id
      : active.some((l) => l.id === owner.defaultLocationId)
        ? owner.defaultLocationId
        : active[0]?.id;
  return {
    ...data,
    locations,
    workplaces: data.workplaces.map((w) =>
      w.id === owner.id ? { ...w, defaultLocationId: defaultId } : w,
    ),
  };
}
export function archiveWorkplace(
  data: WorkspaceSchedule,
  id: string,
  archived: boolean,
): WorkspaceSchedule {
  return {
    ...data,
    workplaces: data.workplaces.map((w) =>
      w.id === id
        ? { ...w, archived, isPrimary: archived ? false : w.isPrimary }
        : w,
    ),
  };
}
export function archiveLocation(
  data: WorkspaceSchedule,
  id: string,
  archived: boolean,
): WorkspaceSchedule {
  const location = data.locations.find((l) => l.id === id);
  if (!location) throw Error("Location not found.");
  return saveLocation(data, { ...location, archived });
}
export function deleteWorkplace(
  data: WorkspaceSchedule,
  id: string,
): WorkspaceSchedule {
  if (workplaceReferenced(data, id)) return archiveWorkplace(data, id, true);
  return {
    ...data,
    workplaces: data.workplaces.filter((w) => w.id !== id),
    locations: data.locations.filter((l) => l.workplaceId !== id),
  };
}
export function deleteLocation(
  data: WorkspaceSchedule,
  id: string,
): WorkspaceSchedule {
  if (locationReferenced(data, id)) return archiveLocation(data, id, true);
  const removed = data.locations.find((l) => l.id === id);
  const locations = data.locations.filter((l) => l.id !== id);
  return {
    ...data,
    locations,
    workplaces: data.workplaces.map((w) =>
      w.id === removed?.workplaceId && w.defaultLocationId === id
        ? {
            ...w,
            defaultLocationId: locations.find(
              (l) => l.workplaceId === w.id && !l.archived,
            )?.id,
          }
        : w,
    ),
  };
}
export function selectionDefaults(
  data: WorkspaceSchedule,
  workplaceId: string,
  locationId?: string,
) {
  const workplace = data.workplaces.find((w) => w.id === workplaceId);
  if (!workplace || workplace.archived)
    throw Error("Choose an active workplace.");
  const chosen =
    locationId === undefined ? workplace.defaultLocationId : locationId;
  const location = chosen
    ? data.locations.find(
        (l) => l.id === chosen && l.workplaceId === workplaceId && !l.archived,
      )
    : undefined;
  if (chosen && !location)
    throw Error("Choose an active location for this workplace.");
  return {
    workplaceId: workplace.id,
    locationId: location?.id,
    color: location?.color ?? workplace.color,
    timeZone: location?.timeZone,
    commute: location ? { ...location.commute } : undefined,
    commuteSource: location ? ("location" as const) : ("custom" as const),
    assignment: {
      workplaceName: workplace.name,
      workplaceColor: workplace.color,
      workplaceIcon: workplace.icon,
      locationName: location?.name,
      address: location?.address,
      timeZone: location?.timeZone,
      defaultCommute: location ? { ...location.commute } : undefined,
    },
  };
}
