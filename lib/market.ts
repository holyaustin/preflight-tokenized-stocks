import { CHAIN } from "./config";
import { W3Error, w3get, w3post } from "./client";

export interface TokenStats {
  priceChange1H: number | null;
  priceChange4H: number | null;
  priceChange24H: number | null;
  volume24H: number | null;
  liquidity: number | null;
  holders: number | null;
  high24H: number | null;
  low24H: number | null;
  txs24H: number | null;
}

const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

// API 5: POST /api/v1/dex/market/price-info
// The docs describe the request body as an object, but the curl example sends an ARRAY of objects.
// We send the array first (the example); if the API rejects it with 40001 we retry with the object.
export async function tokenStats(addr: string): Promise<TokenStats> {
  const item = { binanceChainId: CHAIN, tokenContractAddress: addr.toLowerCase() };
  let data: any;
  try {
    data = await w3post("/api/v1/dex/market/price-info", [item]);
  } catch (e) {
    if (e instanceof W3Error && String(e.code) === "40001") data = await w3post("/api/v1/dex/market/price-info", item);
    else throw e;
  }
  const d = Array.isArray(data) ? data[0] : data;
  return {
    priceChange1H: num(d?.priceChange1H),
    priceChange4H: num(d?.priceChange4H),
    priceChange24H: num(d?.priceChange24H),
    volume24H: num(d?.volume24H),
    liquidity: num(d?.liquidity),
    holders: num(d?.holders),
    high24H: num(d?.maxPrice),
    low24H: num(d?.minPrice),
    txs24H: num(d?.txs24H),
  };
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

// API 6: GET /api/v1/dex/market/candles
// Row order per docs: [open, high, low, close, volume, timestamp(ms), tradeCount]
export async function hourlyCandles(addr: string, limit = 48): Promise<Candle[]> {
  const rows: any[] = await w3get("/api/v1/dex/market/candles", {
    binanceChainId: CHAIN,
    tokenContractAddress: addr.toLowerCase(),
    bar: "1h",
    limit: String(limit),
  });
  return rows
    .map((r) => ({ o: Number(r[0]), h: Number(r[1]), l: Number(r[2]), c: Number(r[3]), t: Number(r[5]) }))
    .filter((c) => Number.isFinite(c.c) && Number.isFinite(c.t))
    .sort((a, b) => a.t - b.t);
}
