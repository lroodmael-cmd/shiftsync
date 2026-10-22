// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WeeklyCalendar } from "./WeeklyCalendar";
import { emptyWorkspace } from "@/lib/workplaces/types";
import { ZOOM_KEY } from "@/lib/calendarZoom";
import { saveShift } from "@/lib/schedule/mutations";
import { browserZone } from "@/lib/schedule/time";
let root: Root, container: HTMLDivElement;
const originalScrollTo = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollTo",
);
const now = new Date(2026, 9, 21, 12, 30),
  onEdit = vi.fn(),
  onCreate = vi.fn();
const night = {
  id: "night",
  title: "Night",
  color: "#8b5cf6",
  startAt: new Date(2026, 9, 21, 22).toISOString(),
  endAt: new Date(2026, 9, 22, 6).toISOString(),
  commute: { beforeMinutes: 30, afterMinutes: 45 },
};
const repeat = {
  frequency: "weekly" as const,
  timeZone: browserZone(),
  weekdays: [3],
  startLocal: "2026-10-21T22:00",
  endLocal: "2026-10-22T06:00",
};
const data = saveShift(emptyWorkspace(), night, repeat);
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function (
      this: HTMLElement,
      options: ScrollToOptions | number,
    ) {
      if (typeof options === "object")
        this.scrollTop = options.top ?? this.scrollTop;
    }),
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  if (originalScrollTo)
    Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  vi.unstubAllGlobals();
});
async function mount(time = now) {
  await act(async () =>
    root.render(
      <WeeklyCalendar
        schedule={data}
        onEdit={onEdit}
        onCreate={onCreate}
        now={time}
        workplaceFilter="all"
        onWorkplaceFilterChange={() => {}}
      />,
    ),
  );
}
async function click(name: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => b.getAttribute("aria-label") === name || b.textContent === name,
  );
  expect(button, `button ${name}`).toBeTruthy();
  await act(async () => button!.click());
}
const scale = () =>
  Number(
    container.querySelector(".calendar")!.getAttribute("data-hour-height"),
  );
