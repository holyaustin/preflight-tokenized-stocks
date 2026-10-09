# PreFlight

Pre-trade safety gate for tokenized stocks on BNB Smart Chain, built on the Binance Web3 API.
Before an agent or a person buys, PreFlight answers: **GO, CAUTION or BLOCK, and why**, judged against a risk policy, with a verifiable receipt.

- Web app + HTTP API (Next.js App Router)
- MCP server over stdio (`npm run mcp`) and over HTTP (`/api/mcp`)
- Companion Skill: `skills/preflight/SKILL.md`

Start with `docs/IMPLEMENTATION-GUIDE.md`. Why this is different: `docs/WHAT-ALREADY-EXISTS.md`.

## Commands
| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run selftest` | Offline tests (no key, no network) |
| `npm run smoke` | First live API test (needs `.env.local`) |
| `npm run dev` | Web app at http://localhost:3000 |
| `npm run build && npm start` | Production build and server |
| `npm run mcp` | Local MCP server (stdio) |

## Scope
Buy side only (USDT to token), spot only, BSC only. Equity/RWA routes use RFQ execution per the Trading API docs, so PreFlight dry-runs the approval and verifies the spender instead of simulating the swap.
Not investment advice.
