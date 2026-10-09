// Hosted MCP endpoint (Streamable HTTP, stateless). Any MCP client can use:  https://YOUR-HOST/api/mcp
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPreflightServer } from "@/lib/mcp-server";
import { clientIp, limited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  if (limited(clientIp(req), 30)) return Response.json({ error: "Too many requests" }, { status: 429 });
  const server = createPreflightServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
