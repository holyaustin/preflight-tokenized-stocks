// First LIVE test. Run: npm run smoke   (needs OC_API_KEY and OC_SECRET_KEY in your environment)
// Time this from "opened the docs" to "first PASS": onboarding time is a Developer Experience Report question.
import { w3get, w3post, recentCalls } from "../lib/client";
import { resolveAsset, snapshot } from "../lib/rwa";
import { tokenStats, hourlyCandles } from "../lib/market";

const step = async (name: string, fn: () => Promise<unknown>) => {
  try {
    console.log(`PASS  ${name}`, (await fn()) ?? "");
  } catch (e: any) {
    console.log(`FAIL  ${name}  ->  ${e.message}`);
  }
};

await step("RWA platforms", async () => (await w3get("/api/v1/dex/market/rwa/platforms")).map((p: any) => `${p.platformId}:${p.tickerCount}`));
await step("Trading API lists BSC", async () => (await w3get("/api/v1/dex/aggregator/supported/chain", { binanceChainId: "56" })).map((c: any) => c.shortName));
await step("Transaction API lists BSC (needed for simulate)", async () => ((await w3get("/api/v1/dex/pre-transaction/supported/chain")).some((c: any) => c.binanceChainId === "56") ? "yes" : "NO"));
await step("Wallet API lists BSC", async () => ((await w3get("/api/v1/dex/balance/supported/chain", { binanceChainId: "56" })).length ? "yes" : "NO"));

const r = await resolveAsset("NVDA");
await step("Resolve NVDA", async () => r?.assets.map((a) => `${a.platformId}:${a.tokenSymbol}`));
if (r?.assets[0]) {
  const a = r.assets[0];
  await step("RWA snapshot", async () => { const s = await snapshot(a); return { price: s.tokenPrice, ref: s.referencePrice, status: s.market.marketStatus, reason: s.market.reasonCode }; });
  await step("price-info (watch for the array-vs-object body quirk)", async () => tokenStats(a.tokenContractAddress));
  await step("candles", async () => { const c = await hourlyCandles(a.tokenContractAddress, 5); return c.length + " candles, last close " + c.at(-1)?.c; });
}

console.log("\nCall log. Paste notable latencies and exact error messages into your report notes:");
console.table(recentCalls);
