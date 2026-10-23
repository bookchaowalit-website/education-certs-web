import { describe, expect, it } from "vitest";
import { SEED, addCredential, filterCredentials, formatRecord, parseCredentials, removeCredential, serializeCredentials, toggleVerified } from "@/lib/certs";

describe("credential storage", () => {
  it("round-trips a ledger through localStorage text", () => {
    expect(parseCredentials(serializeCredentials(SEED))).toEqual(SEED);
  });

  it("returns null for missing, broken or wrongly shaped saved data instead of crashing the page", () => {
    expect(parseCredentials(null)).toBeNull();
    expect(parseCredentials("{not json")).toBeNull();
    // The old page did setValue(JSON.parse(saved)) and then called .filter on it: an object here crashed it.
    expect(parseCredentials('{"certs":[]}')).toBeNull();
    expect(parseCredentials('[{"id":"x"}]')).toBeNull();
    expect(parseCredentials('[{"id":"x","title":"T","issuer":"I","year":"2024","status":"Lost","code":"C"}]')).toBeNull();
  });

  it("accepts an empty saved ledger (everything removed) rather than restoring the samples", () => {
    expect(parseCredentials("[]")).toEqual([]);
  });
});

describe("ledger operations", () => {
  it("filters by status and searches title, issuer and year case-insensitively", () => {
    expect(filterCredentials(SEED, "Verified", "").map((c) => c.id)).toEqual(["aws", "google"]);
    expect(filterCredentials(SEED, "All", "AMAZON").map((c) => c.id)).toEqual(["aws"]);
    expect(filterCredentials(SEED, "All", "2026").map((c) => c.id)).toEqual(["cloud"]);
    expect(filterCredentials(SEED, "Expired", "")).toEqual([]);
    expect(filterCredentials(SEED, "All", "  aws  ").map((c) => c.id)).toEqual(["aws"]);
  });

  it("adds a trimmed record at the top and refuses one without title or issuer", () => {
    const next = addCredential(SEED, { title: "  CKA ", issuer: " CNCF ", year: "2025", status: "Verified" }, "id-1");
    expect(next[0]).toEqual({ id: "id-1", title: "CKA", issuer: "CNCF", year: "2025", status: "Verified", code: "LOCAL-2025" });
    expect(next).toHaveLength(SEED.length + 1);
    expect(addCredential(SEED, { title: " ", issuer: "CNCF", year: "2025", status: "Verified" }, "id-2")).toBe(SEED);
    expect(addCredential(SEED, { title: "CKA", issuer: "", year: "2025", status: "Verified" }, "id-3")).toBe(SEED);
  });

  it("toggles verified and removes by id without touching the others", () => {
    const toggled = toggleVerified(SEED, "cloud");
    expect(toggled.find((c) => c.id === "cloud")?.status).toBe("Verified");
    expect(toggleVerified(toggled, "cloud").find((c) => c.id === "cloud")?.status).toBe("In progress");
    expect(removeCredential(SEED, "aws").map((c) => c.id)).toEqual(["google", "cloud"]);
  });

  it("formats a copyable record", () => {
    expect(formatRecord(SEED[0])).toBe("AWS Solutions Architect — Amazon Web Services (2024)\nRecord: AWS-SAA-24");
  });
});
