// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { STORAGE_KEY } from "@/lib/certs";

// Mounted tests for the ledger on the App shell: lists, search, composer, toggle, copy, remove and undo.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
const button = (text: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent)?.trim().startsWith(text)) as HTMLButtonElement;
const rows = () => [...host.querySelectorAll(".as-row h3")].map((h) => h.textContent);
const press = (el: Element, detail = 1) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
function type(el: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("lists and search", () => {
  it("filters by state from the sidebar and counts each list", () => {
    expect(rows()).toHaveLength(3);
    expect(button("Verified", $(".as-side")!).textContent).toBe("Verified2");
    press(button("In progress", $(".as-side")!));
    expect($("h1")!.textContent).toBe("In progress");
    expect(rows()).toEqual(["Cloud Architecture Path"]);
  });

  it("searches live, says nothing matches, and Clear search puts focus back in the field", () => {
    type($<HTMLInputElement>(".as-search input")!, "kubernetes");
    expect($(".as-empty strong")!.textContent).toBe("Nothing matches");
    press(button("Clear search"));
    expect(rows()).toHaveLength(3);
    expect(document.activeElement).toBe($(".as-search input"));
  });

  it("shows a separate empty list state with a way back to all records", () => {
    press(button("Expired", $(".as-side")!));
    expect($(".as-empty strong")!.textContent).toBe("Nothing is Expired yet");
    press(button("Show all records"));
    expect($("h1")!.textContent).toBe("All records");
  });
});

describe("composer", () => {
  it("opens focused, needs title and issuer, adds on top, saves and returns focus", () => {
    press(button("New record"));
    const [title, issuer] = [...host.querySelectorAll<HTMLInputElement>(".as-composer input")];
    expect(document.activeElement).toBe(title);
    expect(button("Add", $(".as-composer")!).disabled).toBe(true);
    type(title, "CKA");
    expect(button("Add", $(".as-composer")!).disabled).toBe(true);
    type(issuer, "Linux Foundation");
    press(button("Expired", $(".as-composer")!));
    press(button("In progress", $(".as-side")!));
    press(button("Add", $(".as-composer")!));
    expect($("h1")!.textContent).toBe("Expired");
    expect(rows()).toEqual(["CKA"]);
    expect(document.activeElement?.textContent).toContain("New record");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0]).toMatchObject({ title: "CKA", issuer: "Linux Foundation", status: "Expired" });
  });

  it("Cancel closes the composer without adding", () => {
    press(button("New record"));
    press(button("Cancel"));
    expect($(".as-composer")).toBeNull();
    expect(rows()).toHaveLength(3);
  });
});

describe("row actions", () => {
  it("toggles verified and announces it", () => {
    press(button("Mark verified"));
    expect(host.querySelectorAll(".as-pill[data-tone='green']")).toHaveLength(3);
    expect($("[role='status']")!.textContent).toContain("is now Verified");
  });

  it("copies a record as text, and explains when the clipboard is blocked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await act(async () => { button("Copy AWS").click(); });
    expect(writeText).toHaveBeenCalledWith("AWS Solutions Architect — Amazon Web Services (2024)\nRecord: AWS-SAA-24");
    expect($("[role='status']")!.textContent).toContain("Copied");
    writeText.mockRejectedValueOnce(new Error("blocked"));
    await act(async () => { button("Copy AWS").click(); });
    expect($("[role='status']")!.textContent).toContain("Copying is blocked");
  });

  it("removes with an Undo toast that puts the record back in place", () => {
    press(button("Remove Analytics"), 0);
    expect(rows()).toEqual(["AWS Solutions Architect", "Cloud Architecture Path"]);
    expect(document.activeElement).toBe(button("Undo"));
    press(button("Undo"));
    expect(rows()).toEqual(["AWS Solutions Architect", "Analytics Certification", "Cloud Architecture Path"]);
    expect($(".as-toast")).toBeNull();
  });

  it("closes the toast on Escape, and by itself after a few seconds", () => {
    vi.useFakeTimers();
    press(button("Remove AWS"));
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".as-toast")).toBeNull();
    press(button("Remove Cloud"));
    act(() => { vi.advanceTimersByTime(6100); });
    expect($(".as-toast")).toBeNull();
    press(button("Remove Analytics"));
    expect($(".as-empty strong")!.textContent).toBe("The ledger is empty");
  });
});

describe("batch Undo", () => {
  // Two more records, so there are at least three rows to remove from.
  beforeEach(() => {
    for (const name of ["CKA", "CKAD"]) {
      press(button("New record"));
      const [title, issuer] = [...host.querySelectorAll<HTMLInputElement>(".as-composer input")];
      type(title, name);
      type(issuer, "Linux Foundation");
      press(button("Add", $(".as-composer")!));
    }
  });
  // detail 0 = keyboard (Enter/Space) click, 1 = pointer click.
  const click = (el: Element, detail: number) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
  const shownRows = () => [...host.querySelectorAll<HTMLElement>(".as-row[data-item]")];
  const rowIds = () => shownRows().map((row) => row.dataset.item);
  const removeButton = (i: number) => shownRows()[i].querySelector<HTMLButtonElement>(".as-danger")!;
  const undoButton = () => host.querySelector<HTMLButtonElement>(".as-toast button")!;
  const escape = () => act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });

  it("consecutive removes restore together with one Undo", () => {
    vi.useFakeTimers();
    const before = rowIds();
    expect(before.length).toBeGreaterThanOrEqual(3);
    click(removeButton(1), 1);
    act(() => { vi.advanceTimersByTime(4000); });
    click(removeButton(0), 1);
    expect(rowIds()).toEqual(before.slice(2));
    expect($(".as-toast span")!.textContent).toBe("Removed 2 records");
    expect(undoButton().getAttribute("aria-label")).toBe("Undo remove of 2 records");
    // The second removal restarted the 6 s window: 4 s later it is still open.
    act(() => { vi.advanceTimersByTime(4000); });
    click(undoButton(), 1);
    expect(rowIds()).toEqual(before);
    expect($(".as-toast")).toBeNull();
    expect($(".as-sr[role=status]")!.textContent).toBe("Restored 2 records.");
  });

  it("keyboard remove focuses Undo; Undo focuses the restored row, Escape the next one", () => {
    const before = rowIds();
    click(removeButton(0), 0);
    expect(document.activeElement).toBe(undoButton());
    expect(document.documentElement.style.getPropertyValue("--as-toast-space")).toMatch(/px$/);
    click(undoButton(), 0);
    expect(rowIds()).toEqual(before);
    expect(document.activeElement).toBe(removeButton(0));
    click(removeButton(0), 0);
    escape();
    expect($(".as-toast")).toBeNull();
    expect(document.activeElement).toBe(removeButton(0));
    expect(rowIds()).toEqual(before.slice(1));
  });
});
