// A policy is "guardrails as code". An agent (or you) chooses one, and the verdict is judged against it.
// All numbers below are PreFlight defaults, NOT Binance API facts. Calibrate them with real readings.
export interface Band {
  caution: number;
  block: number;
}

export interface Policy {
  name: string;
  maxUsd: number;
  closedMarket: "allow" | "caution" | "block";
  spreadPct: Band; // |on-chain price vs reference price|
  driftPct: Band; // |4h price change| while the underlying market is closed ("unanchored drift")
  impactPct: Band; // quote price impact
  execPct: Band; // quoted fill vs on-chain price
  sizeVsVolumePct: Band; // your order as % of the last 24h on-chain volume
  staleSec: number; // price age while the market is open
  attestation: "ignore" | "caution" | "block";
  minGasNative: number; // minimum BNB for gas
  allowedPlatforms?: string[];
}

export const PRESETS: Record<string, Policy> = {
  cautious: {
    name: "cautious",
    maxUsd: 100,
    closedMarket: "block",
    spreadPct: { caution: 0.25, block: 1 },
    driftPct: { caution: 0.5, block: 2 },
    impactPct: { caution: 0.5, block: 2 },
    execPct: { caution: 0.5, block: 2 },
    sizeVsVolumePct: { caution: 1, block: 5 },
    staleSec: 300,
    attestation: "block",
    minGasNative: 0.001,
  },
  balanced: {
    name: "balanced",
    maxUsd: 1000,
    closedMarket: "caution",
    spreadPct: { caution: 0.5, block: 2 },
    driftPct: { caution: 1, block: 4 },
    impactPct: { caution: 1, block: 3 },
    execPct: { caution: 1, block: 3 },
    sizeVsVolumePct: { caution: 2, block: 10 },
    staleSec: 600,
    attestation: "caution",
    minGasNative: 0.0005,
  },
  permissive: {
    name: "permissive",
    maxUsd: 10000,
    closedMarket: "allow",
    spreadPct: { caution: 1, block: 5 },
    driftPct: { caution: 3, block: 10 },
    impactPct: { caution: 2, block: 5 },
    execPct: { caution: 2, block: 5 },
    sizeVsVolumePct: { caution: 5, block: 20 },
    staleSec: 1800,
    attestation: "ignore",
    minGasNative: 0.0002,
  },
};

export function resolvePolicy(p?: string | Partial<Policy>): Policy {
  if (!p) return PRESETS.balanced;
  if (typeof p === "string") {
    const hit = PRESETS[p.toLowerCase()];
    if (!hit) throw new Error(`Unknown policy "${p}". Use one of: ${Object.keys(PRESETS).join(", ")}`);
    return hit;
  }
  return { ...PRESETS.balanced, ...p, name: p.name ?? "custom" };
}
