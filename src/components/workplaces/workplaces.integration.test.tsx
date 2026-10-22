// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import Home from "@/app/page";
import { emptyWorkspace, associationOf } from "@/lib/workplaces/types";
import {
  saveWorkplace,
  saveLocation,
  selectionDefaults,
} from "@/lib/workplaces/operations";
import { WORKSPACE_KEY } from "@/lib/workplaces/persistence";
let root: Root, container: HTMLDivElement;
function fixture() {
  let data = saveWorkplace(emptyWorkspace(), {
    id: "a",
    name: "Amazon",
    icon: "warehouse",
    color: "#5b8cff",
    isPrimary: true,
    archived: false,
  });
  data = saveLocation(data, {
    id: "north",
    workplaceId: "a",
    name: "North",
    timeZone: "America/New_York",
    commute: { beforeMinutes: 20, afterMinutes: 25 },
    archived: false,
  });
  return saveLocation(data, {
    id: "south",
    workplaceId: "a",
    name: "South",
    timeZone: "America/New_York",
    commute: { beforeMinutes: 40, afterMinutes: 45 },
    color: "#8b5cf6",
    archived: false,
  });
}
beforeEach(() => {
  localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
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
async function click(name: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) =>
      b.getAttribute("aria-label") === name || b.textContent?.trim() === name,
  );
  expect(button, `button ${name}`).toBeTruthy();
  await act(async () => button!.click());
}
function control(label: string) {
  const scope = container.querySelector("dialog[open]") ?? container;
  const owner = Array.from(scope.querySelectorAll("label")).find((l) =>
    l.textContent?.trim().startsWith(label),
  );
  const el = owner?.querySelector("input,select");
  expect(el, `field ${label}`).toBeTruthy();
  return el as HTMLInputElement | HTMLSelectElement;
}
async function fill(label: string, value: string) {
  const el = control(label) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function select(label: string, value: string) {
  const el = control(label) as HTMLSelectElement;
  await act(async () => {
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const saved = () => JSON.parse(localStorage.getItem(WORKSPACE_KEY)!);
it("creates a workplace and two locations with independent defaults using contextual forms", async () => {
  await mount();
  await click("Workplaces");
  await click("Add workplace");
  await fill("Workplace name", "Amazon");
  await click("Icon warehouse");
  await click("Save workplace");
  await click("Add location");
  await fill("Location name", "North");
  await fill("Usual outbound (minutes)", "20");
  await fill("Usual return (minutes)", "25");
  await click("Save location");
  await click("Add location");
  await fill("Location name", "South");
  await fill("Usual outbound (minutes)", "40");
  await fill("Usual return (minutes)", "45");
  await click("Save location");
  expect(saved().locations).toHaveLength(2);
  expect(
    saved().locations.map(
      (l: { commute: { beforeMinutes: number } }) => l.commute.beforeMinutes,
    ),
  ).toEqual([20, 40]);
  expect(saved().workplaces[0].defaultLocationId).toBe(saved().locations[0].id);
});
it("prefills a new shift from the primary location and preserves custom commutes after location edits", async () => {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(fixture()));
  await mount();
  await click("New shift");
  expect(control("Before shift (minutes)").value).toBe("20");
  expect(control("Work location").value).toBe("north");
  await fill("Shift name", "Personal night");
  await fill("Before shift (minutes)", "99");
  await click("Add shift");
  expect(saved().singles[0].commuteSource).toBe("custom");
  await click("Workplaces");
  await click("Open Amazon");
  await click("Edit location North");
  await fill("Usual outbound (minutes)", "55");
  await click("Save location");
  expect(saved().singles[0].commute.beforeMinutes).toBe(99);
  await click("Overview");
  await click("Edit Personal night");
  expect(control("Before shift (minutes)").value).toBe("99");
  expect(control("Work location").value).toBe("north");
  await click("Cancel editing");
});
it("requires an explicit choice before replacing custom travel during location selection", async () => {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(fixture()));
  await mount();
  await click("New shift");
  await fill("Before shift (minutes)", "99");
  await select("Work location", "south");
  await click("Keep custom times");
  expect(control("Before shift (minutes)").value).toBe("99");
  expect(control("Work location").value).toBe("south");
  await select("Work location", "north");
  await click("Use location defaults");
  expect(control("Before shift (minutes)").value).toBe("20");
  await click("Cancel");
});
it("preserves zero custom travel times and supports cancelling a location change", async () => {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(fixture()));
  await mount();
  await click("New shift");
  await fill("Before shift (minutes)", "0");
  await fill("After shift (minutes)", "0");
  await select("Work location", "south");
  await click("Close panel");
  expect(control("Work location").value).toBe("north");
  await select("Work location", "south");
  await click("Keep custom times");
  expect(control("Before shift (minutes)").value).toBe("0");
  expect(control("After shift (minutes)").value).toBe("0");
  await click("Cancel");
});
it("confirms archiving a referenced location and preserves its shift snapshot", async () => {
  const defaults = selectionDefaults(fixture(), "a");
  const data = {
    ...fixture(),
    singles: [
      {
        id: "linked",
        title: "Linked",
        startAt: "2026-10-21T22:00:00Z",
        endAt: "2026-10-22T06:00:00Z",
        color: defaults.color,
        commute: defaults.commute,
        ...associationOf(defaults),
      },
    ],
  };
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
  await mount();
  await click("Workplaces");
  await click("Open Amazon");
  expect(
    container.querySelector('[aria-label="Delete location North"]'),
  ).toBeNull();
  await click("Archive location North");
  await click("Cancel");
  expect(
    saved().locations.find((l: { id: string }) => l.id === "north").archived,
  ).toBe(false);
  await click("Archive location North");
  await click("Confirm");
  expect(
    saved().locations.find((l: { id: string }) => l.id === "north").archived,
  ).toBe(true);
  expect(saved().singles).toEqual(data.singles);
  await click("Overview");
  await click("Edit Linked");
  expect(control("Work location").value).toBe("north");
  expect(control("Before shift (minutes)").value).toBe("20");
  await click("Cancel editing");
});
it("filters only the calendar while preserving global statistics and persisted data", async () => {
  let data = fixture();
  const defaults = selectionDefaults(data, "a");
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const end = new Date(+start + 2 * 3600000);
  data = {
    ...data,
    singles: [
      {
        id: "assigned",
        title: "Assigned",
        color: defaults.color,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        ...associationOf(defaults),
        commute: defaults.commute,
      },
      {
        id: "unassigned",
        title: "Unassigned",
        color: "#5b8cff",
        startAt: new Date(+start + 4 * 3600000).toISOString(),
        endAt: new Date(+end + 4 * 3600000).toISOString(),
      },
    ],
  };
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
  await mount();
  const before = localStorage.getItem(WORKSPACE_KEY),
    stats = container.querySelector(".stat")?.textContent;
  await select("Workplace", "a");
  expect(container.querySelector(".stat")?.textContent).toBe(stats);
  expect(localStorage.getItem(WORKSPACE_KEY)).toBe(before);
  expect(
    container.querySelectorAll(".calendar-event:not(.commute-event)"),
  ).toHaveLength(1);
  await select("Workplace", "all");
  expect(
    container.querySelectorAll(".calendar-event:not(.commute-event)"),
  ).toHaveLength(2);
});
it("keeps old unassigned shifts unassigned even when a matching primary workplace exists", async () => {
  const data = {
    ...fixture(),
    singles: [
      {
        id: "legacy",
        title: "Amazon",
        color: "#5b8cff",
        startAt: "2026-10-21T22:00:00Z",
        endAt: "2026-10-22T06:00:00Z",
        commute: { beforeMinutes: 13, afterMinutes: 17 },
      },
    ],
  };
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
  await mount();
  await click("Edit Amazon");
  expect(control("Workplace").value).toBe("");
  expect(control("Before shift (minutes)").value).toBe("13");
  await click("Save changes");
  expect(saved().singles[0].workplaceId).toBeUndefined();
});
it("stops persistence when another tab changes v3 while local edits are pending", async () => {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(fixture()));
  await mount();
  await click("New shift");
  const external = { ...fixture(), workplaces: [], locations: [] };
  const raw = JSON.stringify(external);
  localStorage.setItem(WORKSPACE_KEY, raw);
  await act(async () =>
    window.dispatchEvent(
      new StorageEvent("storage", { key: WORKSPACE_KEY, newValue: raw }),
    ),
  );
  await fill("Shift name", "Unsaved draft");
  await click("Add shift");
  expect(localStorage.getItem(WORKSPACE_KEY)).toBe(raw);
  expect(container.querySelector("[role=alert]")?.textContent).toContain(
    "another tab",
  );
});
