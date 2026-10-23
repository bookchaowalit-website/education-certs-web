import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";

function rpc(body: unknown) {
  return POST(new Request("http://localhost/api/mcp", { method: "POST", body: JSON.stringify(body) }));
}

describe("MCP route", () => {
  it("echoes the JSON-RPC request id", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 7, method: "tools/list" });
    expect((await res.json()).id).toBe(7);
  });

  it("get_all returns the sample credentials the page starts with", async () => {
    const { result } = await (await rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_all" } })).json();
    expect(result.credentials.map((c: { id: string }) => c.id)).toEqual(["aws", "google", "cloud"]);
  });

  it("search uses the same matching as the page", async () => {
    const { result } = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { query: "skillshop" } } })).json();
    expect(result.credentials.map((c: { id: string }) => c.id)).toEqual(["google"]);
  });

  it("get_by_id answers -32602 for an unknown id", async () => {
    const body = await (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_by_id", arguments: { id: "nope" } } })).json();
    expect(body.error.code).toBe(-32602);
    expect(body.id).toBe(3);
  });

  it("rejects an unknown tool instead of pretending to call it", async () => {
    const body = await (await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "delete_all" } })).json();
    expect(body.error.code).toBe(-32602);
    expect(body.result).toBeUndefined();
  });

  it("answers -32601 for an unknown method and -32700 for bad JSON", async () => {
    expect((await (await rpc({ jsonrpc: "2.0", id: 5, method: "resources/list" })).json()).error.code).toBe(-32601);
    const bad = await POST(new Request("http://localhost/api/mcp", { method: "POST", body: "{" }));
    expect((await bad.json()).error.code).toBe(-32700);
  });
});
