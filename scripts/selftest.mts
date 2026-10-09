// Offline tests: no API key, no network. Run: npm run selftest
// Part 1 tests the pure logic. Part 2 runs the whole pipeline against a STUBBED API
// (response shapes copied from the docs' examples), so it proves our wiring, not Binance's behavior.
import assert from "node:assert/strict";

process.env.OC_API_KEY = "test-key";
process.env.OC_SECRET_KEY = "test-secret";

const { evaluate } = await import("../lib/verdict");
const { PRESETS, resolvePolicy } = await import("../lib/policy");
const { usdToRaw } = await import("../lib/quote");
const { makeReceipt, verifyReceipt } = await import("../lib/receipt");

// ---------- Part 1: pure logic
const snap = (over: any = {}) => ({
  tokenPrice: 100, referencePrice: 100, priceAgeSec: 5,
  market: { openState: true, marketStatus: "regular", reasonCode: null, reasonMsg: null, nextOpenTime: null, nextCloseTime: 1 },
  trust: { underlyingFullName: "X", tokenToShareRatio: "1", dailyAttestation: true, monthlyAttestation: true, collateralReport: null },
  ...over,
});
const stats = (over: any = {}) => ({ priceChange1H: 0, priceChange4H: 0.2, priceChange24H: 0.5, volume24H: 500000, liquidity: 900000, holders: 1000, high24H: 101, low24H: 99, txs24H: 400, ...over });
const quote = (over: any = {}) => ({ routes: 2, vendor: "PcsXRfq", executionMode: "RFQ", priceImpactPct: -0.05, tradeFeeUsd: 0.1, tokensOut: 0.05, execPrice: 100.1, isHoneyPot: false, approveTarget: "0xabc", quoteId: "q", ...over });
const approve = (over: any = {}) => ({ simStatus: "SUCCESS", failReason: null, spender: "0xabc", spenderMatchesQuote: true, ...over });
const wallet = (over: any = {}) => ({ usdt: 100, native: 0.01, nativeSymbol: "BNB", ...over });
const base = { usd: 5, platform: "ondo", snap: snap(), stats: stats(), wallet: wallet(), quote: quote(), approve: approve() };
const run = (over: any = {}, p = PRESETS.balanced) => evaluate({ ...base, ...over } as any, p);
const closed = { openState: false, marketStatus: "closed", reasonCode: "MARKET_CLOSED", reasonMsg: "Weekend", nextOpenTime: 1779111060000, nextCloseTime: null };

assert.equal(usdToRaw(5), "5000000000000000000");
assert.equal(usdToRaw(0.5), "500000000000000000");
assert.equal(run().verdict, "GO");
assert.equal(run({ snap: snap({ market: closed }) }).verdict, "CAUTION");
assert.equal(run({ snap: snap({ market: closed }) }, PRESETS.cautious).verdict, "BLOCK");
assert.equal(run({ snap: snap({ market: closed }) }, PRESETS.permissive).verdict, "GO");
assert.equal(run({ snap: snap({ market: { ...closed, reasonCode: "ASSET_PAUSED", reasonMsg: "stock_split" } }) }).verdict, "BLOCK");
assert.equal(run({ snap: snap({ market: { ...closed, openState: true, marketStatus: "regular", reasonCode: "ASSET_LIMITED", reasonMsg: "earnings" } }) }).verdict, "CAUTION");
// unanchored drift only matters while closed
assert.equal(run({ snap: snap({ market: closed }), stats: stats({ priceChange4H: 5 }) }, PRESETS.permissive).verdict, "CAUTION");
assert.equal(run({ stats: stats({ priceChange4H: 9 }) }).verdict, "GO");
assert.equal(run({ snap: snap({ tokenPrice: 103 }) }).verdict, "BLOCK");
assert.equal(run({ stats: stats({ volume24H: 20 }) }).verdict, "BLOCK"); // $5 is 25% of 24h volume
assert.equal(run({ quote: null, approve: null, quoteError: "no routes" }).verdict, "BLOCK");
assert.equal(run({ quote: quote({ priceImpactPct: -4 }) }).verdict, "BLOCK");
assert.equal(run({ approve: approve({ spenderMatchesQuote: false, spender: "0xevil" }) }).verdict, "BLOCK");
assert.equal(run({ quote: quote({ isHoneyPot: true }) }).verdict, "BLOCK");
assert.equal(run({ wallet: wallet({ usdt: 1 }) }).verdict, "BLOCK");
assert.equal(run({ wallet: wallet({ native: 0 }) }).verdict, "CAUTION");
assert.equal(run({ usd: 5000 }).verdict, "BLOCK"); // above balanced maxUsd
assert.equal(evaluate({ ...base, platform: "bstock" } as any, resolvePolicy({ allowedPlatforms: ["ondo"] })).verdict, "BLOCK");
assert.throws(() => resolvePolicy("nope"));

// receipts: tamper-evident
const rc = makeReceipt({ a: 1, b: { y: 2, x: 1 } });
assert.equal(verifyReceipt(rc).valid, true);
assert.equal(makeReceipt({ b: { x: 1, y: 2 }, a: 1 }).hash, rc.hash); // key order does not matter
assert.equal(verifyReceipt({ ...rc, body: { a: 2, b: { y: 2, x: 1 } } }).valid, false);
console.log("part 1 ok: verdict, policy, receipt logic");

