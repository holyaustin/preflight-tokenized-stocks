// Local MCP server over stdio. Run with: npm run mcp
// IMPORTANT: stdio servers must never write to stdout (it carries the protocol). Log to stderr only.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPreflightServer } from "../lib/mcp-server";

async function main() {
  await createPreflightServer().connect(new StdioServerTransport());
  console.error("preflight MCP server running on stdio");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
