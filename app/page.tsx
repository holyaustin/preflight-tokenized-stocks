import Checker from "./components/Checker";
import CopyBox from "./components/CopyBox";
import { PRESETS } from "@/lib/policy";

const STEPS = [
  { n: "1", t: "Read the market", d: "Is the stock market open? Any earnings or corporate-action pause? How far did the token move while no equity price existed?" },
  { n: "2", t: "Price the trade", d: "Real quote and price impact, your size against 24h volume, wallet funds and gas, and a dry-run of the approval with the spender checked." },
  { n: "3", t: "Decide and prove", d: "A GO, CAUTION or BLOCK judged by your policy, plus a tamper-evident receipt of every API call behind it." },
];
const TOOLS = ["preflight_check", "compare_venues", "market_status", "resolve_asset", "verify_receipt"];

export default function Page() {
  return (
    <>
      <header className="top">
        <a className="brand" href="#top" aria-label="PreFlight home">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <rect width="26" height="26" rx="7" fill="currentColor" />
            <path d="M6 17l5-5 3 3 6-6M15 9h5v5" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          PreFlight
        </a>
        <nav aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#policies">Policies</a>
          <a href="#agents">For agents</a>
        </nav>
      </header>

      <main id="top">
        <Checker />

        <section id="how" className="block">
          <h2>How it works</h2>
          <div className="cards three">
            {STEPS.map((s) => (
              <div className="card" key={s.n}>
                <span className="step">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="policies" className="block">
          <h2>Policies are guardrails as code</h2>
          <p className="sub">Pick a preset, or send your own. The same data gives a different verdict under each. These numbers are defaults you can tune.</p>
          <div className="cards three">
            {Object.values(PRESETS).map((p) => (
              <div className="card" key={p.name}>
                <h3 className="cap">{p.name}</h3>
                <dl className="spec">
                  <div><dt>Max trade</dt><dd>${p.maxUsd.toLocaleString("en-US")}</dd></div>
                  <div><dt>Closed market</dt><dd>{p.closedMarket}</dd></div>
                  <div><dt>Spread</dt><dd>{p.spreadPct.caution}% / {p.spreadPct.block}%</dd></div>
                  <div><dt>Price impact</dt><dd>{p.impactPct.caution}% / {p.impactPct.block}%</dd></div>
                  <div><dt>Weekend drift</dt><dd>{p.driftPct.caution}% / {p.driftPct.block}%</dd></div>
                  <div><dt>Attestation</dt><dd>{p.attestation}</dd></div>
                </dl>
                <p className="muted small">Caution / block thresholds</p>
              </div>
            ))}
          </div>
        </section>

        <section id="agents" className="block">
          <h2>Use it from an agent</h2>
          <p className="sub">One MCP server, two ways to run it. Call <code>preflight_check</code> before any buy, and stop on BLOCK.</p>
          <div className="cards two">
            <div className="card">
              <h3>Hosted</h3>
              <CopyBox label="MCP endpoint" path="/api/mcp" />
            </div>
            <div className="card">
              <h3>Local</h3>
              <CopyBox label="Run in the project folder" value="npm run mcp" />
            </div>
          </div>
          <ul className="tools" aria-label="Available tools">
            {TOOLS.map((t) => <li key={t}><code>{t}</code></li>)}
          </ul>
        </section>
      </main>

      <footer className="foot">
        <p>Read-only: PreFlight never holds keys and never signs. Not investment advice. Built for BNB Hack: Tokenized Stocks Edition.</p>
      </footer>
    </>
  );
}
