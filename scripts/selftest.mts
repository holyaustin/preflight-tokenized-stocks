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
const minRes = run({ usd: 0.5, quote: null, approve: null, quoteError: "40375: Minimum order amount is 5 USD." });
assert.equal(minRes.verdict, "BLOCK");
assert.ok(minRes.reasons.some((x) => x.code === "BELOW_VENUE_MINIMUM" && x.message.includes("$5")));
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
import { TOKEN, WALLET, paths, installStub } from "./stub-api.mts";
installStub();

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