// ---------- Part 2: whole pipeline against a stubbed API
const TOKEN = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";
const paths: string[] = [];
globalThis.fetch = (async (url: string, init: any) => {
  const u = new URL(url);
  const p = u.pathname.replace("/build", "");
  paths.push(`${init?.method ?? "GET"} ${p}`);
  const ok = (data: any) => ({ status: 200, ok: true, headers: new Headers(), json: async () => ({ code: 0, msg: "success", data }) });
  switch (p) {
    case "/api/v1/dex/market/rwa/search":
      return ok([{ ticker: "NVDA", companyName: "NVIDIA", assets: [
        { platformId: "ondo", binanceChainId: "56", tokenContractAddress: TOKEN, tokenSymbol: "NVDAon", assetType: 1 },
        { platformId: "bstock", binanceChainId: "56", tokenContractAddress: "0x3333333333333333333333333333333333333333", tokenSymbol: "NVDAb", assetType: 1 },
      ] }]);
    case "/api/v1/dex/market/rwa/price": return ok([{ tokenPrice: "100", referencePrice: "99.9", tokenPriceUpdatedAt: Date.now() - 4000 }]);
    case "/api/v1/dex/market/rwa/underlying-market": return ok({ statusInfo: { openState: false, marketStatus: "closed", reasonCode: "MARKET_CLOSED", reasonMsg: "Weekend", nextOpenTime: 1779111060000 } });
    case "/api/v1/dex/market/rwa/underlying-profile": return ok({ underlyingFullName: "NVIDIA", tokenToShareRatio: "1", protections: { dailyAttestationReport: { supported: true } } });
    case "/api/v1/dex/market/price-info": return ok([{ priceChange1H: "0.1", priceChange4H: "0.3", priceChange24H: "0.4", volume24H: "250000", liquidity: "800000", holders: 900, maxPrice: "101", minPrice: "99", txs24H: 300 }]);
    case "/api/v1/dex/market/candles": return ok([[100, 101, 99, 100.5, 10, 2000, 3], [100.5, 102, 100, 101, 12, 1000, 4]]);
    case "/api/v1/dex/balance/token-balances-by-address": return ok([{ tokenAssets: [
      { tokenContractAddress: "0x55d398326f99059ff775485246999027b3197955", symbol: "USDT", balance: "42" },
      { tokenContractAddress: "", symbol: "BNB", balance: "0.02" } ] }]);
    case "/api/v1/dex/aggregator/quote": {
      const bs = u.searchParams.get("toTokenAddress") !== TOKEN;
      return ok([{ quoteId: "q1", vendorName: "PcsXRfq", executionMode: "RFQ", isBest: true, toTokenAmount: String(bs ? 49.0e15 : 50.0e15), tradeFee: "0.05", priceImpactPercent: "-0.02", approveTarget: "0xc67879F4065d3B9fe1C09EE990B891Aa8E3a4c2f",
        fromToken: { decimal: "18" }, toToken: { decimal: "18", isHoneyPot: false } }]);
    }
    case "/api/v1/dex/aggregator/approve-transaction": return ok([{ data: "0x095ea7b3", dexContractAddress: "0xc67879F4065d3B9fe1C09EE990B891Aa8E3a4c2f" }]);
    case "/api/v1/dex/pre-transaction/simulate": return ok({ status: "SUCCESS", failReason: null, allowanceChanges: [{ tokenAddress: "0x55d398326f99059fF775485246999027B3197955", spender: "0xc67879F4065d3B9fe1C09EE990B891Aa8E3a4c2f" }] });
  }
  return { status: 404, ok: false, headers: new Headers(), json: async () => ({ code: 40404, msg: "stub: " + p }) };
}) as any;

const { preflight, compareVenues } = await import("../lib/preflight");
const r = await preflight({ ticker: "nvda", usd: 5, wallet: WALLET, policy: "balanced" });
assert.equal(r.verdict, "CAUTION"); // market closed under balanced = caution, everything else passes
assert.ok(r.reasons.some((x) => x.code === "UNDERLYING_CLOSED"));
assert.ok(r.reasons.some((x) => x.code === "SPENDER_OK"));
assert.ok(r.reasons.some((x) => x.code === "FUNDS_OK"));
assert.equal(r.evidence.sparkline.length, 2);
assert.deepEqual(r.evidence.sparkline, [101, 100.5]); // sorted ascending by timestamp
assert.equal(r.apiCalls, 9);
assert.equal(verifyReceipt(r.receipt).valid, true);
const tampered = JSON.parse(JSON.stringify(r.receipt)); tampered.body.verdict = "GO";
assert.equal(verifyReceipt(tampered).valid, false);
assert.equal((await preflight({ ticker: "NVDA", usd: 5, wallet: WALLET, policy: "cautious" })).verdict, "BLOCK");

const c = await compareVenues({ ticker: "NVDA", usd: 5, wallet: WALLET, policy: "permissive" });
assert.equal(c.venues.length, 2);
assert.equal(c.recommendation.platform, "ondo"); // stub: ondo returns more tokens for $5, so its fill price is lower
console.log("distinct endpoints hit:", [...new Set(paths.map((s) => s.split("?")[0]))].length);
console.log([...new Set(paths)].sort().join("\n"));
console.log("part 2 ok: full pipeline, graceful flow, receipts");
