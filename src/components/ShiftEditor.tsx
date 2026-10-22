"use client";
import { useEffect, useRef, useState } from "react";
import { X, Trash2, Check, CalendarDays, Repeat2, Car } from "lucide-react";
import { validateShift } from "@/lib/shifts";
import type {
  Frequency,
  Occurrence,
  RepeatSettings,
  Scope,
  WorkShift,
} from "@/lib/schedule/types";
import {
  browserZone,
  instant,
  validZone,
  zonedLocal,
  localWeekday,
} from "@/lib/schedule/time";
import { conflictsForOccurrence } from "@/lib/schedule/conflicts";
import { seriesFromDraft } from "@/lib/schedule/recurrence";
import type {
  WorkspaceSchedule,
  ShiftAssociation,
} from "@/lib/workplaces/types";
import { associationOf } from "@/lib/workplaces/types";
import { selectionDefaults } from "@/lib/workplaces/operations";
import { ConfirmationPanel } from "./ConfirmationPanel";
const colors = ["#5b8cff", "#8b5cf6", "#10b981", "#e08b32", "#e35a84"];
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function ShiftEditor({
  shift,
  start,
  schedule,
  deleting = false,
  onSave,
  onDelete,
  onClose,
}: {
  shift?: Occurrence;
  start: Date;
  schedule: WorkspaceSchedule;
  deleting?: boolean;
  onSave: (s: WorkShift, repeat: RepeatSettings, scope: Scope) => void;
  onDelete: (s: Occurrence, scope: Scope) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [initialDefaults] = useState(() => {
    if (shift) return undefined;
    const primary = schedule.workplaces.find((w) => w.isPrimary && !w.archived);
    return primary ? selectionDefaults(schedule, primary.id) : undefined;
  });
  const [association, setAssociation] = useState<ShiftAssociation>(() =>
    shift
      ? associationOf(shift)
      : initialDefaults
        ? associationOf(initialDefaults)
        : {},
  );
  const inputZone =
    shift?.timeZone ??
    shift?.rule?.timeZone ??
    shift?.assignment?.timeZone ??
    initialDefaults?.timeZone ??
    browserZone();
  const [scope, setScope] = useState<Scope>(shift?.seriesOnly ? "all" : "only");
  const [repeat, setRepeat] = useState<RepeatSettings>(() => ({
    frequency: shift?.rule?.frequency ?? "none",
    timeZone: inputZone,
    weekdays: shift?.rule?.weekdays ?? [
      localWeekday(
        zonedLocal(shift?.startAt ?? start.toISOString(), inputZone),
      ),
    ],
    until: shift?.rule?.until,
  }));
  const [form, setForm] = useState(() => ({
    title: shift?.title ?? "Work shift",
    start: zonedLocal(shift?.startAt ?? start.toISOString(), inputZone),
    end: zonedLocal(
      shift?.endAt ?? new Date(+start + 8 * 3600000).toISOString(),
      inputZone,
    ),
    color: shift?.color ?? initialDefaults?.color ?? colors[0],
    before:
      shift?.commute?.beforeMinutes ??
      initialDefaults?.commute?.beforeMinutes ??
      0,
    after:
      shift?.commute?.afterMinutes ??
      initialDefaults?.commute?.afterMinutes ??
      0,
  }));
  const [error, setError] = useState("");
  const [pendingDefaults, setPendingDefaults] = useState<ReturnType<
    typeof selectionDefaults
  > | null>(null);
  const onlyOccurrence = !!shift?.seriesId && scope === "only";
  function applyDefaults(
    value: ReturnType<typeof selectionDefaults>,
    keepCustom = false,
  ) {
    setAssociation({
      ...associationOf(value),
      commuteSource: keepCustom ? "custom" : value.commuteSource,
    });
    setForm({
      ...form,
      color: value.color,
      before: keepCustom
        ? form.before
        : (value.commute?.beforeMinutes ?? form.before),
      after: keepCustom
        ? form.after
        : (value.commute?.afterMinutes ?? form.after),
    });
    setRepeat({ ...repeat, timeZone: value.timeZone ?? repeat.timeZone });
    setPendingDefaults(null);
  }
  function requestDefaults(value: ReturnType<typeof selectionDefaults>) {
    if (association.commuteSource === "custom" && value.commute)
      setPendingDefaults(value);
    else applyDefaults(value);
  }
  function chooseWorkplace(id: string) {
    if (!id) {
      setAssociation({ commuteSource: "custom" });
      return;
    }
    try {
      requestDefaults(selectionDefaults(schedule, id));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot select workplace.");
    }
  }
  function chooseLocation(id: string) {
    try {
      requestDefaults(
        selectionDefaults(schedule, association.workplaceId!, id),
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot select location.");
    }
  }
  const locations = schedule.locations.filter(
    (l) =>
      l.workplaceId === association.workplaceId &&
      (!l.archived || l.id === association.locationId),
  );
  function draft(): WorkShift {
    return {
      ...associationOf(association),
      timeZone: repeat.timeZone,
      id: shift?.id ?? "draft",
      title: form.title.trim(),
      startAt: instant(form.start, repeat.timeZone),
      endAt: instant(form.end, repeat.timeZone),
      color: form.color,
      commute: {
        beforeMinutes: Number(form.before),
        afterMinutes: Number(form.after),
      },
    };
  }
  let overlapping: string[] = [];
  try {
    overlapping = [
      ...new Set(conflictsForOccurrence(schedule, draft()).map((e) => e.title)),
    ];
  } catch {}
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = dialog.current;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (deleting && shift) {
      onDelete(shift, scope);
      return;
    }
    try {
      if (!validZone(repeat.timeZone))
        throw Error("Enter a valid IANA time zone, such as America/New_York.");
      const value = draft();
      const problem = validateShift(value);
      if (problem) throw Error(problem);
      if (
        [form.before, form.after].some(
          (v) => !Number.isInteger(Number(v)) || v < 0 || v > 720,
        )
      )
        throw Error("Commute durations must be whole minutes from 0 to 720.");
      const options = { ...repeat, startLocal: form.start, endLocal: form.end };
      if (repeat.frequency !== "none" && !onlyOccurrence)
        seriesFromDraft(
          value,
          {
            ...options,
            until:
              shift?.seriesId && scope === "all" ? undefined : options.until,
          },
          value.id,
        );
      onSave(
        { ...value, id: shift?.id ?? crypto.randomUUID() },
        options,
        scope,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The shift could not be saved.",
      );
    }
  }
  return (
    <>
      <dialog
        ref={dialog}
        className="shift-dialog"
        aria-labelledby="editor-title"
        onCancel={onClose}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="editor-inner">
          <div className="editor-heading">
            <span className="eyebrow">MAKE TIME FOR WHAT MATTERS</span>
            <button
              className="iconbutton"
              aria-label="Close editor"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
          <span className="editor-symbol">
            <CalendarDays />
          </span>
          <h2 id="editor-title">
            {deleting
              ? "Delete recurring shift"
              : shift
                ? "Edit shift"
                : "New shift"}
          </h2>
          <p className="sub">
            {deleting
              ? "Choose which occurrences to remove."
              : "Your next shift, with every detail in place."}
          </p>
          <form onSubmit={save}>
            {shift?.seriesId && (
              <label>
                Apply changes to
                <select
                  aria-label="Apply changes to"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as Scope)}
                >
                  <option value="only" disabled={shift?.seriesOnly}>
                    This shift only
                  </option>
                  <option value="following" disabled={shift?.seriesOnly}>
                    This and following shifts
                  </option>
                  <option value="all">All shifts in the series</option>
                </select>
                <small className="field-note">
                  Following changes keep earlier occurrences and their
                  exceptions intact. All shifts includes history.
                </small>
              </label>
            )}
            {!deleting && (
              <>
                <label>
                  Shift name
                  <input
                    autoFocus
                    required
                    maxLength={120}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </label>
                <section className="editor-section assignment-fields">
                  <h3>Workplace & location</h3>
                  <label>
                    Workplace
                    <select
                      aria-label="Workplace"
                      value={association.workplaceId ?? ""}
                      onChange={(e) => chooseWorkplace(e.target.value)}
                    >
                      <option value="">No workplace</option>
                      {schedule.workplaces
                        .filter(
                          (w) =>
                            !w.archived || w.id === association.workplaceId,
                        )
                        .map((w) => (
                          <option key={w.id} value={w.id} disabled={w.archived}>
                            {w.name}
                            {w.archived ? " (archived)" : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  {association.workplaceId && (
                    <label>
                      Work location
                      <select
                        aria-label="Work location"
                        value={association.locationId ?? ""}
                        onChange={(e) => chooseLocation(e.target.value)}
                      >
                        <option value="">No location</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id} disabled={l.archived}>
                            {l.name}
                            {l.archived ? " (archived)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {association.assignment && (
                    <p className="field-note">
                      Saved with: {association.assignment.workplaceName}
                      {association.assignment.locationName
                        ? ` / ${association.assignment.locationName}`
                        : ""}
                      {association.assignment.address
                        ? ` · ${association.assignment.address}`
                        : ""}
                      . Saved labels and travel times stay independent of later
                      location changes.
                    </p>
                  )}
                </section>
                <div className="date-fields">
                  <label>
                    Starts
                    <input
                      required
                      type="datetime-local"
                      value={form.start}
                      onChange={(e) =>
                        setForm({ ...form, start: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Ends
                    <input
                      required
                      type="datetime-local"
                      value={form.end}
                      onChange={(e) =>
                        setForm({ ...form, end: e.target.value })
                      }
                    />
                  </label>
                </div>
                <p className="field-note">
                  Times use {repeat.timeZone}. For overnight work, choose the
                  following end date.
                </p>
                <section className="editor-section">
                  <h3>
                    <Repeat2 size={16} />
                    Repeat
                  </h3>
                  <label>
                    Repeat pattern
                    <select
                      aria-label="Repeat pattern"
                      disabled={onlyOccurrence}
                      value={repeat.frequency}
                      onChange={(e) =>
                        setRepeat({
                          ...repeat,
                          frequency: e.target.value as Frequency,
                          weekdays:
                            e.target.value === "weekly" &&
                            repeat.frequency !== "weekly"
                              ? [localWeekday(form.start)]
                              : repeat.weekdays,
                        })
                      }
                    >
                      <option value="none">Does not repeat</option>
                      <option value="daily">Every day</option>
                      <option value="weekly">
                        Every week on selected weekdays
                      </option>
                    </select>
                  </label>
                  {onlyOccurrence ? (
                    <p className="field-note">
                      The series rule stays unchanged for this shift only.
                    </p>
                  ) : (
                    repeat.frequency !== "none" && (
                      <>
                        <label>
                          Time zone (IANA)
                          <input
                            required
                            value={repeat.timeZone}
                            onChange={(e) =>
                              setRepeat({ ...repeat, timeZone: e.target.value })
                            }
                          />
                        </label>
                        {repeat.frequency === "weekly" && (
                          <fieldset className="color-field">
                            <legend>Weekdays</legend>
                            <div className="weekday-options">
                              {weekdays.map((day, i) => (
                                <button
                                  key={day}
                                  type="button"
                                  aria-pressed={repeat.weekdays.includes(i + 1)}
                                  onClick={() =>
                                    setRepeat({
                                      ...repeat,
                                      weekdays: repeat.weekdays.includes(i + 1)
                                        ? repeat.weekdays.filter(
                                            (d) => d !== i + 1,
                                          )
                                        : [...repeat.weekdays, i + 1],
                                    })
                                  }
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}
                        <label>
                          Repeat until
                          <input
                            type="date"
                            value={repeat.until ?? ""}
                            onChange={(e) =>
                              setRepeat({
                                ...repeat,
                                until: e.target.value || undefined,
                              })
                            }
                          />
                        </label>
                        <p className="field-note">
                          Leave empty for no end date. The end date is inclusive
                          in the rule’s time zone. DST: skipped times move
                          forward; repeated times use the earlier offset.
                        </p>
                        {shift?.seriesId && scope === "all" && (
                          <p className="field-note">
                            Series-wide edits use the original start date and
                            the hours above. Use “This shift only” to move a
                            single date.
                          </p>
                        )}
                      </>
                    )
                  )}
                </section>
                <section className="editor-section">
                  <h3>
                    <Car size={16} />
                    Commute planning
                  </h3>
                  <div className="commute-fields">
                    <label>
                      Before shift (minutes)
                      <input
                        type="number"
                        min="0"
                        max="720"
                        step="1"
                        value={form.before}
                        onChange={(e) => {
                          setAssociation({
                            ...association,
                            commuteSource: "custom",
                          });
                          setForm({ ...form, before: Number(e.target.value) });
                        }}
                      />
                    </label>
                    <label>
                      After shift (minutes)
                      <input
                        type="number"
                        min="0"
                        max="720"
                        step="1"
                        value={form.after}
                        onChange={(e) => {
                          setAssociation({
                            ...association,
                            commuteSource: "custom",
                          });
                          setForm({ ...form, after: Number(e.target.value) });
                        }}
                      />
                    </label>
                  </div>
                  <p className="field-note">
                    Unpaid travel, linked to this shift. Included in overlap
                    warnings.{" "}
                    {association.commuteSource === "location"
                      ? "Copied location defaults; saved independently."
                      : "Custom travel times."}
                  </p>
                </section>
                <fieldset className="color-field">
                  <legend>Shift color</legend>
                  <div className="swatches">
                    {colors.map((color, i) => (
                      <button
                        type="button"
                        key={color}
                        aria-label={`Color ${["blue", "violet", "green", "amber", "pink"][i]}`}
                        aria-pressed={form.color === color}
                        style={{ background: color }}
                        onClick={() => setForm({ ...form, color })}
                      >
                        {form.color === color && <Check size={17} />}
                      </button>
                    ))}
                    <label className="custom-color">
                      Custom
                      <input
                        aria-label="Custom color"
                        type="color"
                        value={form.color}
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                {overlapping.length > 0 && (
                  <p className="warning" role="status">
                    Overlaps {overlapping.join(", ")}. You can still save this
                    shift. Repeating rules: this warning checks the selected
                    occurrence.
                  </p>
                )}
              </>
            )}
            {error && (
              <p className="warning" role="alert">
                {error}
              </p>
            )}
            <div className="editor-actions">
              <button className="primary" type="submit">
                {deleting ? <Trash2 size={17} /> : <Check size={17} />}{" "}
                {deleting
                  ? "Confirm deletion"
                  : shift
                    ? "Save changes"
                    : "Add shift"}
              </button>
              <button className="secondary" type="button" onClick={onClose}>
                {shift ? "Cancel editing" : "Cancel"}
              </button>
              {shift && !deleting && (
                <button
                  className="danger"
                  type="button"
                  onClick={() => onDelete(shift, scope)}
                >
                  <Trash2 size={16} />
                  Delete shift
                </button>
              )}
            </div>
          </form>
        </div>
      </dialog>
      {pendingDefaults && (
        <ConfirmationPanel
          title="Choose commute settings"
          message={`Use ${pendingDefaults.assignment.locationName}'s defaults (${pendingDefaults.commute?.beforeMinutes} min there, ${pendingDefaults.commute?.afterMinutes} min back), or keep your custom travel times?`}
          confirmLabel="Use location defaults"
          cancelLabel="Keep custom times"
          onConfirm={() => applyDefaults(pendingDefaults)}
          onCancel={() => applyDefaults(pendingDefaults, true)}
          onClose={() => setPendingDefaults(null)}
        />
      )}
    </>
  );
}
