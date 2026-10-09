# PreFlight: beginner implementation guide

Deadline for the project AND the Developer Experience Report: Sunday 11 Oct, 12:00 UTC = **13:00 in GMT+1**. Aim to submit by 11:00 GMT+1.

## Words you will see
- **API key and secret**: a username and password for the Binance Web3 API. Never share or commit them.
- **Environment variable**: a setting your program reads at startup, like `OC_API_KEY`.
- **MCP**: a standard way for AI agents to call tools. PreFlight is an MCP server, so any agent can ask it "is this trade safe?".
- **Route**: a URL your Next.js app answers, like `/api/preflight`.

## Part 1. Install the tools (15 min)
1. Install **Node.js 22 (LTS)** from nodejs.org. Check: open a terminal, run `node -v`. It must print v22 or higher.
2. Install **Git** and **VS Code** (optional but helpful).

## Part 2. Get the project (5 min)
1. Unzip `preflight-nextjs.zip`. Open the folder in VS Code, then open its terminal.
2. Run `npm install` and wait for it to finish.
3. Run `npm run selftest`. You should see `part 1 ok` and `part 2 ok`. This proves the code works offline.

## Part 3. Get your API key (10 min). Write down the time it takes.
1. Join the hackathon: https://forms.gle/NEmy3FxYc4f5Dua47
2. Open https://web3.binance.com/en/dev-portal/project, sign in, create a project, and create an API key. Save the key and secret somewhere private.
3. In the project folder, copy `.env.example` to a new file named `.env.local` and fill in `OC_API_KEY` and `OC_SECRET_KEY`.
4. Join the builder Telegram group: https://t.me/+MhiOLT0YUnlmNWFk

## Part 4. First live test (10 min)
Run `npm run smoke`. Each line starts with PASS or FAIL.

| You see | What it means | Fix |
|---|---|---|
| `NO_CREDS` | Key not loaded | Check the `.env.local` file name and spelling |
| `40101` or `40102` or `40103` | Signature or key problem | Check key and secret. Check your computer clock is correct. The signed path must include `/build` (the code already does this) |
| `429` | Too many calls | The code retries; wait a minute |
| `451` or "restricted location" | The API blocked your IP's country | Try from another network; do not use a VPN to get around legal restrictions |
| FAIL on `price-info` | Body-shape quirk in the docs | The code tries array then object; copy the exact message for your report |
| FAIL on one step only | That one source is down or unsupported | PreFlight still works; it will show a caution for that part |

Copy the table printed at the end into your notes file. It lists every call's speed and result.

## Part 5. Run the web app (5 min)
1. Run `npm run dev`, open http://localhost:3000.
2. Enter a ticker (NVDA), an amount ($5), a policy, and **any BSC wallet address** (yours from MetaMask or Binance Wallet is fine). No private key is needed or accepted.
3. Press **Run the check**. Read the verdict, then try **Compare Ondo and bStocks**.
4. Try the three policies on the same trade and note how the verdict changes. That is a demo moment.

## Part 6. Use it as an MCP server (15 min)
1. Test locally with the official inspector: `npx @modelcontextprotocol/inspector npx tsx mcp/server.ts`. Open the link it prints, press Connect, then List Tools. You should see 5 tools. Run `preflight_check` with your values.
2. To use it from an agent app, add a server to that app's MCP settings with: command `npx`, args `["tsx","mcp/server.ts"]`, working folder = your project, and env `OC_API_KEY` and `OC_SECRET_KEY`. The exact settings screen differs per app; check the app's MCP docs.
3. Hosted version (after Part 8): the same tools are at `https://YOUR-SITE/api/mcp`.

## Part 7. Make it yours (60-90 min)
1. **Calibrate thresholds**: open `lib/policy.ts`. These numbers are defaults, not API facts. Run checks on 8 to 10 tickers (NVDA, TSLA, AAPL, and so on) at two times (a weekday US session and the weekend). Write down the spread, drift, impact and size numbers you see, then adjust and say why.
2. **Optional Skill**: edit the author in `skills/preflight/SKILL.md`. The Skills Hub accepts a folder with a `SKILL.md` through a pull request: https://github.com/binance/binance-skills-hub
3. **Optional live trade ($2 to $5)**: follow the Agentic Wallet "Stock Trading" guide, and run PreFlight first. Keep the receipt id with the trade.

## Part 8. Deploy (30 min)
Do the geography check first. Binance's own forum shows servers in blocked countries get HTTP 451. I could not open the official Web3 restricted-regions page, so test from the host.
1. Put the project on GitHub. **Make sure `.env.local` is NOT uploaded** (it is in `.gitignore`).
2. On Vercel (or any Node host): import the repo, add `OC_API_KEY`, `OC_SECRET_KEY` and optionally `RECEIPT_SECRET` as environment variables, and choose a server region outside the US if the host lets you.
3. After deploying, open `/api/health` (it should say `hasKey: true`), then run a check on the site. If you get 451, move the region.
4. The demo spends your key's rate limit. The code already limits each visitor per minute.

## Part 9. Record the demo (4 minutes max)
1. 0:00-0:30: the problem (stocks freeze Friday 4pm New York; tokens trade all weekend).
2. 0:30-1:30: run a check, show CAUTION on a closed market, then switch to the cautious policy and show BLOCK.
3. 1:30-2:30: Compare Ondo and bStocks, the spender check, the sparkline.
4. 2:30-3:15: download a receipt, edit one character, press Verify and show it fail.
5. 3:15-4:00: an agent calling `preflight_check` through MCP.

## Part 10. Submit
- Public repo with the README. Deployed link.
- Developer Experience Report (mandatory, 25%): https://forms.gle/EUQ39xf54GHjC2ys5
- Project submission: https://forms.gle/yToDUzaDMwWnq6R6A

## Suggested schedule (GMT+1)
- Thu night: Parts 1-4. Fri: Parts 5-7 and report notes. Sat: Part 8, Part 9 and the first draft of the report. Sun morning: finish the report, submit by 11:00.

## Troubleshooting
| Problem | Try |
|---|---|
| `npm install` fails | Check `node -v`; delete `node_modules` and retry |
| Port 3000 busy | `npm run dev -- -p 3001` |
| Site works locally, fails when deployed | Env vars missing, or the host region is blocked (see Part 8) |
| Verdict is always BLOCK with "No executable quote" | Wallet address typo, or the token has no route right now; see the exact message in Raw evidence |
