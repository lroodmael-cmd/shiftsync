"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Car, Repeat2 } from "lucide-react";
import { addDays, layoutSegments, startOfWeek } from "@/lib/calendar";
import type { CalendarEvent, Occurrence, Schedule } from "@/lib/schedule/types";
import type { WorkspaceSchedule } from "@/lib/workplaces/types";
import { calendarEvents } from "@/lib/schedule/commute";
type View = "Day" | "3 Days" | "Week";
const time = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
export function WeeklyCalendar({
  schedule,
  onEdit,
  onCreate,
  now,
  workplaceFilter,
  onWorkplaceFilterChange,
}: {
  schedule: WorkspaceSchedule;
  onEdit: (s: Occurrence) => void;
  onCreate: (date: Date) => void;
  now: Date;
  workplaceFilter: string;
  onWorkplaceFilterChange: (id: string) => void;
}) {
  const [view, setView] = useState<View>("Week");
  const [anchor, setAnchor] = useState(() => new Date(now));
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 700px)").matches) setView("Day");
  }, []);
  const count = view === "Week" ? 7 : view === "3 Days" ? 3 : 1;
  const first = view === "Week" ? startOfWeek(anchor) : new Date(anchor);
  first.setHours(0, 0, 0, 0);
  const days = Array.from({ length: count }, (_, i) => addDays(first, i));
  const key = first.toDateString();
  useEffect(() => {
    if (
      workplaceFilter !== "all" &&
      workplaceFilter !== "unassigned" &&
      !schedule.workplaces.some((w) => w.id === workplaceFilter)
    )
      onWorkplaceFilterChange("all");
  }, [workplaceFilter, schedule.workplaces, onWorkplaceFilterChange]);
  const shifts = calendarEvents(schedule, first, addDays(first, count)).filter(
    (e) =>
      workplaceFilter === "all" ||
      (workplaceFilter === "unassigned"
        ? !e.work.workplaceId
        : e.work.workplaceId === workplaceFilter),
  );
  useEffect(() => {
    const visible = shifts.filter(
      (s) =>
        +new Date(s.startAt) < +addDays(first, count) &&
        +new Date(s.endAt) > +first,
    );
    const hour = days.some((d) => sameDay(d, now))
      ? now.getHours()
      : visible.length
        ? new Date(Math.max(+first, +new Date(visible[0].startAt))).getHours()
        : 8;
    scroll.current?.scrollTo?.({
      top: Math.max(0, hour - 2) * 64,
      behavior: "instant",
    });
    // Scroll on navigation only, so the minute timer never moves the user's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, count]);
  return (
    <section className="panel calendar" aria-label="Schedule calendar">
      <div className="calendar-toolbar">
        <div>
          <p className="eyebrow">YOUR TIME, AT A GLANCE</p>
          <h2>
            {first.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <p className="sub" aria-live="polite">
            {first.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
            {count > 1 &&
              ` – ${days[count - 1].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
          </p>
        </div>
        <div className="calendar-controls">
          <label className="calendar-filter">
            Workplace
            <select
              aria-label="Filter calendar by workplace"
              value={workplaceFilter}
              onChange={(e) => onWorkplaceFilterChange(e.target.value)}
            >
              <option value="all">All workplaces</option>
              <option value="unassigned">No workplace</option>
              {schedule.workplaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.archived ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="view-switch" role="group" aria-label="Calendar view">
            {(["Day", "3 Days", "Week"] as View[]).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <nav aria-label="Calendar navigation">
            <button
              className="iconbutton"
              aria-label="Previous period"
              onClick={() => setAnchor(addDays(anchor, -count))}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="secondary"
              onClick={() => setAnchor(new Date(now))}
            >
              Today
            </button>
            <button
              className="iconbutton"
              aria-label="Next period"
              onClick={() => setAnchor(addDays(anchor, count))}
            >
              <ChevronRight size={18} />
            </button>
          </nav>
        </div>
      </div>
      <div
        className="calendar-scroll"
        ref={scroll}
        tabIndex={0}
        aria-label="Scrollable calendar"
      >
        <div
          className="week-grid"
          style={{
            gridTemplateColumns: `48px repeat(${count}, minmax(100px, 1fr))`,
            minWidth: count === 7 ? 760 : count === 3 ? 380 : 0,
          }}
        >
          <div className="day-heading time-heading">
            GMT{now.getTimezoneOffset() <= 0 ? "+" : "−"}
            {Math.abs(now.getTimezoneOffset() / 60)}
          </div>
          {days.map((day) => (
            <div
              className={`day-heading ${sameDay(day, now) ? "is-today" : ""}`}
              key={+day}
            >
              <span>
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <strong>{day.getDate()}</strong>
            </div>
          ))}
          <div className="time-axis">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: `${(h / 24) * 100}%` }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((day) => {
            const segments = layoutSegments(shifts, day);
            return (
              <div
                className={`day-column ${sameDay(day, now) ? "today-column" : ""}`}
                key={+day}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <button
                    className="time-slot"
                    key={hour}
                    style={{ top: `${(hour / 24) * 100}%` }}
                    aria-label={`Create shift ${day.toLocaleDateString()} ${String(hour).padStart(2, "0")}:00`}
                    onClick={() => {
                      const start = new Date(day);
                      start.setHours(hour);
                      onCreate(start);
                    }}
                  >
                    <Plus size={14} />
                  </button>
                ))}
                {segments.map(
                  ({ shift, top, height, start, end, column, columns }, i) => {
                    return (
                      <button
                        key={shift.id}
                        className={`calendar-event ${shift.kind !== "work" ? "commute-event" : ""}`}
                        title={`${shift.title}: ${start.toLocaleString()} → ${end.toLocaleString()}${shift.work.assignment ? ` · ${shift.work.assignment.workplaceName} / ${shift.work.assignment.locationName ?? "No location"}` : ""}`}
                        aria-label={`Edit ${shift.title}, ${start.toLocaleString()} to ${end.toLocaleString()}`}
                        onClick={() => onEdit(shift.work)}
                        style={{
                          top: `${top}%`,
                          height: `${height}%`,
                          left: `${(column * 100) / columns}%`,
                          width: `${100 / columns}%`,
                          borderLeftColor: shift.color,
                          zIndex: i + 1,
                        }}
                      >
                        <span
                          className="event-dot"
                          style={{ background: shift.color }}
                        />
                        <span className="event-type">
                          {shift.kind !== "work" ? (
                            <>
                              <Car size={12} />
                              Unpaid travel
                            </>
                          ) : shift.work.seriesId ? (
                            <>
                              <Repeat2 size={12} />
                              Repeating shift
                            </>
                          ) : null}
                        </span>
                        <strong>
                          {shift.kind === "work" ? (
                            shift.title
                          ) : (
                            <>
                              <Car size={12} />
                              {shift.kind === "before"
                                ? "To shift"
                                : "From shift"}
                            </>
                          )}
                        </strong>
                        {shift.kind === "work" &&
                          shift.work.assignment?.locationName && (
                            <span className="event-location">
                              {shift.work.assignment.locationName}
                            </span>
                          )}
                        <small>
                          {time(start)} – {time(end)}
                        </small>
                      </button>
                    );
                  },
                )}
                {sameDay(day, now) && (
                  <div
                    className="now-line"
                    style={{
                      top: `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%`,
                    }}
                    aria-label={`Current time ${time(now)}`}
                  >
                    <span />
                    {time(now)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="calendar-footer">
        <span>
          <i /> Current time
        </span>
        <span>Click an empty hour to plan a shift</span>
      </div>
    </section>
  );
}
