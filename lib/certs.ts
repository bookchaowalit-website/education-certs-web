// Credential ledger logic shared by the page and the MCP route. Pure functions, no browser APIs.

export const STATUSES = ["Verified", "In progress", "Expired"] as const;
export type Status = (typeof STATUSES)[number];
export type StatusFilter = "All" | Status;
export type Credential = { id: string; title: string; issuer: string; year: string; status: Status; code: string };
export type Draft = Pick<Credential, "title" | "issuer" | "year" | "status">;

export const STORAGE_KEY = "certs-v2";

export const SEED: Credential[] = [
  { id: "aws", title: "AWS Solutions Architect", issuer: "Amazon Web Services", year: "2024", status: "Verified", code: "AWS-SAA-24" },
  { id: "google", title: "Analytics Certification", issuer: "Google Skillshop", year: "2023", status: "Verified", code: "GA-23-BOOK" },
  { id: "cloud", title: "Cloud Architecture Path", issuer: "Independent study", year: "2026", status: "In progress", code: "STUDY-26" },
];

function isCredential(value: unknown): value is Credential {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    ["id", "title", "issuer", "year", "code"].every((key) => typeof c[key] === "string") &&
    (STATUSES as readonly unknown[]).includes(c.status)
  );
}

/** Parse saved ledger text. Returns null when nothing usable is saved, so the caller keeps the samples. */
export function parseCredentials(raw: string | null): Credential[] | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isCredential) ? value : null;
  } catch {
    return null;
  }
}

export function serializeCredentials(credentials: Credential[]): string {
  return JSON.stringify(credentials);
}

export function filterCredentials(credentials: Credential[], filter: StatusFilter, query: string): Credential[] {
  const needle = query.trim().toLowerCase();
  return credentials.filter(
    (c) => (filter === "All" || c.status === filter) && `${c.title} ${c.issuer} ${c.year}`.toLowerCase().includes(needle),
  );
}

/** Add a record at the top. Returns the same array when the title or issuer is blank. */
export function addCredential(credentials: Credential[], draft: Draft, id: string): Credential[] {
  const title = draft.title.trim();
  const issuer = draft.issuer.trim();
  if (!title || !issuer) return credentials;
  const year = draft.year.trim();
  return [{ id, title, issuer, year, status: draft.status, code: `LOCAL-${year || "UNDATED"}` }, ...credentials];
}

export function toggleVerified(credentials: Credential[], id: string): Credential[] {
  return credentials.map((c) => (c.id === id ? { ...c, status: c.status === "Verified" ? "In progress" : "Verified" } : c));
}

export function removeCredential(credentials: Credential[], id: string): Credential[] {
  return credentials.filter((c) => c.id !== id);
}

export function formatRecord(c: Credential): string {
  return `${c.title} — ${c.issuer} (${c.year})\nRecord: ${c.code}`;
}
