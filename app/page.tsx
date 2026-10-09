"use client";

import { useState } from "react";
import type { PreflightResult } from "@/lib/preflight";

type Compare = {
  ticker: string;
  company: string;
  recommendation: { platform: string | null; verdict: string; reason: string };
  venues: PreflightResult[];
};

const CATEGORY_TITLES: Record<string, string> = {
  market: "Market status",
  price: "Price integrity",
  liquidity: "Liquidity",
  execution: "Execution cost",
  wallet: "Your wallet",
  security: "Safety",
};
const LEVEL_LABEL: Record<string, string> = { info: "Pass", caution: "Caution", block: "Blocked" };

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 220},${40 - ((v - min) / span) * 36 - 2}`).join(" ");
  return (
    <svg width="220" height="40" role="img" aria-label={`Token price over the last ${values.length} hours`}>
      <polyline points={pts} fill="none" stroke="#14263b" strokeWidth="2" />
    </svg>
  );
}

function Result({ r, title }: { r: PreflightResult; title?: string }) {
  const [verify, setVerify] = useState<string>("");
  const count = (l: string) => r.reasons.filter((x) => x.level === l).length;
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.receipt, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `preflight-${r.receipt.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const check = async () => {
    const res = await fetch("/api/receipt/verify", { method: "POST", body: JSON.stringify(r.receipt) });
    const j = await res.json();
    setVerify(j.valid ? "Receipt is intact: the content matches its hash." : `Receipt check failed: ${j.reason}`);
  };
  const grouped = Object.keys(CATEGORY_TITLES).map((c) => ({ c, items: r.reasons.filter((x) => x.category === c) })).filter((g) => g.items.length);
  return (
    <div>
      {title && <h2 style={{ fontFamily: "var(--serif)" }}>{title}</h2>}
      <div className={`verdict ${r.verdict}`}>
        <span className="word">{r.verdict}</span>
        <span>{r.ticker} on {r.platform} ({r.token}), ${r.usd}, {r.policy} policy</span>
      </div>
      <p className="summary">{count("info")} passed, {count("caution")} caution, {count("block")} blocking. {r.apiCalls} API calls.</p>
      <div className="row">
        <Sparkline values={r.evidence.sparkline} />
        {r.evidence.sparkline.length > 1 && <span className="hint">Token price, last {r.evidence.sparkline.length} hours (hourly candles)</span>}
      </div>
      {grouped.map((g) => (
        <div className="card" key={g.c}>
          <h2>{CATEGORY_TITLES[g.c]}</h2>
          <ul className="checks">
            {g.items.map((x, i) => (
              <li key={i}>
                <span className={`tag ${x.level}`}>{LEVEL_LABEL[x.level]}</span>
                <div><div>{x.message}</div><div className="code">{x.code}</div></div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="receipt">
        <span>Receipt <code>{r.receipt.id}</code></span>
        <button className="secondary small" type="button" onClick={download}>Download receipt</button>
        <button className="secondary small" type="button" onClick={check}>Verify receipt</button>
        {verify && <span className="hint">{verify}</span>}
      </div>
      <details><summary>Raw evidence</summary><pre>{JSON.stringify(r.evidence, null, 2)}</pre></details>
    </div>
  );
}

export default function Home() {
  const [ticker, setTicker] = useState("NVDA");
  const [usd, setUsd] = useState("5");
  const [policy, setPolicy] = useState("balanced");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [single, setSingle] = useState<PreflightResult | null>(null);
  const [cmp, setCmp] = useState<Compare | null>(null);

  async function run(path: "/api/preflight" | "/api/compare") {
    setBusy(true); setError(""); setSingle(null); setCmp(null);
    try {
      const q = new URLSearchParams({ ticker, usd, wallet: wallet.trim(), policy });
      const res = await fetch(`${path}?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (path === "/api/compare") setCmp(data); else setSingle(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>PreFlight</h1>
      <p className="lede">
        Before an agent or a person buys a tokenized stock on BNB Smart Chain, check the market status, the weekend drift, the real quote,
        your wallet, and who gets approved to spend your funds. Read-only: no keys, no signing. Every check ends with a receipt you can verify.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); run("/api/preflight"); }}>
        <label>Ticker<input value={ticker} onChange={(e) => setTicker(e.target.value)} maxLength={10} required autoComplete="off" /></label>
        <label>Amount (USD)<input type="number" value={usd} onChange={(e) => setUsd(e.target.value)} min="0.01" step="any" required /></label>
        <label>Risk policy
          <select value={policy} onChange={(e) => setPolicy(e.target.value)}>
            <option value="cautious">Cautious</option><option value="balanced">Balanced</option><option value="permissive">Permissive</option>
          </select>
        </label>
        <label className="wide">Your BSC address<input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x followed by 40 characters" required autoComplete="off" spellCheck={false} /></label>
        <div className="actions">
          <button className="primary" type="submit" disabled={busy}>{busy ? "Checking..." : "Run the check"}</button>
          <button className="secondary" type="button" disabled={busy} onClick={() => { if (wallet) run("/api/compare"); else setError("Enter your BSC address first."); }}>Compare Ondo and bStocks</button>
          <span className="hint">Takes several seconds: the API allows about 5 calls per second.</span>
        </div>
      </form>
      <section id="out" aria-live="polite">
        {error && <div className="err">Check failed: {error}</div>}
        {single && <Result r={single} />}
        {cmp && (
          <>
            <div className="reco">
              <strong>{cmp.recommendation.platform ? `Best venue: ${cmp.recommendation.platform}` : "No venue passed"}</strong>
              <div>{cmp.recommendation.reason}</div>
            </div>
            {cmp.venues.map((v) => <Result key={v.platform} r={v} title={`${v.platform}`} />)}
          </>
        )}
      </section>
    </main>
  );
}
