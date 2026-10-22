// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import Home from "./page";
import { SHIFT_KEY } from "@/lib/storage";
import { WORKSPACE_KEY as SCHEDULE_KEY } from "@/lib/workplaces/persistence";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("confirm", () => true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => root.render(<Home />));
}
async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) =>
      b.getAttribute("aria-label") === label || b.textContent?.trim() === label,
  );
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
async function input(index: number, value: string) {
  const el = container.querySelector("dialog[open]")!.querySelectorAll("input")[
    index
  ];
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("creates, edits, persists, reloads and deletes a night shift; persists the theme", async () => {
  await mount();
  await click("New shift");
  await input(0, "Night QA");
  await input(1, "2026-10-21T22:00");
  await input(2, "2026-10-22T06:00");
  await click("Add shift");
  let saved = JSON.parse(localStorage.getItem(SCHEDULE_KEY)!).singles;
  expect(saved).toHaveLength(1);
  expect(saved[0].title).toBe("Night QA");
  await click("Edit Night QA");
  await input(0, "Updated QA");
  await click("Save changes");
  expect(JSON.parse(localStorage.getItem(SCHEDULE_KEY)!).singles[0].title).toBe(
    "Updated QA",
  );
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount();
  expect(container.textContent).toContain("Updated QA");
  await click("Toggle theme");
  expect(localStorage.getItem("shiftsync:v1:theme")).toBe("light");
  await click("Delete Updated QA");
  expect(JSON.parse(localStorage.getItem(SCHEDULE_KEY)!).singles).toEqual([]);
  expect(container.textContent).toContain("No shifts yet");
});
it("preserves corrupted storage and reports the failure", async () => {
  localStorage.setItem(SHIFT_KEY, "broken");
  await mount();
  expect(container.querySelector("[role=alert]")?.textContent).toContain(
    "could not be read",
  );
  expect(localStorage.getItem(SHIFT_KEY)).toBe("broken");
});
it("shows a storage write failure without crashing", async () => {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (key === SCHEDULE_KEY) throw Error("quota");
    return original.call(this, key, value);
  });
  await mount();
  expect(container.querySelector("[role=alert]")?.textContent).toContain(
    "only in memory",
  );
  vi.restoreAllMocks();
});

it("switches calendar views and creates from an empty hour", async () => {
  await mount();
  await click("Calendar");
  await click("3 Days");
  expect(container.querySelectorAll(".day-column")).toHaveLength(3);
  await click("Day");
  expect(container.querySelectorAll(".day-column")).toHaveLength(1);
  const slot = container.querySelector<HTMLButtonElement>(".time-slot")!;
  await act(async () => slot.click());
  expect(container.querySelector("dialog[open]")).toBeTruthy();
  expect(
    container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!
      .value,
  ).toMatch(/T00:00$/);
  await click("Close editor");
  expect(container.querySelector("dialog")).toBeNull();
  await click("Week");
  expect(container.querySelectorAll(".day-column")).toHaveLength(7);
  expect(container.querySelector(".now-line")).toBeTruthy();
});
it("shows navigation placeholders without changing saved shifts", async () => {
  await mount();
  await click("Analytics");
  expect(container.textContent).toContain("A clearer picture of your time.");
  await click("Settings");
  expect(container.textContent).toContain("A workspace that feels like you.");
  expect(JSON.parse(localStorage.getItem(SCHEDULE_KEY)!).singles).toEqual([]);
});
it("supports cancel, validation and overlap warnings in the contextual editor", async () => {
  await mount();
  await click("New shift");
  await input(0, "One");
  await input(1, "2026-10-21T22:00");
  await input(2, "2026-10-22T06:00");
  await click("Add shift");
  await click("New shift");
  await input(1, "2026-10-22T05:00");
  await input(2, "2026-10-22T07:00");
  expect(container.textContent).toContain("Overlaps One");
  await click("Color green");
  expect(
    container
      .querySelector('[aria-label="Color green"]')
      ?.getAttribute("aria-pressed"),
  ).toBe("true");
  await input(2, "2026-10-22T04:00");
  await click("Add shift");
  expect(container.querySelector("[role=alert]")?.textContent).toContain(
    "End must be after start",
  );
  await click("Cancel");
  expect(JSON.parse(localStorage.getItem(SCHEDULE_KEY)!).singles).toHaveLength(
    1,
  );
});

async function select(label: string, value: string) {
  const el = Array.from(container.querySelectorAll("label"))
    .find((e) => e.textContent?.startsWith(label))
    ?.querySelector("select");
  expect(el).toBeTruthy();
  await act(async () => {
    el!.value = value;
    el!.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
it("creates one weekly rule with commutes, edits one exception, and deletes only following shifts", async () => {
  await mount();
  await click("New shift");
  await input(0, "Recurring QA");
  await input(1, "2026-10-21T22:00");
  await input(2, "2026-10-22T06:00");
  await select("Repeat pattern", "weekly");
  const minuteInputs =
    container.querySelectorAll<HTMLInputElement>("input[type=number]");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(minuteInputs[0], "30");
    minuteInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Add shift");
  let saved = JSON.parse(localStorage.getItem(SCHEDULE_KEY)!);
  expect(saved.series).toHaveLength(1);
  expect(saved.singles).toHaveLength(0);
  expect(saved.series[0].commute.beforeMinutes).toBe(30);
  await click("Edit Recurring QA");
  await input(0, "Custom QA");
  await click("Save changes");
  saved = JSON.parse(localStorage.getItem(SCHEDULE_KEY)!);
  expect(saved.exceptions).toHaveLength(1);
  expect(saved.series[0].title).toBe("Recurring QA");
  expect(saved.exceptions[0].override.title).toBe("Custom QA");
  const boundary = saved.exceptions[0].date;
  await click("Delete Custom QA");
  await select("Apply changes to", "following");
  await click("Confirm deletion");
  saved = JSON.parse(localStorage.getItem(SCHEDULE_KEY)!);
  expect(saved.exceptions).toHaveLength(0);
  expect(
    saved.series.length === 0 || saved.series[0].rule.until < boundary,
  ).toBe(true);
});
it("keeps corrupted v2 data intact and offers export", async () => {
  localStorage.setItem(SCHEDULE_KEY, "corrupt v2");
  await mount();
  expect(container.querySelector("[role=alert]")?.textContent).toContain(
    "preserved",
  );
  expect(localStorage.getItem(SCHEDULE_KEY)).toBe("corrupt v2");
  expect(container.textContent).toContain("Export JSON backup");
});
