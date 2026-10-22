import { expect, it } from "vitest";
import {
  blockDensity,
  clampHourHeight,
  decodeHourHeight,
  isZoomWheel,
  zoomScrollTop,
} from "./calendarZoom";
import { daySegments } from "./calendar";
it.each([18, 48, 59, 80])("restores valid persisted hour height %s", (value) =>
  expect(decodeHourHeight(String(value))).toBe(value),
);
it.each([null, "broken", "null", "0", "81", "47.5", '"48"', "{}", "1e999"])(
  "rejects invalid persisted zoom %s",
  (raw) => expect(decodeHourHeight(raw)).toBe(48),
);
it("clamps control input and keeps a finite whole-pixel time scale", () => {
  expect(clampHourHeight(0)).toBe(18);
  expect(clampHourHeight(100)).toBe(80);
  expect(clampHourHeight(52.7)).toBe(53);
  expect(clampHourHeight(NaN)).toBe(48);
});
it("preserves the top visible hour when sufficient scrolling space exists", () => {
  const old = {
    scrollTop: 480,
    from: 48,
    to: 80,
    headerHeight: 64,
    viewportHeight: 590,
  };
  expect(zoomScrollTop(old) / 80).toBe(10);
  expect(zoomScrollTop({ ...old, scrollTop: 800, from: 80, to: 48 })).toBe(480);
});
it("anchors wheel zoom at the pointer and clamps impossible positions to the day edges", () => {
  const dimensions = { headerHeight: 64, viewportHeight: 590 };
  const next = zoomScrollTop({
    ...dimensions,
    scrollTop: 480,
    from: 48,
    to: 80,
    offset: 200,
  });
  expect((next + 200) / 80).toBeCloseTo(680 / 48);
  expect(
    zoomScrollTop({ ...dimensions, scrollTop: 1000, from: 80, to: 18 }),
  ).toBe(0);
  expect(
    zoomScrollTop({ ...dimensions, scrollTop: 2000, from: 48, to: 80 }),
  ).toBe(1394);
});
it("uses Command on Mac and Control on other desktops, ignoring ordinary wheel input", () => {
  expect(
    isZoomWheel({ metaKey: true, ctrlKey: false, deltaY: -20 }, "MacIntel"),
  ).toBe(true);
  expect(
    isZoomWheel({ metaKey: false, ctrlKey: true, deltaY: 20 }, "Win32"),
  ).toBe(true);
  expect(
    isZoomWheel({ metaKey: false, ctrlKey: true, deltaY: 20 }, "MacIntel"),
  ).toBe(false);
  expect(
    isZoomWheel({ metaKey: false, ctrlKey: false, deltaY: 20 }, "Linux"),
  ).toBe(false);
  expect(
    isZoomWheel({ metaKey: true, ctrlKey: true, deltaY: 0 }, "MacIntel"),
  ).toBe(false);
});
it("simplifies short and compact blocks while exposing extra detail where it fits", () => {
  expect(blockDensity(9, 18)).toBe("tiny");
  expect(blockDensity(36, 18)).toBe("compact");
  expect(blockDensity(120, 48)).toBe("normal");
  expect(blockDensity(160, 80)).toBe("detailed");
  expect(blockDensity(20, 80)).toBe("compact");
});
it("keeps a five-minute block at its actual duration rather than a fixed minimum", () => {
  const day = new Date(2026, 9, 21);
  const event = {
    id: "short",
    title: "Short",
    color: "#5b8cff",
    startAt: new Date(2026, 9, 21, 10).toISOString(),
    endAt: new Date(2026, 9, 21, 10, 5).toISOString(),
  };
  const segment = daySegments([event], day)[0];
  expect(segment.top).toBeCloseTo((10 / 24) * 100);
  expect(segment.height).toBeCloseTo((5 / 1440) * 100);
  for (const zoom of [18, 48, 80])
    expect((segment.height / 100) * 24 * zoom).toBeCloseTo((5 / 60) * zoom);
});
