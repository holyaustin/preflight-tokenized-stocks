// Reads the user's wallet ADDRESS from an injected wallet (MetaMask and others) using the standard EIP-1193 request.
// It only asks the wallet to share the address. It never asks for a signature, a transaction or a network switch.
// An address is the same on every EVM chain, so BNB Smart Chain needs no switching either.

export interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
  providers?: Eip1193[];
}

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

// When several wallet extensions are installed they can share one window.ethereum with a providers list.
export function pickProvider(w: { ethereum?: Eip1193 }): Eip1193 | null {
  const e = w.ethereum;
  if (!e) return null;
  if (Array.isArray(e.providers) && e.providers.length) return e.providers.find((p) => p.isMetaMask) ?? e.providers[0];
  return e;
}

export async function requestAddress(p: Eip1193): Promise<string> {
  let accounts: unknown;
  try {
    // Shows the wallet's "connect" prompt (share your address). Nothing is signed.
    accounts = await p.request({ method: "eth_requestAccounts" });
  } catch (e: any) {
    if (e?.code === 4001) throw new Error("You declined the request in your wallet. Nothing was shared.");
    if (e?.code === -32002) throw new Error("A wallet request is already open. Open your wallet window and respond to it.");
    throw new Error(e?.message ?? "The wallet did not respond.");
  }
  const first = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof first !== "string" || !ADDRESS.test(first)) throw new Error("The wallet did not return an account. Unlock it and try again.");
  return first;
}
