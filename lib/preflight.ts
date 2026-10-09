import { PREFLIGHT_VERSION } from "./config";
import { resolveAsset, snapshot, type Asset, type Snapshot } from "./rwa";
import { tokenStats, hourlyCandles, type TokenStats } from "./market";
import { walletReadiness, type WalletReadiness } from "./wallet";
import { quoteBuy, checkApprove, deepSimulate, type QuoteResult, type ApproveCheck, type DeepSim } from "./quote";
import { evaluate, type Level, type Reason } from "./verdict";
import { resolvePolicy, type Policy } from "./policy";
import { makeReceipt, type Receipt } from "./receipt";
import { withTrace } from "./client";

export interface PreflightArgs {
  ticker: string;
  usd: number;
  wallet: string;
  platform?: string;
  policy?: string | Partial<Policy>;
  deep?: boolean;
}

export interface PreflightResult {
  ticker: string;
  platform: string;
  token: string;
  contract: string;
  usd: number;
  policy: string;
  verdict: Level;
  reasons: Reason[];
  evidence: {
    snapshot: Snapshot;
    stats: TokenStats | null;
    sparkline: number[];
    wallet: WalletReadiness | null;
    quote: QuoteResult | null;
    approve: ApproveCheck | null;
    deepSimulation?: DeepSim;
  };
  apiCalls: number;
  receipt: Receipt;
  checkedAt: string;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);

// One venue (one token on one platform). Only the RWA snapshot is mandatory; every other
// source degrades gracefully into a visible caution instead of crashing the whole check.
async function runVenue(args: PreflightArgs, a: Asset): Promise<PreflightResult> {
  const policy = resolvePolicy(args.policy);
  const { result, calls } = await withTrace(async () => {
    const snap = await snapshot(a);

    let stats: TokenStats | null = null;
    let statsError: string | undefined;
    try { stats = await tokenStats(a.tokenContractAddress); } catch (e) { statsError = msg(e); }

    let sparkline: number[] = [];
    try { sparkline = (await hourlyCandles(a.tokenContractAddress)).map((c) => c.c); } catch { /* sparkline is cosmetic */ }

    let wallet: WalletReadiness | null = null;
    let walletError: string | undefined;
    try { wallet = await walletReadiness(args.wallet); } catch (e) { walletError = msg(e); }

    let quote: QuoteResult | null = null;
    let quoteError: string | undefined;
    try { quote = await quoteBuy(a, args.usd, args.wallet); } catch (e) { quoteError = msg(e); }

    let approve: ApproveCheck | null = null;
    let approveError: string | undefined;
    if (quote) {
      try { approve = await checkApprove(args.usd, args.wallet, quote.vendor, quote.approveTarget); } catch (e) { approveError = msg(e); }
    }

    const { verdict, reasons } = evaluate(
      { usd: args.usd, platform: a.platformId, snap, stats, statsError, wallet, walletError, quote, quoteError, approve, approveError },
      policy
    );
    const deepSimulation = args.deep ? await deepSimulate(a, args.usd, args.wallet) : undefined;
    return { snap, stats, sparkline, wallet, quote, approve, deepSimulation, verdict, reasons };
  });

  const checkedAt = new Date().toISOString();
  const evidence = { snapshot: result.snap, stats: result.stats, sparkline: result.sparkline, wallet: result.wallet, quote: result.quote, approve: result.approve, deepSimulation: result.deepSimulation };
  const receipt = makeReceipt({
    version: PREFLIGHT_VERSION,
    checkedAt,
    ticker: args.ticker.toUpperCase(),
    platform: a.platformId,
    contract: a.tokenContractAddress,
    usd: args.usd,
    wallet: args.wallet,
    policy,
    verdict: result.verdict,
    reasons: result.reasons,
    evidence,
    apiCalls: calls,
  });
  return {
    ticker: args.ticker.toUpperCase(),
    platform: a.platformId,
    token: a.tokenSymbol,
    contract: a.tokenContractAddress,
    usd: args.usd,
    policy: policy.name,
    verdict: result.verdict,
    reasons: result.reasons,
    evidence,
    apiCalls: calls.length,
    receipt,
    checkedAt,
  };
}

export async function preflight(args: PreflightArgs): Promise<PreflightResult> {
  const res = await resolveAsset(args.ticker);
  if (!res || res.assets.length === 0) throw new Error(`No tokenized asset found on BSC for "${args.ticker}"`);
  const a = args.platform ? res.assets.find((x) => x.platformId === args.platform) : res.assets[0];
  if (!a) throw new Error(`"${args.ticker}" is not on platform "${args.platform}" (available: ${res.assets.map((x) => x.platformId).join(", ")})`);
  return runVenue(args, a);
}

// Same ticker on every platform that lists it on BSC (Ondo vs bStocks), judged by the same policy,
// then ranked: among venues that are not BLOCKed, the lowest quoted fill price wins.
export async function compareVenues(args: Omit<PreflightArgs, "platform" | "deep">) {
  const res = await resolveAsset(args.ticker);
  if (!res || res.assets.length === 0) throw new Error(`No tokenized asset found on BSC for "${args.ticker}"`);
  const venues: PreflightResult[] = [];
  for (const a of res.assets) venues.push(await runVenue(args, a));
  const ok = venues.filter((v) => v.verdict !== "BLOCK" && v.evidence.quote);
  ok.sort((x, y) => x.evidence.quote!.execPrice - y.evidence.quote!.execPrice);
  const best = ok[0];
  const recommendation = best
    ? {
        platform: best.platform,
        verdict: best.verdict,
        reason: `Lowest quoted fill ($${best.evidence.quote!.execPrice.toFixed(4)} per token) among venues that passed the "${best.policy}" policy`,
      }
    : { platform: null, verdict: "BLOCK" as Level, reason: "No venue passed the policy" };
  return { ticker: res.ticker, company: res.companyName, recommendation, venues };
}
