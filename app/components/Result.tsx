"use client";

import { useState } from "react";
import type { PreflightResult } from "@/lib/preflight";

const CATEGORIES: Record<string, string> = {
  market: "Market status",
  price: "Price integrity",
  liquidity: "Liquidity",
  execution: "Execution cost",
  wallet: "Your wallet",
  security: "Safety",
};
const LEVEL_TEXT: Record<string, string> = { info: "Pass", caution: "Caution", block: "Blocked" };
const MEANING: Record<string, string> = {
  GO: "Cleared to trade.",
  CAUTION: "Review the cautions before you trade.",
  BLOCK: "Do not trade.",
};

// Drawn icons: same 24x24 box, same stroke weight, centered, so check / exclamation / cross match exactly.
function Icon({ level }: { level: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {level === "info" && <path d="M6 12.5l4 4 8-9" />}
      {level === "block" && <path d="M7 7l10 10M17 7L7 17" />}
      {level === "caution" && <path d="M12 5.5v8M12 18h.01" />}
    </svg>
  );
}

const money = (n: number) => (Number.isFinite(n) ? `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 4 : 2 })}` : "n/a");
const pct = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "n/a" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`);
const compact = (n: number | null | undefined) => (n == null ? "n/a" : `$${Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`);

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 320, h = 64, pad = 4;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - pad - ((v - min) / span) * (h - pad * 2)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <figure className="spark">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Token price over the last ${values.length} hours`}>
        <defs>
          <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#sg)" />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <figcaption>Token price, last {values.length} hours</figcaption>
    </figure>
  );
}

export default function Result({ r, title }: { r: PreflightResult; title?: string }) {
  const [verify, setVerify] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const s = r.evidence.snapshot, st = r.evidence.stats, q = r.evidence.quote, w = r.evidence.wallet;
  const spread = ((s.tokenPrice - s.referencePrice) / s.referencePrice) * 100;
  const fill = q ? ((q.execPrice - s.tokenPrice) / s.tokenPrice) * 100 : null;
  const share = st?.volume24H ? (r.usd / st.volume24H) * 100 : null;
  const next = s.market.nextOpenTime ? `opens ${new Date(s.market.nextOpenTime).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : s.market.openState ? "open now" : "closed";

  const tiles = [
    { k: "On-chain price", v: money(s.tokenPrice), sub: `Reference ${money(s.referencePrice)}` },
    { k: "Spread", v: pct(spread), sub: "on-chain vs reference" },
    { k: "4h move", v: pct(st?.priceChange4H), sub: s.market.openState ? "market open" : "no equity price now" },
    { k: "24h volume", v: compact(st?.volume24H), sub: share != null ? `your order is ${share.toFixed(2)}%` : "on-chain" },
    { k: "Price impact", v: q ? pct(q.priceImpactPct) : "n/a", sub: q ? `${q.vendor}, ${q.executionMode}` : "no quote" },
    { k: "Fill vs on-chain", v: pct(fill), sub: q ? `${q.tokensOut.toFixed(4)} tokens` : "no quote" },
    { k: "USDT in wallet", v: w ? w.usdt.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "n/a", sub: w ? `${w.native} ${w.nativeSymbol} for gas` : "not checked" },
    { k: "Equity market", v: s.market.marketStatus, sub: next },
  ];

  const count = (l: string) => r.reasons.filter((x) => x.level === l).length;
  const groups = Object.keys(CATEGORIES)
    .map((c) => ({ c, items: r.reasons.filter((x) => x.category === c && (!issuesOnly || x.level !== "info")) }))
    .filter((g) => g.items.length);

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.receipt, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `preflight-${r.receipt.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const check = async () => {
    const res = await fetch("/api/receipt/verify", { method: "POST", body: JSON.stringify(r.receipt) });
    const j = await res.json();
    setVerify(j.valid ? "Intact: the content matches its hash." : `Failed: ${j.reason}`);
  };

  return (
    <section className="result" aria-label={`${r.ticker} check on ${r.platform}`}>
      {title && <h3 className="venue">{title}</h3>}

      <article className={`pass ${r.verdict}`}>
        <div className="pass-main">
          <div className="pass-top">
            <span className="label">Pre-trade check</span>
            <span className="mono muted">{new Date(r.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <h2 className="ticker">{r.ticker}<small>{r.token}</small></h2>
          <dl className="facts">
            <div><dt>Platform</dt><dd>{r.platform}</dd></div>
            <div><dt>Amount</dt><dd>${r.usd}</dd></div>
            <div><dt>Policy</dt><dd>{r.policy}</dd></div>
            <div><dt>API calls</dt><dd>{r.apiCalls}</dd></div>
          </dl>
          <Spark values={r.evidence.sparkline} />
        </div>
        <div className="pass-stub">
          <span className="label">Verdict</span>
          <strong className="verdict-word">{r.verdict}</strong>
          <p>{MEANING[r.verdict]}</p>
          <div className="stub-foot"><span className="label">Receipt</span><code>{r.receipt.id}</code></div>
        </div>
      </article>

      <div className="counts" role="list">
        <div role="listitem" className="pill info"><b>{count("info")}</b><span>passed</span></div>
        <div role="listitem" className="pill caution"><b>{count("caution")}</b><span>caution</span></div>
        <div role="listitem" className="pill block"><b>{count("block")}</b><span>blocking</span></div>
      </div>

      <div className="tiles">
        {tiles.map((t) => (
          <div className="tile" key={t.k}>
            <span className="label">{t.k}</span>
            <strong>{t.v}</strong>
            <span className="muted">{t.sub}</span>
          </div>
        ))}
      </div>

      <div className="checks-head">
        <h3>What was checked</h3>
        <label className="switch">
          <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} />
          <span>Show issues only</span>
        </label>
      </div>
      <div className="groups">
        {groups.length === 0 && <p className="muted">Nothing to flag.</p>}
        {groups.map((g) => (
          <div className="group" key={g.c}>
            <h4>{CATEGORIES[g.c]}</h4>
            <ul>
              {g.items.map((x, i) => (
                <li key={i}>
                  <span className={`badge ${x.level}`} aria-hidden="true"><Icon level={x.level} /></span>
                  <div>
                    <p><span className={`lvl ${x.level}`}>{LEVEL_TEXT[x.level]}.</span> {x.message}</p>
                    <span className="code">{x.code}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="receipt">
        <div>
          <span className="label">Receipt</span>
          <code>{r.receipt.id}</code>
        </div>
        <div className="receipt-actions">
          <button className="btn ghost" type="button" onClick={download}>Download</button>
          <button className="btn ghost" type="button" onClick={check}>Verify</button>
        </div>
        {verify && <p className="muted receipt-note" role="status">{verify}</p>}
      </div>

      <details className="raw">
        <summary>Raw evidence</summary>
        <pre>{JSON.stringify(r.evidence, null, 2)}</pre>
      </details>
    </section>
  );
}