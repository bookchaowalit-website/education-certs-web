import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("server-renders the sample ledger, the issue form and the no-verification notice", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Keep the proof close.");
    expect(html).toContain("AWS Solutions Architect");
    expect(html).toContain("Cloud Architecture Path");
    expect(html).toContain("3<!-- --> records");
    expect(html).toContain("Stamp the ledger");
    expect(html).toContain("no issuer API, verification service, or third-party endorsement is implied");
  });
});
