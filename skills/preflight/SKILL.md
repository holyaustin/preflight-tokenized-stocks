---
title: PreFlight (tokenized stock pre-trade check)
description: Use BEFORE buying a tokenized stock (Ondo or bStock) on BSC. Runs a policy-based safety check (market status, weekend drift, liquidity, wallet funds and gas, real quote cost, approval spender verification) and returns GO, CAUTION or BLOCK with a verifiable receipt.
metadata:
  version: 2.0.0
  author: your-github-username
license: MIT
---

# PreFlight

Companion safety skill for `binance-agentic-wallet` and `binance-tokenized-securities-info`.
Those skills resolve a ticker and place the trade. This skill decides whether the trade should happen.

## When to use
Any time the user asks to buy a tokenized stock with USDT on BSC, including strategy rules that trigger buys.

## How
1. Call the PreFlight MCP tool `preflight_check` with `ticker`, `usd`, `wallet` and a `policy` (`cautious`, `balanced` or `permissive`; default `balanced`).
2. Read the verdict:
   - `BLOCK`: do not trade. Explain the blocking reasons in plain language.
   - `CAUTION`: summarize the cautions and ask the user to confirm before continuing.
   - `GO`: continue with the trade.
3. Keep `receipt.id` with the trade record. Use `verify_receipt` to prove the check was not altered.
4. To choose between issuers for the same ticker, call `compare_venues` first.

## Notes
- PreFlight is read-only. It never holds keys and never signs.
- Equity/RWA routes use RFQ execution, so PreFlight dry-runs the approval (Transaction API simulate) and verifies the spender instead of simulating the swap.
- Not investment advice.
