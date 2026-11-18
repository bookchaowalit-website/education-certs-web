import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import nextConfig from "@/next.config";

describe("home page", () => {
  it("server-renders the App shell with the sample ledger, lists and the honest note", () => {
    const html = renderToString(<Home />);
    expect(html).toContain('<h1>All records</h1>');
    expect(html).toContain("AWS Solutions Architect");
    expect(html).toContain("Cloud Architecture Path");
    expect(html).toContain("New record");
    expect(html).toContain('href="#main"');
    expect(html).toContain('href="https://bookchaowalit.com/"');
    expect(html).toContain("no issuer API, verification service or endorsement is implied");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
});

describe("site files", () => {
  it("points robots and the sitemap at the site's own domain", () => {
    expect(robots().sitemap).toBe("https://certs.bookchaowalit.com/sitemap.xml");
    expect(sitemap()[0].url).toBe("https://certs.bookchaowalit.com/");
  });

  it("sends the retired /more-projects page to the portfolio hub for good", async () => {
    expect(await nextConfig.redirects!()).toContainEqual({ source: "/more-projects", destination: "https://bookchaowalit.com/", permanent: true });
  });
});
