import { Car, Repeat2 } from "lucide-react";
import type { CalendarEvent, Occurrence } from "@/lib/schedule/types";
import { blockDensity } from "@/lib/calendarZoom";
import type { layoutSegments } from "@/lib/calendar";
type Segment = ReturnType<typeof layoutSegments<CalendarEvent>>[number];
export const eventTime = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
export function EventIcon({ event }: { event: CalendarEvent }) {
  return event.kind !== "work" ? (
    <Car size={12} />
  ) : event.work.seriesId ? (
    <Repeat2 size={12} />
  ) : null;
}
export function CalendarEventBlock({
  segment,
  hourHeight,
  index,
  onEdit,
}: {
  segment: Segment;
  hourHeight: number;
  index: number;
  onEdit: (shift: Occurrence) => void;
}) {
  const { shift, top, height, start, end, column, columns } = segment;
  const pixels = (height / 100) * 24 * hourHeight;
  const density = blockDensity(pixels, hourHeight);
  const label = `${shift.title}: ${start.toLocaleString()} → ${end.toLocaleString()}${shift.work.assignment ? ` · ${shift.work.assignment.workplaceName} / ${shift.work.assignment.locationName ?? "No location"}` : ""}`;
  return (
    <button
      className={`calendar-event event-${density} ${shift.kind !== "work" ? "commute-event" : ""}`}
      data-density={density}
      title={label}
      aria-label={`Edit ${shift.title}, ${start.toLocaleString()} to ${end.toLocaleString()}`}
      onClick={() => onEdit(shift.work)}
      style={{
        top: `${top}%`,
        height: `${height}%`,
        left: `${(column * 100) / columns}%`,
        width: `${100 / columns}%`,
        borderLeftColor: shift.color,
        zIndex: index + 1,
      }}
    >
      <span className="event-content">
        <span className="event-type">
          {shift.kind !== "work"
            ? "Unpaid travel"
            : shift.work.seriesId
              ? "Repeating shift"
              : "Work shift"}
        </span>
        <span className="event-heading">
          <span className="event-dot" style={{ background: shift.color }} />
          <EventIcon event={shift} />
          <strong>
            {shift.kind === "work"
              ? shift.title
              : shift.kind === "before"
                ? "To shift"
                : "From shift"}
          </strong>
        </span>
        <small className="event-time">
          {`${eventTime(start)} – ${eventTime(end)}`}
        </small>
        {shift.kind === "work" && shift.work.assignment?.locationName && (
          <span className="event-location">
            {shift.work.assignment.locationName}
          </span>
        )}
        {density === "detailed" && (
          <span className="event-extra">
            {shift.work.assignment?.workplaceName && (
              <span>{shift.work.assignment.workplaceName}</span>
            )}
            <span>
              {Math.round(
                (+new Date(shift.endAt) - +new Date(shift.startAt)) / 60000,
              )}{" "}
              min · {shift.kind === "work" ? "Work" : "Unpaid travel"}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}
