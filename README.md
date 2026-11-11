# btc-race-24h-20261111-0801 entry

Long-only CBBTC/USDC bars-replay bot for [make.fun](https://make.fun/bounty/btc-race-24h-20261111-0801).

## Strategy

Dip-buy / quick rebound: after an ~80 bps drop versus the prior 5 closes, buy
most of cash; exit on ~40 bps take-profit, ~80 bps stop, or a short max hold.
Round trips are capped. Tuned so the kit's published **dev** window grades
above 0 USDC net PnL (required to race). Race ranking uses a future window.

## Credit

- `vendor/makefun-bars.ts` — byte copy of the official make.fun kit SDK.
- Strategy notes inspired by mean-reversion ideas in
  [je-suis-tm/quant-trading](https://github.com/je-suis-tm/quant-trading) (Apache-2.0);
  this bot is clean-room TypeScript, not a copy of that repo's code.
