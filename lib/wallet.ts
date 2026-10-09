import { CHAIN, STABLE, NATIVE_ADDRESS } from "./config";
import { w3post } from "./client";

export interface WalletReadiness {
  usdt: number;
  native: number;
  nativeSymbol: string;
}

// API 7: POST /api/v1/dex/balance/token-balances-by-address
// Body per docs: { address, tokenContractAddresses: [{ binanceChainId, tokenContractAddress }] }
// An empty tokenContractAddress means the chain's native asset (BNB).
export async function walletReadiness(address: string): Promise<WalletReadiness> {
  const data: any[] = await w3post("/api/v1/dex/balance/token-balances-by-address", {
    address,
    tokenContractAddresses: [
      { binanceChainId: CHAIN, tokenContractAddress: STABLE.address },
      { binanceChainId: CHAIN, tokenContractAddress: NATIVE_ADDRESS },
    ],
  });
  const assets: any[] = (data ?? []).flatMap((d) => d.tokenAssets ?? []);
  const usdt = assets.find((a) => String(a.tokenContractAddress).toLowerCase() === STABLE.address.toLowerCase());
  const native = assets.find((a) => String(a.tokenContractAddress) === "");
  // A zero balance may be omitted from the response; treat "missing" as 0.
  return {
    usdt: usdt ? Number(usdt.balance) : 0,
    native: native ? Number(native.balance) : 0,
    nativeSymbol: native?.symbol ?? "BNB",
  };
}
