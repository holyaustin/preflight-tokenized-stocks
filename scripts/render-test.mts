// Renders the UI to HTML on the server with stubbed data, to catch runtime errors in the components.
// Run: npx tsx scripts/render-test.mts
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
process.env.OC_API_KEY = "k"; process.env.OC_SECRET_KEY = "s";
const { installStub, WALLET } = await import("./stub-api.mts");
installStub();
const { preflight, compareVenues } = await import("../lib/preflight");
const { default: Result } = await import("../app/components/Result");
const { default: Checker } = await import("../app/components/Checker");
const { default: Page } = await import("../app/page");

const r = await preflight({ ticker: "NVDA", usd: 5, wallet: WALLET, policy: "balanced" });
const html = renderToString(React.createElement(Result, { r }));
for (const needle of ["CAUTION", "NVDA", "On-chain price", "Spread", "What was checked", "Receipt", "Underlying market is closed", "pass CAUTION"]) {
  assert.ok(html.includes(needle), "missing: " + needle);
}
const html2 = renderToString(React.createElement(Result, { r: await preflight({ ticker: "NVDA", usd: 5, wallet: WALLET, policy: "cautious" }) }));
assert.ok(html2.includes("pass BLOCK") && html2.includes("Do not trade."));
const c = await compareVenues({ ticker: "NVDA", usd: 5, wallet: WALLET, policy: "permissive" });
assert.equal(c.venues.map((v) => renderToString(React.createElement(Result, { r: v }))).length, 2);

const page = renderToString(React.createElement(Page));
for (const needle of ["Check the trade", "How it works", "Policies are guardrails as code", "Use it from an agent", "preflight_check", "Run the check", "Cautious", "Compare Ondo and bStocks"]) {
  assert.ok(page.includes(needle), "page missing: " + needle);
}
assert.ok(renderToString(React.createElement(Checker)).includes("Risk policy"));
console.log("render test ok: Result (CAUTION and BLOCK), compare, Checker, full page");
