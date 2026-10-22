"use client";
import { useState } from "react";
import { ContextPanel } from "../ContextPanel";
import { workplaceIcons, type Workplace } from "@/lib/workplaces/types";
import { WorkplaceIcon } from "./WorkplaceIcon";
export function WorkplaceForm({
  value,
  onSave,
  onClose,
}: {
  value?: Workplace;
  onSave: (w: Workplace) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Workplace>(
    () =>
      value ?? {
        id: crypto.randomUUID(),
        name: "",
        color: "#5b8cff",
        icon: "briefcase",
        archived: false,
        isPrimary: false,
      },
  );
  const [error, setError] = useState("");
  return (
    <ContextPanel
      title={value ? "Edit workplace" : "Add workplace"}
      onClose={onClose}
    >
      <p className="sub">
        A name and a little color for each part of your working life.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(form);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not save workplace.",
            );
          }
        }}
      >
        <label>
          Workplace name
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="Amazon, MCO, Hospital…"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Workplace color
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
        </label>
        <fieldset className="color-field">
          <legend>Icon</legend>
          <div className="icon-options">
            {workplaceIcons.map((icon) => (
              <button
                type="button"
                key={icon}
                aria-label={`Icon ${icon}`}
                aria-pressed={form.icon === icon}
                onClick={() => setForm({ ...form, icon })}
              >
                <WorkplaceIcon name={icon} />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="check-label">
          <input
            type="checkbox"
            checked={form.isPrimary}
            disabled={form.archived}
            onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
          />
          Use as my primary workplace
        </label>
        <p className="field-note">
          New shifts can start with your primary workplace and its default
          location. Existing shifts keep their saved settings.
        </p>
        {error && (
          <p className="warning" role="alert">
            {error}
          </p>
        )}
        <div className="editor-actions">
          <button className="primary" type="submit">
            Save workplace
          </button>
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </ContextPanel>
  );
}
