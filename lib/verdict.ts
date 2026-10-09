import type { Snapshot } from "./rwa";
import type { TokenStats } from "./market";
import type { WalletReadiness } from "./wallet";
import type { QuoteResult, ApproveCheck } from "./quote";
import type { Policy, Band } from "./policy";

export type Level = "GO" | "CAUTION" | "BLOCK";
export type Category = "market" | "price" | "liquidity" | "execution" | "wallet" | "security";
export interface Reason {
  level: "info" | "caution" | "block";
  category: Category;
  code: string;
  message: string;
}

const HARD_STOP = new Set(["ASSET_PAUSED", "MARKET_PAUSED", "MARKET_MAINTENANCE", "UNSUPPORTED"]);

export interface Inputs {
  usd: number;
  platform: string;
  snap: Snapshot;
  stats: TokenStats | null;
  statsError?: string;
  wallet: WalletReadiness | null;
  walletError?: string;
  quote: QuoteResult | null;
  quoteError?: string;
  approve: ApproveCheck | null;
  approveError?: string;
}

const pct = (a: number, b: number) => ((a - b) / b) * 100;
const band = (v: number, b: Band): Reason["level"] => (Math.abs(v) >= b.block ? "block" : Math.abs(v) >= b.caution ? "caution" : "info");

