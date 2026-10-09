import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveAsset, snapshot } from "./rwa";
import { tokenStats, hourlyCandles } from "./market";
import { preflight, compareVenues, isAddress } from "./preflight";
import { PRESETS } from "./policy";
import { verifyReceipt } from "./receipt";
import { PREFLIGHT_VERSION } from "./config";

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
});

const ticker = z.string().min(1).max(10).describe("Stock ticker, e.g. NVDA");
const wallet = z.string().refine(isAddress, "must be a 0x BSC address").describe("BSC wallet address that would trade (read-only, no keys needed)");
const usd = z.number().positive().max(100000).describe("Trade size in USD");
const policy = z.enum(["cautious", "balanced", "permissive"]).optional().describe("Risk policy preset (default: balanced)");
const platform = z.enum(["ondo", "bstock"]).optional().describe("Restrict to one issuer platform");

// Used by BOTH the local stdio server (mcp/server.ts) and the hosted HTTP endpoint (app/api/mcp).
export function createPreflightServer(): McpServer {
  const server = new McpServer({ name: "preflight-tokenized-stocks", version: PREFLIGHT_VERSION });

  server.registerTool(
    "preflight_check",
    {
      title: "Pre-trade check (GO / CAUTION / BLOCK)",
      description:
        "Call this BEFORE any buy of a tokenized stock on BSC. Checks market status, price integrity, unanchored weekend drift, liquidity vs your size, wallet funds and gas, real quote cost, and an approval dry-run with spender verification. Judged against a risk policy. Returns a verdict, categorized reasons and a tamper-evident receipt. If the verdict is BLOCK, do not trade.",
      inputSchema: { ticker, usd, wallet, policy, platform, deep: z.boolean().optional().describe("Also try to simulate an AMM swap (Flash API)") },
    },
    async (a) => {
      try { return ok(await preflight(a)); } catch (e) { return fail(e); }
    }
  );

  server.registerTool(
    "compare_venues",
    {
      title: "Compare Ondo vs bStocks and pick the best venue",
      description: "Runs the full pre-trade check on every platform that lists the ticker on BSC, with the same policy, and recommends the cheapest venue that is not blocked.",
      inputSchema: { ticker, usd, wallet, policy },
    },
    async (a) => {
      try { return ok(await compareVenues(a)); } catch (e) { return fail(e); }
    }
  );

  server.registerTool(
    "market_status",
    {
      title: "Market status, price integrity and 24h stats",
      description: "Is the underlying equity market open? Any earnings or corporate-action restriction? On-chain vs reference price, share ratio, attestations, 1h/4h/24h change, volume and liquidity. Read-only, no wallet needed.",
      inputSchema: { ticker, platform },
    },
    async ({ ticker, platform }) => {
      try {
        const res = await resolveAsset(ticker);
        const a = res?.assets.find((x) => !platform || x.platformId === platform);
        if (!a) throw new Error("asset not found on BSC");
        const [snap, stats, candles] = await Promise.all([
          snapshot(a),
          tokenStats(a.tokenContractAddress).catch(() => null),
          hourlyCandles(a.tokenContractAddress).catch(() => []),
        ]);
        return ok({ ticker, platform: a.platformId, snapshot: snap, stats, sparkline: candles.map((c) => c.c) });
      } catch (e) { return fail(e); }
    }
  );

  server.registerTool(
    "resolve_asset",
    {
      title: "Find tokenized versions of a ticker",
      description: "Which tokenized versions (Ondo, bStocks) of a ticker exist on BSC, with contract addresses.",
      inputSchema: { ticker },
    },
    async ({ ticker }) => {
      try { return ok(await resolveAsset(ticker)); } catch (e) { return fail(e); }
    }
  );

  server.registerTool(
    "verify_receipt",
    {
      title: "Verify a PreFlight receipt",
      description: "Recomputes the hash of a receipt returned by preflight_check and reports whether it was altered.",
      inputSchema: { receipt: z.object({ id: z.string(), hash: z.string(), version: z.string(), mac: z.string().optional(), body: z.any() }) },
    },
    async ({ receipt }) => {
      try { return ok(verifyReceipt(receipt as any)); } catch (e) { return fail(e); }
    }
  );

  server.registerResource(
    "policies",
    "preflight://policies",
    { title: "Risk policy presets", description: "The thresholds behind cautious / balanced / permissive", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(PRESETS, null, 2) }] })
  );

  server.registerPrompt(
    "safe_buy",
    {
      title: "Buy a tokenized stock safely",
      description: "A guarded buy flow: preflight first, trade only on GO, ask the human on CAUTION, never on BLOCK.",
      argsSchema: { ticker: z.string(), usd: z.string(), wallet: z.string() },
    },
    ({ ticker, usd, wallet }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I want to buy $${usd} of ${ticker} (tokenized, BSC) from wallet ${wallet}.\n1. Call preflight_check first (policy: balanced unless I say otherwise).\n2. If the verdict is BLOCK, stop and explain the blocking reasons in plain language.\n3. If CAUTION, summarize the cautions and ask me before continuing.\n4. If GO, you may proceed with the trade using my wallet tooling, and keep the receipt id with the trade record.`,
          },
        },
      ],
    })
  );

  return server;
}
