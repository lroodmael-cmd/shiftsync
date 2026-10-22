export const ZOOM_KEY = "shiftsync:v1:calendar-zoom";
export const MIN_HOUR_HEIGHT = 18;
export const DEFAULT_HOUR_HEIGHT = 48;
export const MAX_HOUR_HEIGHT = 80;
export const ZOOM_STEP = 4;
export const zoomPresets = [
  { name: "Compact", height: MIN_HOUR_HEIGHT },
  { name: "Normal", height: DEFAULT_HOUR_HEIGHT },
  { name: "Detailed", height: MAX_HOUR_HEIGHT },
] as const;

export function clampHourHeight(value: number) {
  return Number.isFinite(value)
    ? Math.max(MIN_HOUR_HEIGHT, Math.min(MAX_HOUR_HEIGHT, Math.round(value)))
    : DEFAULT_HOUR_HEIGHT;
}

export function decodeHourHeight(raw: string | null): number {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    return typeof value === "number" &&
      Number.isInteger(value) &&
      value >= MIN_HOUR_HEIGHT &&
      value <= MAX_HOUR_HEIGHT
      ? value
      : DEFAULT_HOUR_HEIGHT;
  } catch {
    return DEFAULT_HOUR_HEIGHT;
  }
}

// The sticky heading occupies the same space above the grid and in the viewport.
// Offset zero therefore anchors the first visible time just below that heading.
export function zoomScrollTop({
  scrollTop,
  from,
  to,
  offset = 0,
  headerHeight,
  viewportHeight,
}: {
  scrollTop: number;
  from: number;
  to: number;
  offset?: number;
  headerHeight: number;
  viewportHeight: number;
}) {
  const next = ((scrollTop + offset) / from) * to - offset;
  return Math.max(
    0,
    Math.min(next, Math.max(0, 24 * to + headerHeight - viewportHeight)),
  );
}

export function isZoomWheel(
  event: Pick<WheelEvent, "metaKey" | "ctrlKey" | "deltaY">,
  platform: string,
) {
  return (
    event.deltaY !== 0 &&
    (/Mac|iPhone|iPad/i.test(platform) ? event.metaKey : event.ctrlKey)
  );
}

export function blockDensity(height: number, hourHeight: number) {
  if (height < 14) return "tiny";
  if (hourHeight <= 24 || height < 64) return "compact";
  return hourHeight >= 64 && height >= 100 ? "detailed" : "normal";
}
