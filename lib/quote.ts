import { CHAIN, STABLE } from "./config";
import { w3get, w3post } from "./client";
import type { Asset } from "./rwa";

export interface QuoteResult {
  routes: number;
  vendor: string;
  executionMode: string; // "RFQ" for equity/RWA tokens per the Trading API docs
  priceImpactPct: number | null;
  tradeFeeUsd: number | null;
  tokensOut: number;
  execPrice: number; // USD per token implied by the quote
  isHoneyPot: boolean;
  approveTarget: string | null;
  quoteId: string;
}

// USD -> smallest unit of the stablecoin, without floating-point drift (supports 6 decimals of USD).
export function usdToRaw(usd: number, decimals = STABLE.decimals): string {
  if (decimals < 6) throw new Error("unsupported stable decimals");
  return (BigInt(Math.round(usd * 1e6)) * 10n ** BigInt(decimals - 6)).toString();
}

// API 8: GET /api/v1/dex/aggregator/quote  (userWalletAddress is required for RFQ routes = equity/RWA tokens)
export async function quoteBuy(a: Asset, usd: number, wallet: string): Promise<QuoteResult> {
  const routes: any[] = await w3get("/api/v1/dex/aggregator/quote", {
    binanceChainId: CHAIN,
    amount: usdToRaw(usd),
    fromTokenAddress: STABLE.address,
    toTokenAddress: a.tokenContractAddress,
    userWalletAddress: wallet,
  });
  if (!routes?.length) throw new Error("no routes returned");
  const best = routes.find((r) => r.isBest) ?? routes[0];
  if (Number(best.fromToken?.decimal) !== STABLE.decimals) {
    throw new Error(`decimals mismatch: quote says ${best.fromToken?.decimal}, config says ${STABLE.decimals}`);
  }
  const out = Number(best.toTokenAmount) / 10 ** Number(best.toToken.decimal);
  return {
    routes: routes.length,
    vendor: best.vendorName,
    executionMode: best.executionMode,
    priceImpactPct: best.priceImpactPercent == null ? null : Number(best.priceImpactPercent),
    tradeFeeUsd: best.tradeFee == null ? null : Number(best.tradeFee),
    tokensOut: out,
    execPrice: usd / out,
    isHoneyPot: Boolean(best.toToken?.isHoneyPot),
    approveTarget: best.approveTarget ?? null,
    quoteId: best.quoteId,
  };
}

export interface ApproveCheck {
  simStatus: string;
  failReason: string | null;
  spender: string | null;
  spenderMatchesQuote: boolean | null;
}

// API 9: GET /api/v1/dex/aggregator/approve-transaction  (vendor is REQUIRED for equity/RWA per docs)
// API 10: POST /api/v1/dex/pre-transaction/simulate      (dry-run the approval, read who becomes the spender)
export async function checkApprove(
  usd: number,
  wallet: string,
  vendor: string,
  quoteApproveTarget: string | null
): Promise<ApproveCheck> {
  const ap: any[] = await w3get("/api/v1/dex/aggregator/approve-transaction", {
    binanceChainId: CHAIN,
    tokenContractAddress: STABLE.address,
    approveAmount: usdToRaw(usd),
    vendor,
  });
  const tx = ap?.[0];
  if (!tx?.data) throw new Error("approve-transaction returned no calldata");
  const sim: any = await w3post("/api/v1/dex/pre-transaction/simulate", {
    binanceChainId: CHAIN,
    evmTx: { from: wallet, to: STABLE.address, value: "0", data: tx.data },
  });
  const ch = (sim.allowanceChanges ?? []).find(
    (c: any) => String(c.tokenAddress).toLowerCase() === STABLE.address.toLowerCase()
  );
  const spender: string | null = ch?.spender ?? tx.dexContractAddress ?? null;
  return {
    simStatus: sim.status,
    failReason: sim.failReason ?? null,
    spender,
    spenderMatchesQuote: spender && quoteApproveTarget ? spender.toLowerCase() === quoteApproveTarget.toLowerCase() : null,
  };
}

export interface DeepSim {
  available: boolean;
  note: string;
  status?: string;
  balanceChanges?: unknown;
}

// API 11 (optional): GET /api/v1/dex/aggregator/quote-and-swap (Flash, vendor LiquidMesh, enableRFQ=false).
// If an AMM route exists it returns a plain SWAP tx we can simulate. If not, the token is RFQ-only.
export async function deepSimulate(a: Asset, usd: number, wallet: string): Promise<DeepSim> {
  try {
    const r: any = await w3get("/api/v1/dex/aggregator/quote-and-swap", {
      binanceChainId: CHAIN,
      amount: usdToRaw(usd),
      fromTokenAddress: STABLE.address,
      toTokenAddress: a.tokenContractAddress,
      userWalletAddress: wallet,
      vendor: "LiquidMesh",
      slippagePercent: "0.5",
      enableRFQ: "false",
    });
    if (!r?.tx?.data) return { available: false, note: "Flash API returned no tx" };
    const sim: any = await w3post("/api/v1/dex/pre-transaction/simulate", {
      binanceChainId: CHAIN,
      evmTx: { from: wallet, to: r.tx.to, value: r.tx.value ?? "0", data: r.tx.data },
    });
    return { available: true, note: "AMM swap simulated", status: sim.status, balanceChanges: sim.balanceChanges };
  } catch (e: any) {
    return { available: false, note: `no AMM route / not simulatable: ${e.message}` };
  }
}
