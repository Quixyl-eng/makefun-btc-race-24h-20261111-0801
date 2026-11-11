// Dip-buy / quick-rebound bot for btc-race bars-replay/v1 (long only).
// BUILD: btc-race-live-2026-11-11-v2
// After a DROP_BPS drop vs the prior DROP_LOOKBACK closes, buy SIZE_BPS of cash.
// Exit on TAKE_PROFIT_BPS, STOP_BPS, or MAX_HOLD bars. Cap round trips.
// Credit: vendor shim is the official kit sdk; strategy inspired by mean-reversion
// notes in je-suis-tm/quant-trading (Apache-2.0), implemented clean-room here.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const DROP_LOOKBACK = 5;
const DROP_BPS = 80n;
const TAKE_PROFIT_BPS = 40n;
const STOP_BPS = 80n;
const MAX_HOLD = 15;
const COOLDOWN = 10;
const SIZE_BPS = 7000n; // v2: leave more cash cushion after fees
const MAX_TRIPS = 6;
const MAX_SLIPPAGE_BPS = 80;
const BPS = 10_000n;

const closes = new Map<string, bigint[]>();
const entry = new Map<string, bigint>();
const hold = new Map<string, number>();
let trips = 0;
let lastExit = -1e9;
let barIndex = -1;

await runBars({
  onBatch(state: BarsState, batch) {
    barIndex += 1;
    const orders: (BuyInput | SellInput)[] = [];
    const { fees } = state.hello;
    const minNotional = BigInt(fees.min_notional_quote_units);

    for (const bar of batch.bars) {
      const symbol = bar.symbol;
      const close = BigInt(bar.c);
      let series = closes.get(symbol);
      if (series === undefined) closes.set(symbol, (series = []));
      series.push(close);

      const held = state.positions.get(symbol);
      if (held !== undefined && entry.has(symbol)) {
        const h = (hold.get(symbol) ?? 0) + 1;
        hold.set(symbol, h);
        const e = entry.get(symbol)!;
        const retBps = ((close - e) * BPS) / e;
        if (retBps >= TAKE_PROFIT_BPS || retBps <= -STOP_BPS || h >= MAX_HOLD) {
          entry.delete(symbol);
          hold.delete(symbol);
          trips += 1;
          lastExit = barIndex;
          orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
        continue;
      }

      entry.delete(symbol);
      hold.delete(symbol);
      if (trips >= MAX_TRIPS || barIndex - lastExit < COOLDOWN) continue;
      if (series.length <= DROP_LOOKBACK) continue;
      const window = series.slice(-(DROP_LOOKBACK + 1));
      let hi = window[0];
      for (const x of window.slice(0, -1)) if (x > hi) hi = x;
      const dropBps = hi === 0n ? 0n : ((hi - close) * BPS) / hi;
      if (dropBps < DROP_BPS) continue;
      if (state.positions.size > 0) continue; // one position
      const notional = (state.cash * SIZE_BPS) / BPS;
      if (notional < minNotional) continue;
      entry.set(symbol, close);
      hold.set(symbol, 0);
      orders.push({ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS });
    }
    return orders;
  },
});
