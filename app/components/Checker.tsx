"use client";

import { useEffect, useState } from "react";
import type { PreflightResult } from "@/lib/preflight";
import Result from "./Result";
import { pickProvider, requestAddress, type Eip1193 } from "@/lib/metamask";

type Compare = {
  ticker: string;
  company: string;
  recommendation: { platform: string | null; verdict: string; reason: string };
  venues: PreflightResult[];
};

const POLICIES = [
  { id: "cautious", name: "Cautious", note: "Blocks closed markets" },
  { id: "balanced", name: "Balanced", note: "Flags closed markets" },
  { id: "permissive", name: "Permissive", note: "Allows closed markets" },
];
const SAMPLES = ["NVDA", "TSLA", "AAPL", "AMD"];
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

declare global {
  interface Window { ethereum?: Eip1193 }
}

export default function Checker() {
  const [ticker, setTicker] = useState("NVDA");
  const [usd, setUsd] = useState("5");
  const [policy, setPolicy] = useState("balanced");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [single, setSingle] = useState<PreflightResult | null>(null);
  const [cmp, setCmp] = useState<Compare | null>(null);
  const [provider, setProvider] = useState<Eip1193 | null>(null);
  const [walletMsg, setWalletMsg] = useState("");

  // Detect an injected wallet after the page loads (window does not exist on the server).
  useEffect(() => { setProvider(pickProvider(window)); }, []);

  async function useMyAddress() {
    if (!provider) return;
    setWalletMsg("");
    try { setWallet(await requestAddress(provider)); }
    catch (e: any) { setWalletMsg(e.message); }
  }

  async function run(path: "/api/preflight" | "/api/compare") {
    setBusy(true); setError(""); setSingle(null); setCmp(null);
    try {
      const q = new URLSearchParams({ ticker: ticker.trim(), usd, wallet: wallet.trim(), policy });
      const res = await fetch(`${path}?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (path === "/api/compare") setCmp(data); else setSingle(data);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const walletBad = wallet.length > 0 && !ADDRESS.test(wallet.trim());

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">For agents and people</p>
          <h1>Check the trade <em>before</em> you make it.</h1>
          <p className="lede">
            Stocks freeze at Friday&apos;s close. Their tokens on BNB Chain trade all weekend. PreFlight checks the market, price, liquidity,
            wallet and approval first, then gives a clear verdict and a receipt you can verify.
          </p>
          <ul className="stats">
            <li><b>11</b><span>API endpoints</span></li>
            <li><b>3</b><span>risk policies</span></li>
            <li><b>0</b><span>keys held</span></li>
          </ul>
        </div>

        <form className="panel" onSubmit={(e) => { e.preventDefault(); run("/api/preflight"); }} aria-busy={busy}>
          <div className="field">
            <label htmlFor="ticker">Ticker</label>
            <input id="ticker" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} maxLength={10} required autoComplete="off" autoCapitalize="characters" />
            <div className="chips" aria-label="Sample tickers">
              {SAMPLES.map((s) => (
                <button type="button" key={s} className={`chip ${ticker === s ? "on" : ""}`} onClick={() => setTicker(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="usd">Amount (USD)</label>
            <input id="usd" type="number" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} min="0.01" step="any" required />
            <small className="muted">Each venue sets a minimum order.</small>
          </div>
          <fieldset className="field">
            <legend>Risk policy</legend>
            <div className="seg">
              {POLICIES.map((p) => (
                <label key={p.id} className="seg-item">
                  <input type="radio" name="policy" value={p.id} checked={policy === p.id} onChange={() => setPolicy(p.id)} />
                  <span><b>{p.name}</b><small>{p.note}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="wallet">Your BSC address</label>
            <input id="wallet" className="mono" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x and 40 characters" required autoComplete="off" spellCheck={false} aria-invalid={walletBad} aria-describedby="wallet-hint" />
            <div className="wallet-row">
              <small id="wallet-hint" className={walletBad ? "bad" : "muted"}>{walletBad ? "That does not look like a BSC address." : "Read-only. No private key needed."}</small>
              {provider && (
                <button type="button" className="btn ghost small" onClick={useMyAddress}>
                  {provider.isMetaMask ? "Use my MetaMask address" : "Use my wallet address"}
                </button>
              )}
            </div>
            {provider && <small className="muted">Nothing is signed and no transaction is sent.</small>}
            {walletMsg && <small className="bad" role="alert">{walletMsg}</small>}
          </div>
          <div className="actions">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? "Checking..." : "Run the check"}</button>
            <button className="btn ghost" type="button" disabled={busy} onClick={() => { if (ADDRESS.test(wallet.trim())) run("/api/compare"); else setError("Enter a valid BSC address first."); }}>Compare Ondo and bStocks</button>
          </div>
        </form>
      </section>

      <section id="results" className="results" aria-live="polite">
        {busy && (
          <div className="loading" role="status">
            <span className="bar" />
            <p>Running the checks. This takes a few seconds because the API allows about 5 calls per second.</p>
          </div>
        )}
        {error && <div className="err" role="alert"><b>Check failed.</b> {error}</div>}
        {single && <Result r={single} />}
        {cmp && (
          <>
            <div className="reco">
              <span className="label">Best venue</span>
              <strong>{cmp.recommendation.platform ?? "None passed"}</strong>
              <p>{cmp.recommendation.reason}</p>
            </div>
            {cmp.venues.map((v) => <Result key={v.platform} r={v} title={v.platform} />)}
          </>
        )}
      </section>
    </>
  );
}
