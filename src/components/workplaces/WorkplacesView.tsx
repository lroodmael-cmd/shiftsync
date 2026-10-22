"use client";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Pencil,
  Archive,
  Trash2,
  MapPin,
  Car,
  Star,
  RotateCcw,
} from "lucide-react";
import type {
  Workplace,
  WorkLocation,
  WorkspaceSchedule,
} from "@/lib/workplaces/types";
import {
  saveWorkplace,
  saveLocation,
  archiveWorkplace,
  archiveLocation,
  deleteWorkplace,
  deleteLocation,
  workplaceReferenced,
  locationReferenced,
} from "@/lib/workplaces/operations";
import { listOccurrences } from "@/lib/schedule/summary";
import type { Occurrence } from "@/lib/schedule/types";
import { WorkplaceIcon } from "./WorkplaceIcon";
import { WorkplaceForm } from "./WorkplaceForm";
import { LocationForm } from "./LocationForm";
import { ConfirmationPanel } from "../ConfirmationPanel";
type Editor =
  | { kind: "workplace"; value?: Workplace }
  | { kind: "location"; owner: Workplace; value?: WorkLocation };
export function WorkplacesView({
  data,
  now,
  onChange,
  onEditShift,
  onCalendar,
}: {
  data: WorkspaceSchedule;
  now: Date;
  onChange: (d: WorkspaceSchedule) => void;
  onEditShift: (s: Occurrence) => void;
  onCalendar: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [status, setStatus] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    run: () => void;
  } | null>(null);
  const workplace = data.workplaces.find((w) => w.id === selected);
  const locations = data.locations.filter((l) => l.workplaceId === selected);
  const associated = useMemo(
    () => listOccurrences(data, now).filter((s) => s.workplaceId === selected),
    [data, now, selected],
  );
  const visible = showHistory
    ? associated
    : associated.filter((s) => +new Date(s.endAt) > +now);
  function update(next: WorkspaceSchedule, message: string) {
    onChange(next);
    setStatus(message);
  }
  function archive(w: Workplace) {
    const run = () => {
      update(
        archiveWorkplace(data, w.id, !w.archived),
        w.archived
          ? "Workplace restored."
          : "Workplace archived. History preserved.",
      );
    };
    if (w.archived) run();
    else
      setConfirmation({
        title: `Archive ${w.name}?`,
        message:
          "Saved shifts and locations will remain available. You can restore this workplace later.",
        run,
      });
  }
  return (
    <section className="workplaces-view">
      <div className="intro">
        <div>
          <p className="eyebrow">ONE LIFE. DIFFERENT PLACES.</p>
          <h1>Your workplaces</h1>
          <p className="sub">
            Your jobs, familiar places, and the time it takes to get there.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => setEditor({ kind: "workplace" })}
        >
          <Plus size={18} />
          Add workplace
        </button>
      </div>
      {status && (
        <p className="success-note" role="status">
          {status}
        </p>
      )}
      {!workplace ? (
        <>
          {data.workplaces.length === 0 ? (
            <div className="panel workplace-empty">
              <span className="empty-icon">
                <MapPin size={26} />
              </span>
              <h2>Make work feel a little more organised.</h2>
              <p className="sub">
                Add a workplace, save your usual locations, and plan your next
                shift in seconds.
              </p>
              <button
                className="secondary"
                onClick={() => setEditor({ kind: "workplace" })}
              >
                Add your first workplace
              </button>
            </div>
          ) : (
            <div className="workplace-grid">
              {data.workplaces.map((w) => {
                const count = data.locations.filter(
                  (l) => l.workplaceId === w.id,
                ).length;
                const used = workplaceReferenced(data, w.id);
                return (
                  <article
                    className={`panel workplace-card ${w.archived ? "archived-card" : ""}`}
                    key={w.id}
                  >
                    <button
                      className="workplace-card-main"
                      onClick={() => setSelected(w.id)}
                      aria-label={`Open ${w.name}`}
                    >
                      <span
                        className="workplace-symbol"
                        style={{ color: w.color, borderColor: w.color }}
                      >
                        <WorkplaceIcon name={w.icon} />
                      </span>
                      <h2>{w.name}</h2>
                      <span className="sub">
                        {count} {count === 1 ? "location" : "locations"}
                      </span>
                      <ArrowRight size={18} />
                    </button>
                    <div className="workplace-badges">
                      {w.isPrimary && (
                        <span className="pill">
                          <Star size={11} />
                          Primary
                        </span>
                      )}
                      {w.archived && <span className="pill">Archived</span>}
                    </div>
                    <div className="workplace-actions">
                      <button
                        className="secondary"
                        aria-label={`Edit workplace ${w.name}`}
                        onClick={() =>
                          setEditor({ kind: "workplace", value: w })
                        }
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        className="secondary"
                        aria-label={`${w.archived ? "Restore" : "Archive"} workplace ${w.name}`}
                        onClick={() => archive(w)}
                      >
                        {w.archived ? (
                          <RotateCcw size={14} />
                        ) : (
                          <Archive size={14} />
                        )}{" "}
                        {w.archived ? "Restore" : "Archive"}
                      </button>
                      {!used && (
                        <button
                          className="iconbutton"
                          aria-label={`Delete workplace ${w.name}`}
                          onClick={() => {
                            setConfirmation({
                              title: `Delete ${w.name}?`,
                              message:
                                "This removes the workplace and its unused locations. This action cannot be undone.",
                              run: () =>
                                update(
                                  deleteWorkplace(data, w.id),
                                  "Workplace deleted.",
                                ),
                            });
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    {used && (
                      <p className="field-note reference-note">
                        Linked to shifts. Archive to keep their history.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <button className="text-button" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} />
            All workplaces
          </button>
          <section className="panel workplace-detail">
            <div className="section-heading">
              <div className="workplace-detail-title">
                <span
                  className="workplace-symbol"
                  style={{
                    color: workplace.color,
                    borderColor: workplace.color,
                  }}
                >
                  <WorkplaceIcon name={workplace.icon} />
                </span>
                <div>
                  <h2>{workplace.name}</h2>
                  <p className="sub">
                    {workplace.archived
                      ? "Archived workplace"
                      : "Active workplace"}
                    {workplace.isPrimary ? " · Primary" : ""}
                  </p>
                </div>
              </div>
              <div className="workplace-actions">
                <button
                  className="secondary"
                  onClick={() =>
                    setEditor({ kind: "workplace", value: workplace })
                  }
                >
                  Edit workplace
                </button>
                <button
                  className="secondary"
                  onClick={() => archive(workplace)}
                >
                  {workplace.archived
                    ? "Restore workplace"
                    : "Archive workplace"}
                </button>
                {!workplace.archived && !workplace.isPrimary && (
                  <button
                    className="secondary"
                    onClick={() =>
                      update(
                        saveWorkplace(data, { ...workplace, isPrimary: true }),
                        "Primary workplace updated.",
                      )
                    }
                  >
                    Make primary
                  </button>
                )}
                <button
                  className="secondary"
                  onClick={() => onCalendar(workplace.id)}
                >
                  View calendar
                </button>
              </div>
            </div>
            <p className="field-note">
              Saved shift labels, colors and travel times are snapshots. Editing
              this workplace does not rewrite them.
            </p>
          </section>
          <section className="panel locations-panel">
            <div className="section-heading">
              <div>
                <h2>
                  Locations{" "}
                  <span className="count-badge">{locations.length}</span>
                </h2>
                <p className="sub">Your usual places and travel time.</p>
              </div>
              <button
                className="secondary"
                disabled={workplace.archived}
                onClick={() =>
                  setEditor({ kind: "location", owner: workplace })
                }
              >
                <Plus size={15} />
                Add location
              </button>
            </div>
            {locations.length === 0 ? (
              <div className="empty">
                <MapPin size={26} />
                <h3>Where do you usually work?</h3>
                <p>
                  Add a location to reuse its timezone and commute settings.
                </p>
              </div>
            ) : (
              <div className="location-list">
                {locations.map((l) => {
                  const used = locationReferenced(data, l.id);
                  return (
                    <article
                      key={l.id}
                      className={`location-card ${l.archived ? "archived-card" : ""}`}
                    >
                      <span
                        className="location-dot"
                        style={{ background: l.color ?? workplace.color }}
                      />
                      <div className="location-content">
                        <h3>
                          {l.name}
                          {workplace.defaultLocationId === l.id && (
                            <span className="pill">Default</span>
                          )}
                          {l.archived && <span className="pill">Archived</span>}
                        </h3>
                        {l.address && <p className="sub">{l.address}</p>}
                        <p className="field-note">{l.timeZone}</p>
                        <span className="travel-summary">
                          <Car size={14} />
                          {l.commute.beforeMinutes} min there ·{" "}
                          {l.commute.afterMinutes} min back
                        </span>
                        <div className="workplace-actions">
                          <button
                            className="secondary"
                            aria-label={`Edit location ${l.name}`}
                            onClick={() =>
                              setEditor({
                                kind: "location",
                                owner: workplace,
                                value: l,
                              })
                            }
                          >
                            Edit
                          </button>
                          {!l.archived &&
                            workplace.defaultLocationId !== l.id && (
                              <button
                                className="secondary"
                                aria-label={`Make ${l.name} default`}
                                onClick={() =>
                                  update(
                                    saveLocation(data, l, true),
                                    "Default location updated.",
                                  )
                                }
                              >
                                Make default
                              </button>
                            )}
                          <button
                            className="secondary"
                            aria-label={`${l.archived ? "Restore" : "Archive"} location ${l.name}`}
                            onClick={() => {
                              const run = () =>
                                update(
                                  archiveLocation(data, l.id, !l.archived),
                                  l.archived
                                    ? "Location restored."
                                    : "Location archived. Saved shifts preserved.",
                                );
                              if (l.archived) run();
                              else
                                setConfirmation({
                                  title: `Archive ${l.name}?`,
                                  message:
                                    "Saved shifts and custom commute times remain unchanged. You can restore this location later.",
                                  run,
                                });
                            }}
                          >
                            {l.archived ? "Restore" : "Archive"}
                          </button>
                          {!used && (
                            <button
                              className="iconbutton"
                              aria-label={`Delete location ${l.name}`}
                              onClick={() => {
                                setConfirmation({
                                  title: `Delete ${l.name}?`,
                                  message:
                                    "This removes the unused location. This action cannot be undone.",
                                  run: () =>
                                    update(
                                      deleteLocation(data, l.id),
                                      "Location deleted.",
                                    ),
                                });
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                        {used && (
                          <p className="field-note reference-note">
                            Used by shifts. Available for archive, not permanent
                            deletion.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <section className="panel linked-shifts">
            <div className="section-heading">
              <h2>
                {showHistory ? "Saved shifts & series" : "Upcoming shifts"}
              </h2>
              <button
                className="secondary"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? "Show upcoming" : "Include history"}
              </button>
            </div>
            <p className="field-note">
              Single shifts, current-week occurrences and the next occurrence
              per series. Use the filtered calendar to browse any date.
            </p>
            {visible.length === 0 ? (
              <div className="empty">
                <h3>
                  No {showHistory ? "associated" : "upcoming"} shifts yet.
                </h3>
                <p>Choose this workplace when you create your next shift.</p>
              </div>
            ) : (
              visible.map((s) => (
                <button
                  className="linked-shift"
                  key={s.id}
                  onClick={() => onEditShift(s)}
                >
                  <span>
                    <strong>{s.title}</strong>
                    <small>
                      {s.assignment?.locationName ?? "No location"} ·{" "}
                      {new Date(s.startAt).toLocaleString()}
                    </small>
                    {s.assignment?.workplaceName !== workplace.name && (
                      <small>Saved as {s.assignment?.workplaceName}</small>
                    )}
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))
            )}
          </section>
        </>
      )}
      {editor?.kind === "workplace" && (
        <WorkplaceForm
          value={editor.value}
          onClose={() => setEditor(null)}
          onSave={(value) => {
            update(
              saveWorkplace(data, value),
              "Workplace saved. Existing shifts are unchanged.",
            );
            setSelected(value.id);
            setEditor(null);
          }}
        />
      )}
      {editor?.kind === "location" && (
        <LocationForm
          owner={editor.owner}
          value={editor.value}
          onClose={() => setEditor(null)}
          onSave={(value, makeDefault) => {
            update(
              saveLocation(data, value, makeDefault),
              "Location saved. Existing shift settings are unchanged.",
            );
            setEditor(null);
          }}
        />
      )}
      {confirmation && (
        <ConfirmationPanel
          title={confirmation.title}
          message={confirmation.message}
          onConfirm={() => {
            confirmation.run();
            setConfirmation(null);
          }}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </section>
  );
}
