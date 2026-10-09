import { CHAIN } from "./config";
import { cached, w3get } from "./client";

export interface Asset {
  platformId: string; // docs list: "ondo" | "bstock"
  binanceChainId: string;
  tokenContractAddress: string;
  tokenSymbol: string;
  assetType: number; // 1=Stock, 2=Pre-IPO, 3=ETF
}

export interface Resolved {
  ticker: string;
  companyName: string;
  assets: Asset[]; // BSC only
}

// API 1: GET /api/v1/dex/market/rwa/search?keyword=
export async function resolveAsset(ticker: string): Promise<Resolved | null> {
  const t = ticker.trim().toUpperCase();
  const data: any[] = await cached(`search:${t}`, 60_000, () =>
    w3get("/api/v1/dex/market/rwa/search", { keyword: t })
  );
  const hit = data.find((d) => String(d.ticker).toUpperCase() === t);
  if (!hit) return null;
  const assets: Asset[] = (hit.assets ?? []).filter((a: Asset) => a.binanceChainId === CHAIN);
  return { ticker: hit.ticker, companyName: hit.companyName, assets };
}

export interface Snapshot {
  tokenPrice: number;
  referencePrice: number;
  priceAgeSec: number | null;
  market: {
    openState: boolean;
    marketStatus: string;
    reasonCode: string | null;
    reasonMsg: string | null;
    nextOpenTime: number | null;
    nextCloseTime: number | null;
  };
  trust: {
    underlyingFullName: string | null;
    tokenToShareRatio: string | null;
    dailyAttestation: boolean | null;
    monthlyAttestation: boolean | null;
    collateralReport: boolean | null;
  };
}

// APIs 2-4:
//   GET /api/v1/dex/market/rwa/price               (on-chain vs reference price + freshness)
//   GET /api/v1/dex/market/rwa/underlying-market   (market status, reason codes, next open)
//   GET /api/v1/dex/market/rwa/underlying-profile  (share ratio + attestation/collateral reports)
export async function snapshot(a: Asset): Promise<Snapshot> {
  const addr = a.tokenContractAddress;
  const [p]: any[] = await w3get("/api/v1/dex/market/rwa/price", {
    binanceChainId: CHAIN,
    tokenContractAddresses: addr,
  });
  const um: any = await w3get("/api/v1/dex/market/rwa/underlying-market", {
    binanceChainId: CHAIN,
    tokenContractAddress: addr,
  });
  const prof: any = await cached(`profile:${addr}`, 5 * 60_000, () =>
    w3get("/api/v1/dex/market/rwa/underlying-profile", {
      binanceChainId: CHAIN,
      tokenContractAddress: addr,
    })
  );
  const prot = prof?.protections ?? {};
  const flag = (k: string) => (prot[k] ? Boolean(prot[k].supported) : null);
  const s = um?.statusInfo ?? {};
  return {
    tokenPrice: Number(p?.tokenPrice),
    referencePrice: Number(p?.referencePrice),
    priceAgeSec: p?.tokenPriceUpdatedAt ? Math.round((Date.now() - Number(p.tokenPriceUpdatedAt)) / 1000) : null,
    market: {
      openState: Boolean(s.openState),
      marketStatus: s.marketStatus ?? "unknown",
      reasonCode: s.reasonCode ?? null,
      reasonMsg: s.reasonMsg ?? null,
      nextOpenTime: s.nextOpenTime ?? null,
      nextCloseTime: s.nextCloseTime ?? null,
    },
    trust: {
      underlyingFullName: prof?.underlyingFullName ?? null,
      tokenToShareRatio: prof?.tokenToShareRatio ?? null,
      dailyAttestation: flag("dailyAttestationReport"),
      monthlyAttestation: flag("monthlyAttestationReport"),
      collateralReport: flag("collateralReport"),
    },
  };
}
