"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STATUSES, addCredential, filterCredentials, formatRecord, removeCredential, toggleVerified, type Draft, type Status, type StatusFilter } from "@/lib/certs";
import { useLedger } from "@/lib/ledger-store";

export default function Home() {
  const [credentials, setCredentials] = useLedger();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [draft, setDraft] = useState<Draft>({ title: "", issuer: "", year: "2026", status: "In progress" });
  const visible = useMemo(() => filterCredentials(credentials, filter, query), [credentials, filter, query]);

  const stampRecord = () => {
    if (!draft.title.trim() || !draft.issuer.trim()) return;
    setCredentials((current) => addCredential(current, draft, crypto.randomUUID()));
    setDraft({ title: "", issuer: "", year: "2026", status: "In progress" });
  };

  const copyRecord = async (credential: Parameters<typeof formatRecord>[0]) => {
    try { await navigator.clipboard.writeText(formatRecord(credential)); } catch { /* Clipboard is optional. */ }
  };

  return (
    <main className="passport-page">
      <span className="contract-mark" dangerouslySetInnerHTML={{ __html: "<!-- THESIS: credentials are a private passport ledger; FINISH: issue, verify, filter, and copy records without inflating claims -->" }} />
      <div className="passport-shell">
        <header className="passport-topbar"><Link href="/" className="passport-mark">PASSPORT / CREDENTIALS</Link><span>personal record · edition 01</span></header>
        <section className="passport-hero"><div><p className="passport-kicker">a small archive of earned evidence</p><h1>Keep the proof close.</h1></div><div className="passport-seal" aria-hidden="true"><span>BOOK</span><strong>CV</strong><span>RECORD</span></div><p className="passport-deck">A credential ledger for certifications, study paths, and the details that make a claim checkable.</p></section>

        <section className="passport-layout" aria-labelledby="ledger-heading">
          <div className="ledger-column"><header className="passport-heading"><div><span>01</span><h2 id="ledger-heading">Credential ledger</h2></div><strong>{visible.length} records</strong></header><div className="ledger-tools"><input aria-label="Search credentials" placeholder="Search title, issuer, year" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="passport-tabs" role="group" aria-label="Filter credentials">{(["All", ...STATUSES] as StatusFilter[]).map((state) => <button type="button" className={filter === state ? "active" : ""} key={state} onClick={() => setFilter(state)}>{state}</button>)}</div></div><div className="credential-list">{visible.map((credential, index) => <article className="credential" key={credential.id}><div className="credential-number">{String(index + 1).padStart(2, "0")}</div><div><div className="credential-title"><h3>{credential.title}</h3><span className={`credential-status status-${credential.status.toLowerCase().replace(" ", "-")}`}>{credential.status}</span></div><p>{credential.issuer} · {credential.year}</p><small>{credential.code}</small><div className="credential-actions"><button type="button" onClick={() => setCredentials((current) => toggleVerified(current, credential.id))}>{credential.status === "Verified" ? "Mark in progress" : "Mark verified"}</button><button type="button" onClick={() => copyRecord(credential)}>Copy record</button><button type="button" onClick={() => setCredentials((current) => removeCredential(current, credential.id))}>Remove</button></div></div></article>)}{visible.length === 0 && <p className="empty-ledger">No credential matches this filter.</p>}</div></div>
          <aside className="issue-panel"><header className="passport-heading"><div><span>02</span><h2>Issue a record</h2></div></header><label><span>Credential title</span><input value={draft.title} placeholder="What was earned?" onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label><span>Issuer / source</span><input value={draft.issuer} placeholder="Who can confirm it?" onChange={(event) => setDraft((current) => ({ ...current, issuer: event.target.value }))} /></label><div className="issue-pair"><label><span>Year</span><input value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value }))} /></label><label><span>State</span><select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Status }))}><option>In progress</option><option>Verified</option><option>Expired</option></select></label></div><button type="button" className="stamp-button" onClick={stampRecord}>Stamp the ledger</button><p className="issue-note">Adding a record is not independent verification. This passport stores your own record of the claim.</p></aside>
        </section>
        <footer className="passport-footer">Personal evidence archive · no issuer API, verification service, or third-party endorsement is implied.</footer>
      </div>
    </main>
  );
}