// Pure and deterministic: same inputs + same policy => same verdict. Every reason cites a number or an API field.
export function evaluate(i: Inputs, policy: Policy): { verdict: Level; reasons: Reason[] } {
  const r: Reason[] = [];
  const add = (level: Reason["level"], category: Category, code: string, message: string) =>
    r.push({ level, category, code, message });
  const { snap, stats, wallet, quote, approve } = i;
  const m = snap.market;

  // ---- Policy limits
  if (i.usd > policy.maxUsd) add("block", "security", "POLICY_MAX_SIZE", `$${i.usd} is above the ${policy.name} policy limit of $${policy.maxUsd}`);
  if (policy.allowedPlatforms && !policy.allowedPlatforms.includes(i.platform)) {
    add("block", "security", "POLICY_PLATFORM", `Platform "${i.platform}" is not allowed by the ${policy.name} policy`);
  }

  // ---- Market status (RWA Data statusInfo)
  if (m.reasonCode && HARD_STOP.has(m.reasonCode)) {
    add("block", "market", m.reasonCode, `Trading restricted: ${m.reasonMsg ?? m.reasonCode}`);
  } else if (m.reasonCode === "ASSET_LIMITED") {
    add("caution", "market", "ASSET_LIMITED", `Asset restricted (${m.reasonMsg ?? "for example an earnings window"})`);
  } else if (!m.openState) {
    const next = m.nextOpenTime ? ` Next open ${new Date(m.nextOpenTime).toISOString()}.` : "";
    const lvl = policy.closedMarket === "allow" ? "info" : policy.closedMarket;
    add(lvl, "market", "UNDERLYING_CLOSED", `Underlying market is ${m.marketStatus}: on-chain trading continues without a live equity price.${next}`);
  } else {
    add("info", "market", "MARKET_OPEN", `Underlying market status: ${m.marketStatus}`);
  }

  // ---- On-chain price vs reference price
  const spread = pct(snap.tokenPrice, snap.referencePrice);
  if (!Number.isFinite(spread)) add("caution", "price", "PRICE_MISSING", "Price data incomplete");
  else add(band(spread, policy.spreadPct), "price", band(spread, policy.spreadPct) === "info" ? "SPREAD_OK" : "SPREAD_WIDE", `On-chain vs reference price differ by ${spread.toFixed(2)}%`);

  if (snap.priceAgeSec != null && m.openState && snap.priceAgeSec > policy.staleSec) {
    add("caution", "price", "PRICE_STALE", `Price last updated ${snap.priceAgeSec}s ago while the market is open`);
  }

  // ---- Unanchored drift: how far the token moved on-chain while no equity price exists
  if (!m.openState && stats?.priceChange4H != null) {
    const lvl = band(stats.priceChange4H, policy.driftPct);
    add(lvl, "price", lvl === "info" ? "DRIFT_OK" : "CLOSED_DRIFT", `Token moved ${stats.priceChange4H}% in the last 4h while the equity market was closed`);
  }

  // ---- Issuer transparency
  if (snap.trust.dailyAttestation === false && snap.trust.monthlyAttestation === false) {
    if (policy.attestation !== "ignore") add(policy.attestation, "security", "NO_ATTESTATION", "No daily or monthly attestation report is listed for this token");
  } else if (snap.trust.dailyAttestation || snap.trust.monthlyAttestation) {
    add("info", "security", "ATTESTATION", "Attestation report available");
  }

  // ---- Liquidity (Market API price-info)
  if (stats?.volume24H != null) {
    if (stats.volume24H <= 0) {
      add("caution", "liquidity", "NO_VOLUME_24H", "No on-chain volume in the last 24h");
    } else {
      const share = (i.usd / stats.volume24H) * 100;
      const lvl = band(share, policy.sizeVsVolumePct);
      add(lvl, "liquidity", lvl === "info" ? "SIZE_OK" : "SIZE_LARGE", `Your order is ${share.toFixed(2)}% of the last 24h on-chain volume ($${Math.round(stats.volume24H)})`);
    }
  } else if (i.statsError) {
    add("caution", "liquidity", "STATS_UNAVAILABLE", `Liquidity data unavailable: ${i.statsError}`);
  }

  // ---- Real execution cost (Trading API quote)
  if (!quote) {
    add("block", "execution", "NO_QUOTE", `No executable quote: ${i.quoteError ?? "unknown error"}`);
  } else {
    if (quote.isHoneyPot) add("block", "security", "HONEYPOT", "Quote flags the token as a honeypot");
    if (quote.priceImpactPct == null) add("caution", "execution", "IMPACT_UNKNOWN", "Vendor did not report price impact");
    else {
      const lvl = band(quote.priceImpactPct, policy.impactPct);
      add(lvl, "execution", lvl === "info" ? "IMPACT_OK" : "IMPACT_HIGH", `Price impact ${quote.priceImpactPct}%`);
    }
    const exec = pct(quote.execPrice, snap.tokenPrice);
    const lvl = band(exec, policy.execPct);
    add(lvl, "execution", lvl === "info" ? "EXEC_OK" : "EXEC_VS_PRICE", `Quoted fill is ${exec.toFixed(2)}% from the on-chain price`);
    add("info", "execution", "ROUTE", `${quote.vendor} via ${quote.executionMode} (${quote.routes} route${quote.routes > 1 ? "s" : ""})`);
  }

  // ---- Approval dry-run + spender identity (Transaction API simulate)
  if (approve) {
    if (approve.simStatus !== "SUCCESS") add("block", "security", "APPROVE_SIM_FAILED", `Approval simulation ${approve.simStatus}: ${approve.failReason ?? "no reason given"}`);
    else if (approve.spenderMatchesQuote === false) add("block", "security", "SPENDER_MISMATCH", `Approval spender ${approve.spender} differs from the quote's approve target`);
    else if (approve.spenderMatchesQuote === true) add("info", "security", "SPENDER_OK", `Approval spender matches the quote (${approve.spender})`);
    else add("caution", "security", "SPENDER_UNVERIFIED", "Could not cross-check the approval spender against the quote");
  } else if (i.approveError) {
    add("caution", "security", "APPROVE_CHECK_ERROR", `Approval check failed: ${i.approveError}`);
  }

  // ---- Wallet readiness (Wallet API)
  if (wallet) {
    if (wallet.usdt < i.usd) add("block", "wallet", "INSUFFICIENT_USDT", `Wallet holds ${wallet.usdt} USDT, trade needs ${i.usd}`);
    else add("info", "wallet", "FUNDS_OK", `Wallet holds ${wallet.usdt} USDT`);
    if (wallet.native < policy.minGasNative) add("caution", "wallet", "LOW_GAS", `Only ${wallet.native} ${wallet.nativeSymbol} for gas (policy minimum ${policy.minGasNative})`);
  } else if (i.walletError) {
    add("caution", "wallet", "WALLET_CHECK_ERROR", `Wallet check failed: ${i.walletError}`);
  }

  const verdict: Level = r.some((x) => x.level === "block") ? "BLOCK" : r.some((x) => x.level === "caution") ? "CAUTION" : "GO";
  return { verdict, reasons: r };
}
