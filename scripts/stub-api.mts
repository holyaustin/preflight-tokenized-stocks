// Stubbed Binance Web3 API (response shapes copied from the docs' examples). Used by tests only.
export const TOKEN = "0x1111111111111111111111111111111111111111";
export const WALLET = "0x2222222222222222222222222222222222222222";
export const paths: string[] = [];
export function installStub() {
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
}
