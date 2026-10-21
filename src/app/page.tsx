"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Moon,
  Sun,
  Plus,
  Trash2,
  Pencil,
  LayoutDashboard,
  ChartNoAxesCombined,
  Settings,
  Clock3,
  Coffee,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { Occurrence, Scope } from "@/lib/schedule/types";
import { conflictsForOccurrence } from "@/lib/schedule/conflicts";
import { deleteShift, saveShift } from "@/lib/schedule/mutations";
import { scheduleSummary, listOccurrences } from "@/lib/schedule/summary";
import { countdown } from "@/lib/dashboard";
import { useSchedule } from "@/hooks/useSchedule";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { ShiftEditor } from "@/components/ShiftEditor";
type Page = "Overview" | "Calendar" | "Analytics" | "Settings";
const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Calendar", icon: CalendarDays },
  { name: "Analytics", icon: ChartNoAxesCombined },
  { name: "Settings", icon: Settings },
] as const;
const display = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function Home() {
  const {
    schedule,
    setSchedule,
    ready,
    theme,
    setTheme,
    storageError,
    exportBackup,
  } = useSchedule();
  const [page, setPage] = useState<Page>("Overview");
  const [now, setNow] = useState<Date | null>(null);
  const [editor, setEditor] = useState<{
    shift?: Occurrence;
    start: Date;
    deleting?: boolean;
  } | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const sorted = useMemo(
    () => (now ? listOccurrences(schedule, now) : []),
    [schedule, now],
  );
  const summary = useMemo(
    () => (now ? scheduleSummary(schedule, now) : null),
    [schedule, now],
  );
  const issues = sorted.filter(
    (s) => conflictsForOccurrence(schedule, s).length > 0,
  ).length;
  function create(start?: Date) {
    const date = start ?? new Date();
    if (!start) date.setMinutes(0, 0, 0);
    setEditor({ start: date });
  }
  function edit(shift: Occurrence) {
    setEditor({ shift, start: new Date(shift.startAt) });
  }
  function remove(shift: Occurrence, scope?: Scope) {
    if (shift.seriesId && !scope) {
      setEditor({ shift, start: new Date(shift.startAt), deleting: true });
      return;
    }
    if (
      window.confirm(
        `Delete ${shift.title}${shift.seriesId ? ` (${scope})` : ""}?`,
      )
    ) {
      setSchedule((prev) => deleteShift(prev, shift, scope));
      setEditor(null);
    }
  }
  const renderList = (
    list: Occurrence[],
    emptyTitle: string,
    emptyText: string,
  ) => (
    <>
      {list.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Coffee size={24} />
          </span>
          <h3>{emptyTitle}</h3>
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="shiftlist">
          {list.map((s) => (
            <article className="shift" key={s.id}>
              <span className="shift-icon" style={{ borderColor: s.color }}>
                <Clock3 size={19} />
              </span>
              <div className="shiftbody">
                <strong>
                  {s.title}
                  {s.seriesId && <span className="repeat-badge">Repeats</span>}
                </strong>
                <small>
                  {s.seriesOnly
                    ? `Series rule · ${s.rule?.frequency} · ${s.rule?.timeZone}`
                    : `${display(s.startAt)} → ${display(s.endAt)}`}
                </small>
                {conflictsForOccurrence(schedule, s).length > 0 && (
                  <span className="warning">Overlaps another shift</span>
                )}
              </div>
              <button
                className="iconbutton"
                onClick={() => edit(s)}
                aria-label={`Edit ${s.title}`}
              >
                <Pencil size={16} />
              </button>
              <button
                className="iconbutton"
                onClick={() => remove(s)}
                aria-label={`Delete ${s.title}`}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
    </>
  );
  return (
    <main data-theme={theme} className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <span className="logo">
            <CalendarDays size={23} />
          </span>
          <strong>
            ShiftSync<span className="brand-dot">.</span>
          </strong>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-label={name}
              className={`navitem ${page === name ? "selected" : ""}`}
              aria-current={page === name ? "page" : undefined}
              onClick={() => setPage(name)}
            >
              <Icon size={20} />
              <span>{name}</span>
              {page === name && <span className="nav-marker" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" /> A little more balance.
          <p>A schedule that works for you.</p>
          <span className="tiny">LOCAL WORKSPACE · SPRINT 03</span>
        </div>
        <div className="profile">
          <span className="avatar">Y</span>
          <div>
            <strong>Your workspace</strong>
            <small>Personal schedule</small>
          </div>
          <ShieldCheck size={18} />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span> <strong>{page}</strong>
          </span>
          <div className="topbar-right">
            <button className="secondary backup-button" onClick={exportBackup}>
              Export JSON backup
            </button>
            <span className="local-badge">
              <span className="status-dot" />
              Local first
            </span>
            <button
              className="iconbutton"
              aria-label="Toggle theme"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <span className="avatar small">Y</span>
          </div>
        </header>
        <div className="content">
          <div className="intro">
            <div>
              <p className="eyebrow">A LITTLE STRUCTURE. MORE FREEDOM.</p>
              <h1>
                {page === "Overview"
                  ? "Your day, in sync."
                  : page === "Calendar"
                    ? "Make space for your life."
                    : page}
              </h1>
              <p className="sub">
                {page === "Overview"
                  ? "A clear view of work, rest, and everything in between."
                  : page === "Calendar"
                    ? "Your shifts, your rhythm. Plan with a little more clarity."
                    : "Your workspace is growing. More tools are on the way."}
              </p>
            </div>
            {(page === "Overview" || page === "Calendar") && (
              <button
                className="primary"
                disabled={!ready}
                onClick={() => create()}
              >
                <Plus size={18} />
                New shift
              </button>
            )}
          </div>
          {storageError && (
            <p role="alert" className="warning storage-error">
              {storageError}
            </p>
          )}
          {!ready || !now || !summary ? (
            <div className="panel loading" role="status">
              Getting your schedule ready…
            </div>
          ) : (
            <>
              {page === "Overview" && (
                <>
                  <section
                    className="dashboard-grid"
                    aria-label="Schedule summary"
                  >
                    <article className="next-shift">
                      <div className="card-label">
                        <span>
                          <span className="status-dot" /> NEXT SHIFT
                        </span>
                        <ArrowUpRight size={20} />
                      </div>
                      {summary.next ? (
                        <>
                          <h2>{summary.next.title}</h2>
                          <p>{display(summary.next.startAt)}</p>
                          <div className="countdown">
                            <Clock3 size={17} />
                            <span>{countdown(summary.next.startAt, now)}</span>
                            <small>
                              {+new Date(summary.next.startAt) > +now
                                ? "until you clock in"
                                : "You’re on the clock"}
                            </small>
                          </div>
                          <button
                            onClick={() => edit(summary.next!)}
                            className="hero-link"
                          >
                            View shift details <ArrowRight size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <h2>
                            Your next chapter
                            <br />
                            is wide open.
                          </h2>
                          <p>No upcoming shifts. Make your next plan.</p>
                          <button
                            className="hero-link"
                            onClick={() => create()}
                          >
                            Plan your first shift <ArrowRight size={16} />
                          </button>
                        </>
                      )}
                    </article>
                    <article className="stat">
                      <span className="stat-icon blue">
                        <Clock3 size={21} />
                      </span>
                      <p>This week</p>
                      <strong>
                        {Number(summary.hours.toFixed(1))}
                        <span> hrs</span>
                      </strong>
                      <small>Scheduled working hours</small>
                      <div className="stat-foot">
                        {schedule.singles.length + schedule.series.length}{" "}
                        shifts / series in your schedule
                      </div>
                    </article>
                    <article className="stat">
                      <span className="stat-icon green">
                        <Coffee size={21} />
                      </span>
                      <p>Next day off</p>
                      <strong className="day-off">
                        {summary.free
                          ? summary.free.toLocaleDateString(undefined, {
                              weekday: "long",
                            })
                          : "Fully planned"}
                      </strong>
                      <small>
                        {summary.free?.toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                        })}
                      </small>
                      <div className="stat-foot green-text">
                        {summary.free
                          ? "Nothing planned. Room to recharge."
                          : "No free day in the next 366 days."}
                      </div>
                    </article>
                  </section>
                  <section className="panel today-panel">
                    <div className="section-heading">
                      <div>
                        <h2>
                          Today{" "}
                          <span className="count-badge">
                            {summary.events.length}
                          </span>
                        </h2>
                        <p className="sub">
                          {now.toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span className="pill">
                        {issues
                          ? `${issues} overlap warnings`
                          : "Find your balance"}
                      </span>
                    </div>
                    {renderList(
                      summary.events,
                      "A little breathing room.",
                      "No shifts today. Make some time for yourself.",
                    )}
                  </section>
                </>
              )}
              {(page === "Overview" || page === "Calendar") && (
                <>
                  <div className="section-heading calendar-section-heading">
                    <div>
                      <h2>
                        {page === "Overview" ? "Your schedule" : "Schedule"}
                      </h2>
                      <p className="sub">
                        Work fits better when you can see the whole picture.
                      </p>
                    </div>
                  </div>
                  <WeeklyCalendar
                    schedule={schedule}
                    onEdit={edit}
                    onCreate={create}
                    now={now}
                  />
                  <section className="panel all-shifts">
                    <div className="section-heading">
                      <h2>
                        Shifts & series{" "}
                        <span className="count-badge">{sorted.length}</span>
                      </h2>
                      <span className="tiny">
                        CURRENT WEEK + NEXT OCCURRENCES
                      </span>
                    </div>
                    {renderList(
                      sorted,
                      "No shifts yet",
                      "Add your first shift and find your rhythm.",
                    )}
                  </section>
                </>
              )}
              {(page === "Analytics" || page === "Settings") && (
                <section className="panel placeholder">
                  <span className="empty-icon">
                    {page === "Analytics" ? (
                      <ChartNoAxesCombined size={30} />
                    ) : (
                      <Settings size={30} />
                    )}
                  </span>
                  <p className="eyebrow">COMING INTO FOCUS</p>
                  <h2>
                    {page === "Analytics"
                      ? "A clearer picture of your time."
                      : "A workspace that feels like you."}
                  </h2>
                  <p className="sub">
                    {page === "Analytics"
                      ? "Work patterns and insights will live here."
                      : "More preferences will live here. You can already switch themes in the top bar."}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setPage("Overview")}
                  >
                    Back to Overview
                  </button>
                </section>
              )}
            </>
          )}
          <footer>
            <ShieldCheck size={14} /> Your schedule stays in this browser.
            <span>Made for life beyond the 9–5.</span>
          </footer>
        </div>
      </div>
      {editor && (
        <ShiftEditor
          {...editor}
          schedule={schedule}
          onClose={() => setEditor(null)}
          onDelete={remove}
          onSave={(draft, repeat, scope) => {
            const updated = saveShift(
              schedule,
              draft,
              repeat,
              editor.shift,
              scope,
            );
            setSchedule(updated);
            setEditor(null);
          }}
        />
      )}
    </main>
  );
}
