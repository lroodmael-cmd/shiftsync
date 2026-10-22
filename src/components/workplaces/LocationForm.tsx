"use client";
import { useState } from "react";
import { ContextPanel } from "../ContextPanel";
import type { WorkLocation, Workplace } from "@/lib/workplaces/types";
import { browserZone } from "@/lib/schedule/time";
export function LocationForm({
  value,
  owner,
  onSave,
  onClose,
}: {
  value?: WorkLocation;
  owner: Workplace;
  onSave: (l: WorkLocation, makeDefault: boolean) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<WorkLocation>(
    () =>
      value ?? {
        id: crypto.randomUUID(),
        workplaceId: owner.id,
        name: "",
        address: "",
        timeZone: browserZone(),
        commute: { beforeMinutes: 0, afterMinutes: 0 },
        archived: false,
      },
  );
  const [inherit, setInherit] = useState(!value?.color);
  const [makeDefault, setMakeDefault] = useState(
    value ? owner.defaultLocationId === value.id : !owner.defaultLocationId,
  );
  const [error, setError] = useState("");
  return (
    <ContextPanel
      title={value ? "Edit location" : "Add location"}
      onClose={onClose}
    >
      <p className="sub">
        {owner.name} · Manually planned travel. No maps or tracking.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(
              {
                ...form,
                color: inherit ? undefined : (form.color ?? owner.color),
              },
              makeDefault,
            );
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not save location.",
            );
          }
        }}
      >
        <label>
          Location name
          <input
            autoFocus
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Address (optional)
          <input
            maxLength={500}
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>
        <label>
          Location time zone (IANA)
          <input
            required
            value={form.timeZone}
            placeholder="America/New_York"
            onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
          />
        </label>
        <div className="commute-fields">
          <label>
            Usual outbound (minutes)
            <input
              required
              type="number"
              min="0"
              max="720"
              step="1"
              value={form.commute.beforeMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  commute: {
                    ...form.commute,
                    beforeMinutes: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Usual return (minutes)
            <input
              required
              type="number"
              min="0"
              max="720"
              step="1"
              value={form.commute.afterMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  commute: {
                    ...form.commute,
                    afterMinutes: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={inherit}
            onChange={(e) => setInherit(e.target.checked)}
          />
          Inherit workplace color
        </label>
        {!inherit && (
          <label>
            Location color
            <input
              type="color"
              value={form.color ?? owner.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </label>
        )}
        <label className="check-label">
          <input
            type="checkbox"
            checked={makeDefault}
            disabled={form.archived || owner.defaultLocationId === form.id}
            onChange={(e) => setMakeDefault(e.target.checked)}
          />
          Default location for this workplace
        </label>
        <p className="field-note">
          Changes apply to future selections. Saved shift colors, labels and
          custom travel times stay unchanged.
        </p>
        {error && (
          <p className="warning" role="alert">
            {error}
          </p>
        )}
        <div className="editor-actions">
          <button className="primary" type="submit">
            Save location
          </button>
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </ContextPanel>
  );
}
