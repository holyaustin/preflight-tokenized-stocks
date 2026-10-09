# Developer Experience Report: DRAFT to rewrite in your own words

**Read this first.** The form says AI-generated or perfunctory reports are not accepted and unscored. Treat this as notes, not as the submission. Everything marked **[FILL IN]** needs your own live result (exact error text, timings, numbers). Everything marked **[CONFIRM]** I saw while reading the docs and building, so reproduce it before you claim it. Delete anything you cannot reproduce. I could only read page 1 of the form (it has 8 pages); the seven sections below follow the section list in the track overview, so match them to the real questions when you open it.

## 1. Onboarding
I started from the track page's resource list, then read Authentication, then the reference pages for RWA Data, Trading, Transaction, Wallet and Market data.

- Time from opening the docs to my first successful API call: **[FILL IN]**. Where I got stuck: **[FILL IN]**.
- Signing is the first hurdle. The base URL is `https://web3.binance.com/build`, but the reference pages list paths like `/api/v1/dex/...` without it, and the signed path has to include `/build`. I coded it from the Authentication page. **[FILL IN: did you hit 40102? what did the message say?]**
- I could not find one page that walks through "buy a tokenized stock" from key to filled order. I stitched it together from five reference pages. **[CONFIRM]**

## 2. Documentation issues (page and spot)
1. **Transaction API, Simulate Transactions, example response**: shows `status: "SUCCESS"` together with a `failReason` of an ERC20 insufficient-balance revert. **[CONFIRM]**
2. **Trading API, Get Transaction Status, example response**: `status: "success"` next to an `errorMsg`. **[CONFIRM]**
3. **Trading API, Get Aggregated Quote, `amount`**: the description says `1000000` is 1 USDT with decimals 6, but the example response for USDT on BSC reports decimal 18. A beginner on BSC would send the wrong amount. **[CONFIRM]**
4. **Market data, Get Token Trading Info (`/api/v1/dex/market/price-info`)**: the body is typed as an object, but the curl example sends an array. **[FILL IN: which one the API accepted]**
5. **Market data, Get Candles**: `after` is described as the end time (candles earlier than it) and `before` as the start time. The names read backwards. Rows are shown as numbers while most other endpoints return strings. **[CONFIRM]**
6. **Wallet API**: `excludeRiskToken` is a boolean in the GET balances endpoint, but in the POST endpoint it is a string where `"0"` means exclude and `"1"` means include. **[CONFIRM]**
7. **RWA Data**: `xStocks` is named in the track rules but the `platformId` list shows only `ondo` and `bstock`. **[CONFIRM]**
8. **Wallet Skills overview vs Stock Trading page**: the skills table describes `binance-tokenized-securities-info` as Ondo, while the Stock Trading page says bStock and Ondo. **[CONFIRM]**
9. **Track overview vs Trading API**: the overview says to dry-run with the Transaction API, but the Trading API says equity/RWA routes always use RFQ (a signed order, no transaction to simulate). I dry-ran the approval instead. **[CONFIRM]**

## 3. API pitfalls
- Rate limit: the docs say about 5 requests per second per endpoint. **[FILL IN: did you hit 429? how did you notice?]**
- Quotes expire. **[FILL IN: the exact error and how long yours lasted]**
- `userWalletAddress` is required to quote equity/RWA tokens, and `vendor` is required to build the approval for them. Easy to miss. **[FILL IN: the exact error when missing, if you tested]**
- `referencePrice` is derived from the on-chain price, not an official quote, so the "spread" can be near zero by construction. **[CONFIRM wording on the RWA price page]**
- Latency per endpoint from my call log: **[FILL IN table]**. Any error message that made no sense: **[FILL IN exact text]**.

## 4. AI stack feedback
- Did you use Agentic Wallet, Wallet Skills or the CLI? **[FILL IN yes/no and what happened]**. If not, say so plainly and explain why.
- What I could confirm from the docs: Agentic Wallet needs a Binance account and a wallet created in the Binance app; its spending rules (daily limit, token scope, confirmation) are set only in the app. **[CONFIRM]**
- What I built for this layer: a companion Skill file and an MCP server. **[FILL IN: whether you tested it with an agent, and the result]**
- Missing: a skill or rule that blocks a trade on market conditions (spread, drift, depth), not just "halted or not".

## 5. Tokenized-stock specifics
Measure these, do not copy numbers. Run PreFlight on 8 to 10 tickers during a US weekday session and again on the weekend.

| Ticker | Platform | Session | Spread % | 4h drift % | Impact % | Fill vs on-chain % | 24h volume |
|---|---|---|---|---|---|---|---|
| **[FILL IN]** | | | | | | | |

Write about: liquidity depth and slippage at $5, $50 and $500 **[FILL IN]**; behaviour outside US hours **[FILL IN]**; how Ondo and bStocks differ for the same ticker (`compare_venues`) **[FILL IN]**; the gap between on-chain and reference price **[FILL IN]**.
Doc detail worth testing: in the Flash API, `enableRFQ` defaults to true for bStock pairs and false for others. **[CONFIRM and test]**

## 6. Redesign suggestions
- One "buy a tokenized stock" quickstart: key, first price, quote, approve, sign, submit, poll, with copy-paste code.
- Use the `/build` prefix consistently in every example and say it once, clearly, at the top of every reference page.
- Make examples match the schema (array vs object, strings vs numbers, success vs failure fields).
- Explain which `vendor` values to pass for equity tokens, in one table.

## 7. Requested capabilities
- A dry-run or validate endpoint for RFQ orders, so agents can check before signing.
- The last close time and last close price in `statusInfo`, so closed-market drift can be measured exactly. At the moment I use the 4-hour price change. **[CONFIRM the fields you saw]**
- An independent official reference price for tokenized stocks.
- xStocks in RWA Data.
- A batch status endpoint for many tokens, and per-token depth for RFQ venues.
- Webhooks for status changes (halts, earnings windows).
