import { NextResponse } from "next/server";
import { SEED, filterCredentials } from "@/lib/certs";

// Stateless JSON-RPC MCP endpoint over the sample credentials the page starts with. A visitor's own
// ledger lives only in their browser (localStorage), so the server cannot and does not expose it.

type RpcRequest = { id?: number | string | null; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };

const TOOLS = [
  { name: "get_all", description: "List the sample credentials shown before any local edits", inputSchema: { type: "object", properties: {} } },
  { name: "get_by_id", description: "Get one sample credential by id", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "search", description: "Search sample credentials by title, issuer or year", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
];

class RpcError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

function callTool(name: string | undefined, args: Record<string, unknown> = {}) {
  switch (name) {
    case "get_all":
      return { credentials: SEED };
    case "get_by_id": {
      const credential = SEED.find((c) => c.id === args.id);
      if (!credential) throw new RpcError(-32602, `No sample credential with id ${String(args.id)}`);
      return { credential };
    }
    case "search":
      return { credentials: filterCredentials(SEED, "All", typeof args.query === "string" ? args.query : "") };
    default:
      throw new RpcError(-32602, `Unknown tool: ${String(name)}`);
  }
}

export async function POST(request: Request) {
  let id: RpcRequest["id"] = null;
  try {
    const body = (await request.json()) as RpcRequest;
    id = body.id ?? null;
    let result: unknown;
    switch (body.method) {
      case "initialize":
        result = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "Certifications", version: "1.0.0" } };
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call":
        result = callTool(body.params?.name, body.params?.arguments);
        break;
      default:
        throw new RpcError(-32601, `Unknown method: ${String(body.method)}`);
    }
    return NextResponse.json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    const code = error instanceof RpcError ? error.code : -32700;
    const message = error instanceof RpcError ? error.message : "Parse error";
    return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
  }
}
