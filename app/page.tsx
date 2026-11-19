"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, Pill, PlusIcon, type Tone } from "@/components/app-shell";
import { STATUSES, addCredential, filterCredentials, formatRecord, removeCredential, restoreCredential, toggleVerified, type Credential, type Draft, type Status, type StatusFilter } from "@/lib/certs";
import { useLedger } from "@/lib/ledger-store";

// The credential ledger on the App shell: lists by state on the left, one list on the right, a composer
// that opens in place, and Remove with Undo instead of an instant, silent delete.

const TONE: Record<Status, Tone> = { Verified: "green", "In progress": "amber", Expired: "grey" };
const EMPTY_DRAFT: Draft = { title: "", issuer: "", year: String(new Date().getFullYear()), status: "In progress" };
// index: where it sat in the stored list when removed. nextShown / prevShown: the rows shown around it, for focus.
type RemovedEntry = { credential: Credential; index: number; nextShown?: string; prevShown?: string };
type RemovedBatch = { removals: RemovedEntry[]; viaKeyboard: boolean };
const removedLabel = (removals: RemovedEntry[]) => (removals.length === 1 ? `Removed “${removals[0].credential.title}”` : `Removed ${removals.length} records`);

// randomUUID only exists in secure contexts (HTTPS/localhost) and newer browsers.
function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `cert-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  const [credentials, setCredentials] = useLedger();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  // Every removal still inside the Undo window: one Undo puts them all back where they were.
  const [removed, setRemovedState] = useState<RemovedBatch | null>(null);
  // The latest batch, so two removals before a re-render still both land in it.
  const removedRef = useRef<RemovedBatch | null>(null);
  const setRemoved = (batch: RemovedBatch | null) => { removedRef.current = batch; setRemovedState(batch); };
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<string[] | null>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const wasComposing = useRef(false);
  const visible = useMemo(() => filterCredentials(credentials, filter, query), [credentials, filter, query]);
  const countOf = (status: StatusFilter) => (status === "All" ? credentials.length : credentials.filter((c) => c.status === status).length);

  // Opening the composer focuses its title; closing it returns focus to New record.
  useEffect(() => {
    if (composing) titleRef.current?.focus();
    else if (wasComposing.current) newRef.current?.focus();
    wasComposing.current = composing;
  }, [composing]);
  useEffect(() => { if (removed?.viaKeyboard) undoRef.current?.focus(); }, [removed]);
  // When the toast closes after Undo or Escape, focus goes back near the removed row once the list has re-rendered:
  // the first of these rows still shown, else the New button.
  useEffect(() => {
    const ids = focusNext.current;
    if (removed || !ids) return;
    focusNext.current = null;
    const rows = [...document.querySelectorAll<HTMLElement>(".as-row[data-item]")];
    const row = ids.map((id) => rows.find((entry) => entry.dataset.item === id)).find(Boolean);
    (row?.querySelector<HTMLButtonElement>(".as-danger") ?? newRef.current)?.focus();
  }, [removed, credentials]);
  // While the toast shows, reserve its height (plus its 24px offset and a gap) at the bottom of the page and in
  // scroll-padding, so the last rows and anything focused behind it can scroll clear of it.
  const toastShown = removed !== null;
  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toastShown || !toast) return;
    const rootStyle = document.documentElement.style;
    const reserve = () => rootStyle.setProperty("--as-toast-space", `${toast.offsetHeight + 32}px`);
    reserve();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(reserve) : null;
    observer?.observe(toast);
    return () => { observer?.disconnect(); rootStyle.removeProperty("--as-toast-space"); };
  }, [toastShown]);
  // The toast closes 6 s after the latest removal (each removal restarts it), but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => { removedRef.current = null; setRemovedState(null); }, 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.issuer.trim()) return;
    setCredentials((current) => addCredential(current, draft, createId()));
    // Show the new record: its own list, and no search that might hide it.
    if (filter !== "All" && filter !== draft.status) setFilter(draft.status);
    setQuery("");
    setAnnouncement(`Added “${draft.title.trim()}”.`);
    setDraft(EMPTY_DRAFT);
    setComposing(false);
  }
  function remove(credential: Credential, viaKeyboard: boolean) {
    const index = credentials.findIndex((c) => c.id === credential.id);
    setCredentials((current) => removeCredential(current, credential.id));
    const shownAt = visible.findIndex((item) => item.id === credential.id);
    const removal: RemovedEntry = { credential, index, nextShown: visible[shownAt + 1]?.id, prevShown: shownAt > 0 ? visible[shownAt - 1].id : undefined };
    const removals = [...(removedRef.current?.removals ?? []), removal];
    setRemoved({ removals, viaKeyboard });
    setAnnouncement(removals.length === 1 ? `Removed “${credential.title}”. Undo is available for a few seconds.` : `Removed ${removals.length} records. Undo is available for a few seconds.`);
  }
  function closeToast(focusIds?: string[]) {
    const last = removedRef.current?.removals.at(-1);
    // Dismissed: the row after the removed one, else the one before it.
    focusNext.current = focusIds ?? [last?.nextShown, last?.prevShown].filter((id): id is string => Boolean(id));
    setRemoved(null);
    setToastFocused(false);
  }
  function undo() {
    const removals = removedRef.current?.removals;
    if (!removals?.length) return;
    // Latest removal first, so each index refers to the list as it was just before that removal.
    setCredentials((current) => removals.reduceRight((list, { credential, index }) => restoreCredential(list, credential, index), current));
    const latest = removals[removals.length - 1].credential;
    setAnnouncement(removals.length === 1 ? `Restored “${latest.title}”.` : `Restored ${removals.length} records.`);
    // Undone: back to the restored row the user removed last.
    closeToast([latest.id]);
  }
  async function copy(credential: Credential) {
    try {
      await navigator.clipboard.writeText(formatRecord(credential));
      setAnnouncement(`Copied “${credential.title}” as text.`);
    } catch {
      setAnnouncement("Copying is blocked in this browser. Select the record text instead.");
    }
  }
  function toggle(credential: Credential) {
    setCredentials((current) => toggleVerified(current, credential.id));
    setAnnouncement(`“${credential.title}” is now ${credential.status === "Verified" ? "In progress" : "Verified"}.`);
  }
  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  const title = filter === "All" ? "All records" : filter;
  const lists: { value: StatusFilter; tone?: Tone }[] = [{ value: "All" }, ...STATUSES.map((status) => ({ value: status, tone: TONE[status] }))];
  const q = query.trim();

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Credentials" tagline="A personal ledger of certifications" />

      <div className="as-body">
        <aside className="as-side" aria-label="Lists">
          <h2>Lists</h2>
          <ul className="as-lists">
            {lists.map(({ value, tone }) => (
              <ListButton key={value} label={value === "All" ? "All records" : value} count={countOf(value)} tone={tone} current={filter === value} onSelect={() => setFilter(value)} />
            ))}
          </ul>
        </aside>

        <main id="main" className="as-main">
          <div className="as-head">
            <div>
              <h1>{title}</h1>
              <p aria-live="polite">{visible.length} {visible.length === 1 ? "record" : "records"}{q ? ` matching “${q}”` : ""}</p>
            </div>
            <div className="as-tools">
              <label className="as-search">
                <span className="as-sr">Search records</span>
                <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, issuer or year" />
              </label>
              {composing ? null : <button ref={newRef} type="button" className="as-button" onClick={() => setComposing(true)}><PlusIcon />New record</button>}
            </div>
          </div>

          {composing ? (
            <form className="as-composer" onSubmit={add} aria-label="New record">
              <label className="as-field">Credential
                <input ref={titleRef} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What was earned?" autoComplete="off" />
              </label>
              <label className="as-field">Issuer or source
                <input value={draft.issuer} onChange={(event) => setDraft({ ...draft, issuer: event.target.value })} placeholder="Who can confirm it?" autoComplete="off" />
              </label>
              <label className="as-field">Year
                <input value={draft.year} inputMode="numeric" onChange={(event) => setDraft({ ...draft, year: event.target.value })} autoComplete="off" />
              </label>
              <div className="as-composer-foot">
                <div className="as-segmented-wrap">
                  <span id="state-label">State</span>
                  <div className="as-segmented" role="group" aria-labelledby="state-label">
                    {STATUSES.map((status) => (
                      <button key={status} type="button" aria-pressed={draft.status === status} onClick={() => setDraft({ ...draft, status })}>{status}</button>
                    ))}
                  </div>
                </div>
                <div className="as-composer-actions">
                  <button type="button" className="as-plain" onClick={() => { setComposing(false); setDraft(EMPTY_DRAFT); }}>Cancel</button>
                  <button type="submit" className="as-button" disabled={!draft.title.trim() || !draft.issuer.trim()}>Add</button>
                </div>
              </div>
            </form>
          ) : null}

          {visible.length ? (
            <ul className="as-list" aria-label={title}>
              {visible.map((credential) => (
                <li className="as-row" key={credential.id} data-item={credential.id}>
                  <div>
                    <h3>{credential.title}</h3>
                    <p>{credential.issuer}{credential.year ? ` · ${credential.year}` : ""}</p>
                    <p className="as-row-meta certs-code">Record {credential.code}</p>
                    <div className="certs-actions">
                      <button type="button" className="as-plain" onClick={() => toggle(credential)}>{credential.status === "Verified" ? "Mark in progress" : "Mark verified"}</button>
                      <button type="button" className="as-plain" aria-label={`Copy ${credential.title}`} onClick={() => copy(credential)}>Copy</button>
                      <button type="button" className="as-plain as-danger" aria-label={`Remove ${credential.title}`} onClick={(event) => remove(credential, event.detail === 0)}>Remove</button>
                    </div>
                  </div>
                  <Pill tone={TONE[credential.status]}>{credential.status}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-list as-empty">
              {q ? (
                <>
                  <strong>Nothing matches</strong>
                  No record in {filter === "All" ? "the ledger" : title} mentions “{q}”.
                  <div><button type="button" className="as-plain" onClick={clearSearch}>Clear search</button></div>
                </>
              ) : credentials.length === 0 ? (
                <>
                  <strong>The ledger is empty</strong>
                  Press New record to write down the first credential.
                </>
              ) : (
                <>
                  <strong>Nothing is {title} yet</strong>
                  No record has this state.
                  <div><button type="button" className="as-plain" onClick={() => setFilter("All")}>Show all records</button></div>
                </>
              )}
            </div>
          )}

          <p className="as-note">Saved in this browser only. “Verified” is your own label: no issuer API, verification service or endorsement is implied.</p>
        </main>
      </div>

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {removed ? (
        <div
          ref={toastRef}
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{removedLabel(removed.removals)}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo} aria-label={removed.removals.length === 1 ? "Undo remove" : `Undo remove of ${removed.removals.length} records`}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/education-certs-web" />
    </div>
  );
}
