# What already exists, and where PreFlight is different

Sources: the Agentic Wallet "Stock Trading (Tokenized Securities)" page (last modified Oct 8, 2026), the Wallet Skills overview, the Skills Hub README, the Binance Web3 API docs, and the Binance MCP Server page. I could not open the Web3 docs' own "MCP Server" page (listed in llms.txt) or read the skill's source code, so check those two before you pitch. Ten minutes there protects you from a judge saying "this exists".

## What exists (official)

| Thing | What it does | Source |
|---|---|---|
| `binance-tokenized-securities-info` skill (read-only) | Resolves a ticker or company name to the on-chain contract; returns price, fundamentals (P/E, dividend yield, 52-week range), holders, supply, market cap, and trading status | Stock Trading page; Wallet Skills table |
| Agentic Wallet | Quote-only requests, buy and sell by chat with confirmation, order status, long-running strategies (earnings watcher, news-driven rotation). It "checks the token's on-chain trading status before acting" and holds off if the token is halted for a corporate action | Stock Trading page |
| Agentic Wallet security rules | Daily limit, tradable-token scope, "require app confirmation". Set only inside the Binance app | Install Agentic Wallet page |
| `query-token-audit` skill | Generic token security audit (risk score, honeypot detection, contract verification) | Wallet Skills overview |
| Binance MCP Server (agent.binance.com) | Trades inside a Binance.com sub-account (the exchange, not on-chain tokenized stocks) | Binance MCP Server page |
| Community Binance MCP servers | Exchange (CEX) market data and trading | Public listings |

## What I did not find in those pages (PreFlight's space)

| Gap | PreFlight v2 |
|---|---|
| "Tradable or halted" is a yes/no. Nothing scores risk against a policy you choose | Policy engine: cautious / balanced / permissive, or your own JSON. Same inputs, same verdict |
| Nothing compares Ondo and bStock for the same ticker | `compare_venues` runs the full check on each and picks the cheapest venue that is not blocked |
| Nothing verifies who you are about to approve as spender | Approval is built, dry-run with Transaction API `simulate`, and the spender is matched against the quote's approve target |
| Closed-market risk is described, not measured | "Unanchored drift": how far the token moved on-chain in the last 4 hours while the equity market was closed |
| Order size vs market depth | Your order as a percent of the last 24h on-chain volume |
| Wallet readiness | Wallet API: enough USDT and enough BNB for gas |
| No audit trail an agent can hand to a human | Receipts: canonical-JSON SHA-256, optional HMAC, `verify_receipt` tool and endpoint, includes every API call made |
| Tied to Agentic Wallet | Portable: MCP over stdio or HTTP, plus a Skill file so it plugs into the Skills Hub next to the two skills above |

How it fits: Agentic Wallet's limits are about your money. PreFlight's checks are about the market and the route. They stack.

## How many APIs

PreFlight v2 uses 11 endpoints across 5 modules.

| # | Endpoint | Module |
|---|---|---|
| 1 | GET /api/v1/dex/market/rwa/search | RWA Data |
| 2 | GET /api/v1/dex/market/rwa/price | RWA Data |
| 3 | GET /api/v1/dex/market/rwa/underlying-market | RWA Data |
| 4 | GET /api/v1/dex/market/rwa/underlying-profile | RWA Data |
| 5 | POST /api/v1/dex/market/price-info | Market data |
| 6 | GET /api/v1/dex/market/candles | Market data |
| 7 | POST /api/v1/dex/balance/token-balances-by-address | Wallet |
| 8 | GET /api/v1/dex/aggregator/quote | Trading |
| 9 | GET /api/v1/dex/aggregator/approve-transaction | Trading |
| 10 | POST /api/v1/dex/pre-transaction/simulate | Transaction |
| 11 | GET /api/v1/dex/aggregator/quote-and-swap (optional "deep" mode) | Trading |

The smoke test touches 4 more (rwa/platforms and the three "supported chain" endpoints), so 15 in total. Not used: DeFi API, B402 payments, WebSocket, Agent Studio.

Correction to my earlier message: v1 used 8 endpoints across 3 modules, and I overstated it as "six modules". The "5" you remember was the tool count in my plan; v1 shipped 4 tools, v2 ships 5 tools, 1 resource and 1 prompt.

## Why it should score

| Criterion | What to point at |
|---|---|
| Technical implementation (30%) | 11 endpoints, 5 modules; every data source degrades into a visible caution instead of a crash; offline tests including a full stubbed-API run; stateless hosted MCP plus stdio |
| Creativity (25%) | Guardrails as code, unanchored drift, spender verification, tamper-evident receipts, venue router, companion Skill |
| Developer Experience Report (25%) | The call log is built in, so latencies and exact errors are captured while you work |
| Product quality (20%) | Plain-language verdicts grouped by category, sparkline, one-click compare, receipt download |

Pitch line: "Agents can already trade tokenized stocks. PreFlight is the part that tells them when not to."
