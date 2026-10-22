"use client";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  DEFAULT_HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  ZOOM_STEP,
  zoomPresets,
} from "@/lib/calendarZoom";
export function CalendarZoomControls({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="calendar-zoom" role="group" aria-label="Calendar zoom">
      <div className="zoom-range">
        <button
          className="iconbutton"
          type="button"
          aria-label="Zoom Out"
          title="Zoom Out"
          disabled={value === MIN_HOUR_HEIGHT}
          onClick={() => onChange(value - ZOOM_STEP)}
        >
          <Minus size={16} />
        </button>
        <label className="zoom-slider">
          Hour height
          <input
            aria-label="Hour height"
            type="range"
            min={MIN_HOUR_HEIGHT}
            max={MAX_HOUR_HEIGHT}
            step="1"
            value={value}
            aria-valuetext={`${value} pixels per hour`}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </label>
        <button
          className="iconbutton"
          type="button"
          aria-label="Zoom In"
          title="Zoom In"
          disabled={value === MAX_HOUR_HEIGHT}
          onClick={() => onChange(value + ZOOM_STEP)}
        >
          <Plus size={16} />
        </button>
        <output className="zoom-value" aria-live="off">
          {`${value} px/h`}
        </output>
        <button
          className="secondary zoom-reset"
          type="button"
          onClick={() => onChange(DEFAULT_HOUR_HEIGHT)}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>
      <div className="zoom-presets" role="group" aria-label="Zoom presets">
        {zoomPresets.map((p) => (
          <button
            key={p.name}
            type="button"
            aria-pressed={value === p.height}
            onClick={() => onChange(p.height)}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
