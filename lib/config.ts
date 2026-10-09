// BSC chain id as used by the Binance Web3 API ("56" = BSC, per the API docs).
export const CHAIN = "56";

// Stablecoin used as the "from" leg when pricing a BUY.
// Address + 18 decimals come from the Trading API docs' response example for USDT on BSC.
// quoteBuy() re-checks the decimals on every live quote and fails loudly on a mismatch.
export const STABLE = {
  symbol: "USDT",
  address: "0x55d398326f99059fF775485246999027B3197955",
  decimals: 18,
};

// Wallet API docs: pass an empty string as tokenContractAddress to get the chain's native asset (BNB on BSC).
export const NATIVE_ADDRESS = "";

export const PREFLIGHT_VERSION = "2.0.0";