function dimensions() {
  const scroll = container.querySelector<HTMLElement>(".calendar-scroll")!;
  Object.defineProperty(scroll, "clientHeight", {
    configurable: true,
    value: 590,
  });
  Object.defineProperty(scroll.querySelector(".day-heading"), "offsetHeight", {
    configurable: true,
    value: 64,
  });
  return scroll;
}
async function slider(value: string) {
  const input = container.querySelector<HTMLInputElement>("input[type=range]")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("defaults to 48, supports all presets, slider and reset without writing schedule data", async () => {
  localStorage.setItem("shiftsync:v3:schedule", "preserved raw schedule");
  await mount();
  expect(scale()).toBe(48);
  await click("Compact");
  expect(scale()).toBe(18);
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="Zoom Out"]')!
      .disabled,
  ).toBe(true);
  await click("Detailed");
  expect(scale()).toBe(80);
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="Zoom In"]')!
      .disabled,
  ).toBe(true);
  await slider("61");
  expect(scale()).toBe(61);
  await click("Reset");
  expect(scale()).toBe(48);
  expect(localStorage.getItem("shiftsync:v3:schedule")).toBe(
    "preserved raw schedule",
  );
});
it("restores valid zoom across remounts and rejects an invalid value", async () => {
  localStorage.setItem(ZOOM_KEY, "broken");
  await mount();
  expect(scale()).toBe(48);
  expect(localStorage.getItem(ZOOM_KEY)).toBe("broken");
  await click("Detailed");
  expect(localStorage.getItem(ZOOM_KEY)).toBe("80");
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount();
  expect(scale()).toBe(80);
  expect(
    container.querySelector<HTMLElement>(".calendar-scroll")!.scrollTop,
  ).toBe(10 * 80);
});
it("updates numeric readouts when browser translation wraps their text", async () => {
  await mount();
  const output = container.querySelector("output")!;
  const translated = document.createElement("span");
  translated.textContent = "48 px/h";
  output.replaceChildren(translated);
  const summary = container.querySelector(".small-events summary")!;
  const translatedCount = document.createElement("span");
  translatedCount.textContent = summary.textContent;
  summary.replaceChildren(translatedCount);
  await click("Compact");
  expect(output.textContent).toBe("18 px/h");
  expect(
    container.querySelector(".small-events summary")?.textContent,
  ).toContain("(3)");
  await click("Detailed");
  expect(summary.textContent).toContain("(1)");
});
it("switches views and updates the clock after browser translation wraps dynamic text", async () => {
  await mount();
  const range = container.querySelector(".calendar-toolbar .sub")!;
  const translated = document.createElement("span");
  translated.textContent = range.textContent;
  range.replaceChildren(translated);
  const clock = container.querySelector(".now-time")!;
  const translatedClock = document.createElement("span");
  translatedClock.textContent = clock.textContent;
  clock.replaceChildren(translatedClock);
  await click("Day");
  expect(container.querySelectorAll(".day-column")).toHaveLength(1);
  expect(range.textContent).not.toContain("–");
  await mount(new Date(+now + 60000));
  expect(container.querySelector(".now-time")!.textContent).toBe(
    new Date(+now + 60000).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
});
it("keeps the zoom across Day, 3 Days and Week, with all 24 creation slots per day", async () => {
  await mount();
  await click("Compact");
  for (const [view, count] of [
    ["Day", 1],
    ["3 Days", 3],
    ["Week", 7],
  ] as const) {
    await click(view);
    expect(scale()).toBe(18);
    expect(container.querySelectorAll(".day-column")).toHaveLength(count);
    expect(container.querySelectorAll(".time-slot")).toHaveLength(count * 24);
  }
  await click("Zoom In");
  expect(scale()).toBe(22);
  await click("Zoom Out");
  expect(scale()).toBe(18);
});
it("keeps overnight work, travel, colors, recurrence icons and now-line coordinates proportional", async () => {
  await mount();
  const geometry = () =>
    Array.from(container.querySelectorAll<HTMLElement>(".calendar-event")).map(
      (e) => [e.style.top, e.style.height, e.style.borderLeftColor],
    );
  const initial = geometry();
  expect(initial).toHaveLength(4);
  const line = container.querySelector<HTMLElement>(".now-line")!.style.top;
  for (const preset of ["Compact", "Normal", "Detailed"]) {
    await click(preset);
    expect(geometry()).toEqual(initial);
    expect(container.querySelector<HTMLElement>(".now-line")!.style.top).toBe(
      line,
    );
    expect(
      container.querySelectorAll(
        ".calendar-event:not(.commute-event) .event-heading svg",
      ),
    ).toHaveLength(2);
  }
  expect(container.querySelector(".event-detailed .event-extra")).toBeTruthy();
});
it("preserves the first visible time and horizontal offset, without re-scrolling on timer updates", async () => {
  await mount();
  const el = dimensions();
  el.scrollTop = 480;
  el.scrollLeft = 145;
  await click("Detailed");
  expect(el.scrollTop).toBe(800);
  expect(el.scrollLeft).toBe(145);
  await mount(new Date(+now + 60000));
  expect(el.scrollTop).toBe(800);
  await click("Normal");
  expect(el.scrollTop).toBe(480);
  await click("Compact");
  expect(el.scrollTop).toBe(0);
  expect(el.scrollLeft).toBe(145);
});
it.each(["MacIntel", "Win32"])(
  "intercepts modified wheel only within the calendar on %s",
  async (platform) => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
    await mount();
    const el = dimensions();
    el.scrollTop = 480;
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      top: 100,
    } as DOMRect);
    const target = container.querySelector(".day-column")!;
    const modifiers =
      platform === "MacIntel" ? { metaKey: true } : { ctrlKey: true };
    const wheel = new WheelEvent("wheel", {
      ...modifiers,
      deltaY: -40,
      clientY: 364,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => target.dispatchEvent(wheel));
    expect(wheel.defaultPrevented).toBe(true);
    expect(scale()).toBe(52);
    expect(el.scrollTop).toBeCloseTo(((480 + 200) / 48) * 52 - 200);
    const outside = new WheelEvent("wheel", {
      ...modifiers,
      deltaY: -40,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
    expect(scale()).toBe(52);
    const normal = new WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(normal);
    expect(normal.defaultPrevented).toBe(false);
    expect(scale()).toBe(52);
  },
);
it("keeps tiny blocks selectable via a separate list and preserves grid creation and editing", async () => {
  await mount();
  await click("Compact");
  expect(
    container.querySelector(".commute-event")?.getAttribute("data-density"),
  ).toBe("tiny");
  const small = container.querySelector<HTMLButtonElement>(".small-event")!;
  await act(async () => small.click());
  expect(onEdit).toHaveBeenCalledWith(
    expect.objectContaining({ id: "night@2026-10-21" }),
  );
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(".calendar-event:not(.commute-event)")!
      .click(),
  );
  expect(onEdit).toHaveBeenCalledTimes(2);
  await act(async () =>
    container
      .querySelectorAll<HTMLButtonElement>(".day-column")[2]
      .querySelectorAll<HTMLButtonElement>(".time-slot")[23]
      .click(),
  );
  expect(onCreate).toHaveBeenCalledWith(new Date(2026, 9, 21, 23));
});
it("retains the mobile Day default and horizontal Week grid at every zoom level", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  await mount();
  expect(container.querySelectorAll(".day-column")).toHaveLength(1);
  await click("Week");
  for (const preset of ["Compact", "Normal", "Detailed"]) {
    await click(preset);
    expect(
      container.querySelector<HTMLElement>(".week-grid")!.style.minWidth,
    ).toBe("760px");
    expect(container.querySelectorAll(".day-column")).toHaveLength(7);
  }
});
it("continues zooming in memory if preference storage fails, without affecting the schedule", async () => {
  await mount();
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (key === ZOOM_KEY) throw Error("quota");
    original.call(this, key, value);
  });
  await click("Detailed");
  expect(scale()).toBe(80);
  expect(container.querySelector("[role=status]")?.textContent).toContain(
    "session only",
  );
});
