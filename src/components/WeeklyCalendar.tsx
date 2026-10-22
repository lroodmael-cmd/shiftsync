"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, layoutSegments, startOfWeek } from "@/lib/calendar";
import type { Occurrence } from "@/lib/schedule/types";
import type { WorkspaceSchedule } from "@/lib/workplaces/types";
import { calendarEvents } from "@/lib/schedule/commute";
import { useCalendarZoom } from "@/hooks/useCalendarZoom";
import { CalendarZoomControls } from "./CalendarZoomControls";
import { CalendarEventBlock, EventIcon } from "./CalendarEventBlock";
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
  const scope = useRef<HTMLElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const {
    hourHeight,
    setZoom,
    ready: zoomReady,
    sessionOnly,
  } = useCalendarZoom(scope, scroll);
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
  const dayLayouts = days.map((day) => layoutSegments(shifts, day));
  const smallEvents = [
    ...new Map(
      dayLayouts
        .flat()
        .filter((s) => (s.height / 100) * 24 * hourHeight < 44)
        .map((s) => [s.shift.id, s.shift]),
    ).values(),
  ];
  useLayoutEffect(() => {
    if (!zoomReady) return;
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
      top: Math.max(0, hour - 2) * hourHeight,
      behavior: "instant",
    });
    // Scroll on navigation only, so the minute timer never moves the user's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, count, zoomReady]);
  return (
    <section
      ref={scope}
      className="panel calendar"
      aria-label="Schedule calendar"
      data-hour-height={hourHeight}
      style={{ "--hour-height": `${hourHeight}px` } as CSSProperties}
    >
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
            {`${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })}${count > 1 ? ` – ${days[count - 1].toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}`}
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
        <CalendarZoomControls value={hourHeight} onChange={setZoom} />
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
          {days.map((day, dayIndex) => {
            const segments = dayLayouts[dayIndex];
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
                {segments.map((segment, index) => (
                  <CalendarEventBlock
                    key={segment.shift.id}
                    segment={segment}
                    hourHeight={hourHeight}
                    index={index}
                    onEdit={onEdit}
                  />
                ))}
                {sameDay(day, now) && (
                  <div
                    className="now-line"
                    style={{
                      top: `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%`,
                    }}
                    aria-label={`Current time ${time(now)}`}
                  >
                    <span className="now-dot" />
                    <span className="now-time">{time(now)}</span>
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
        <span>Cmd / Ctrl + scroll inside the calendar to zoom</span>
      </div>
      {sessionOnly && (
        <p className="zoom-note" role="status">
          Zoom changes are saved for this session only. Browser storage is
          unavailable.
        </p>
      )}
      {smallEvents.length > 0 && (
        <details className="small-events">
          <summary>{`Small events (${smallEvents.length}) · Open details`}</summary>
          <p className="field-note">
            These blocks keep their true duration on the grid. Use this list for
            easier selection.
          </p>
          <div>
            {smallEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className="small-event"
                onClick={() => onEdit(event.work)}
              >
                <span
                  className="small-event-color"
                  style={{ background: event.color }}
                />
                <EventIcon event={event} />
                <span>
                  <strong>{event.title}</strong>
                  <small>
                    {new Date(event.startAt).toLocaleString()} →{" "}
                    {new Date(event.endAt).toLocaleString()}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
