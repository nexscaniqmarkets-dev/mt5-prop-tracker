import React, { useState, useMemo } from 'react';
import { Calculator, AlertTriangle, TrendingUp } from 'lucide-react';
import { DashboardState } from '../types';

interface CalculatorProps {
  state: DashboardState;
}

// Pip value per standard lot (1.0) in USD, and pip size in raw price units, for each symbol.
// These match what's confirmed directly against MT5 Specification + live test trades.
const SYMBOL_CONFIG: Record<string, { pipValuePerLot: number; pipSize: number; label: string }> = {
  EURUSD: { pipValuePerLot: 10, pipSize: 0.0001, label: 'EUR/USD' },
  GBPUSD: { pipValuePerLot: 10, pipSize: 0.0001, label: 'GBP/USD' },
  AUDUSD: { pipValuePerLot: 10, pipSize: 0.0001, label: 'AUD/USD' },
  USDJPY: { pipValuePerLot: 9.1, pipSize: 0.01, label: 'USD/JPY' },
  XAUUSD: { pipValuePerLot: 1, pipSize: 0.1, label: 'XAU/USD (Gold)' },
  BTCUSD: { pipValuePerLot: 1, pipSize: 1, label: 'BTC/USD' },
  ETHUSD: { pipValuePerLot: 1, pipSize: 1, label: 'ETH/USD' },
};

const isCrypto = (symbol: string) => symbol === 'BTCUSD' || symbol === 'ETHUSD';

export default function PositionCalculator({ state }: CalculatorProps) {
  const { metrics, rules } = state;

  const [symbol, setSymbol] = useState('BTCUSD');
  const [riskPct, setRiskPct] = useState(1.0);
  const [customBalance, setCustomBalance] = useState<number | null>(null);

  // Input mode: 'pips' (manual distance) or 'price' (entry + stop loss price)
  const [inputMode, setInputMode] = useState<'pips' | 'price'>('pips');
  const [stopLossPoints, setStopLossPoints] = useState(100);
  const [entryPrice, setEntryPrice] = useState<number | ''>('');
  const [stopPrice, setStopPrice] = useState<number | ''>('');

  const accountBalance = customBalance ?? metrics.currentBalance;
  const config = SYMBOL_CONFIG[symbol];

  // Derive the effective stop-loss distance (in "pips" for forex/gold, or raw USD distance for crypto)
  const effectiveDistance = useMemo(() => {
    if (inputMode === 'pips') {
      return stopLossPoints;
    }
    // Price mode: derive distance from entry and stop prices
    if (entryPrice === '' || stopPrice === '') return 0;
    const rawDiff = Math.abs(Number(entryPrice) - Number(stopPrice));
    if (isCrypto(symbol)) {
      return rawDiff; // crypto: distance is the raw USD price difference
    }
    return rawDiff / config.pipSize; // forex/gold: convert price difference to pip count
  }, [inputMode, stopLossPoints, entryPrice, stopPrice, symbol, config]);

  const calculation = useMemo(() => {
    const riskAmount = (accountBalance * riskPct) / 100;

    let lotSize = 0;
    let pipValueUsed = 0;

    if (isCrypto(symbol)) {
      // For crypto: distance is already a raw USD price move; pip value per lot = $1
      pipValueUsed = config.pipValuePerLot;
      lotSize = effectiveDistance > 0 ? riskAmount / effectiveDistance : 0;
    } else {
      pipValueUsed = config.pipValuePerLot;
      lotSize = effectiveDistance > 0 ? riskAmount / (effectiveDistance * config.pipValuePerLot) : 0;
    }

    const roundedLotSize = Math.floor(lotSize * 100) / 100;

    // Funding Pips max single-trade profit rule (informational)
    const maxAllowedRiskByRule = (accountBalance * rules.max_profit_limit) / 100;
    const exceedsSingleTradeLimit = riskAmount > maxAllowedRiskByRule;

    // Remaining daily drawdown room
    const dailyRoomRemaining = (accountBalance * rules.daily_drawdown_limit) / 100 - metrics.dailyDrawdownCash;
    const exceedsDailyRoom = riskAmount > dailyRoomRemaining;

    return {
      riskAmount,
      lotSize: roundedLotSize,
      standardLots: roundedLotSize,
      miniLots: roundedLotSize * 10,
      microLots: roundedLotSize * 100,
      pipValueUsed,
      exceedsSingleTradeLimit,
      maxAllowedRiskByRule,
      exceedsDailyRoom,
      dailyRoomRemaining,
    };
  }, [accountBalance, riskPct, effectiveDistance, symbol, config, rules, metrics]);

  const presetRisks = [0.5, 1.0, 1.5, 2.0];

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="bg-glass rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-1">
          <Calculator className="text-blue-400 w-4 h-4" /> Position Size Calculator
        </h3>
        <p className="text-xs text-slate-400">
          Calculate the correct lot size for your risk per trade, based on your live account balance.
        </p>
      </div>

      {/* Inputs */}
      <div className="bg-glass rounded-2xl p-5 space-y-4">

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Account Balance (USD)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={customBalance ?? metrics.currentBalance}
              onChange={(e) => setCustomBalance(parseFloat(e.target.value) || 0)}
              className="flex-1 text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2.5 outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setCustomBalance(null)}
              className="px-3 text-[10px] font-bold text-blue-400 bg-slate-900 border border-slate-800 rounded-lg hover:border-blue-500/50"
            >
              Use Live
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Live MT5 balance: ${metrics.currentBalance.toFixed(2)}
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Trading Pair
          </label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full text-xs font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2.5 outline-none focus:border-blue-500"
          >
            {Object.entries(SYMBOL_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Risk Per Trade (%)
          </label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {presetRisks.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRiskPct(r)}
                className={`py-2 text-xs font-bold rounded-lg border transition ${
                  riskPct === r
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {r}%
              </button>
            ))}
          </div>
          <input
            type="number"
            step="0.1"
            value={riskPct}
            onChange={(e) => setRiskPct(parseFloat(e.target.value) || 0)}
            className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2.5 outline-none focus:border-blue-500"
          />
        </div>

        {/* Input mode toggle */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Stop Loss Input Method
          </label>
          <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 mb-3">
            <button
              type="button"
              onClick={() => setInputMode('pips')}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-md transition ${
                inputMode === 'pips' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              {isCrypto(symbol) ? 'USD Distance' : 'Pips'}
            </button>
            <button
              type="button"
              onClick={() => setInputMode('price')}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-md transition ${
                inputMode === 'price' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              Entry + Stop Price
            </button>
          </div>

          {inputMode === 'pips' ? (
            <input
              type="number"
              value={stopLossPoints}
              onChange={(e) => setStopLossPoints(parseFloat(e.target.value) || 0)}
              className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2.5 outline-none focus:border-blue-500"
              placeholder={isCrypto(symbol) ? 'e.g. 300' : 'e.g. 20'}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-semibold text-slate-500 mb-1">Entry Price</label>
                <input
                  type="number"
                  step="0.00001"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2.5 outline-none focus:border-blue-500"
                  placeholder="e.g. 64200.00"
                />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-slate-500 mb-1">Stop Loss Price</label>
                <input
                  type="number"
                  step="0.00001"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2.5 outline-none focus:border-blue-500"
                  placeholder="e.g. 63900.00"
                />
              </div>
            </div>
          )}

          {inputMode === 'price' && effectiveDistance > 0 && (
            <p className="text-[10px] text-slate-500 mt-2">
              = {effectiveDistance.toFixed(isCrypto(symbol) ? 2 : 1)} {isCrypto(symbol) ? 'USD distance' : 'pips'}
            </p>
          )}
        </div>
      </div>

      {/* Result */}
      <div className="bg-glass rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <TrendingUp className="text-emerald-400 w-4 h-4" /> Result
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/60 rounded-xl p-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Standard Lots</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {calculation.standardLots.toFixed(2)}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Risk Amount</span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              ${calculation.riskAmount.toFixed(2)}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mini Lots</span>
            <div className="text-lg font-bold font-mono text-slate-300 mt-1">
              {calculation.miniLots.toFixed(1)}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Micro Lots</span>
            <div className="text-lg font-bold font-mono text-slate-300 mt-1">
              {calculation.microLots.toFixed(0)}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-xl p-3 flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pip Value Used</span>
          <span className="text-xs font-mono font-bold text-blue-400">
            ${calculation.pipValueUsed.toFixed(2)} / {isCrypto(symbol) ? '$1 move' : 'pip'} / lot
          </span>
        </div>

        {calculation.lotSize === 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300">
              Enter a stop loss distance greater than 0 to calculate lot size.
            </p>
          </div>
        )}

        {calculation.exceedsSingleTradeLimit && (
          <div className="flex items-start gap-2 p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-300">
              This risk amount (${calculation.riskAmount.toFixed(2)}) exceeds your max single-trade profit rule of {rules.max_profit_limit}% (${calculation.maxAllowedRiskByRule.toFixed(2)}). Consider lowering risk %.
            </p>
          </div>
        )}

        {calculation.exceedsDailyRoom && (
          <div className="flex items-start gap-2 p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-300">
              This risk amount exceeds your remaining daily drawdown room (${Math.max(calculation.dailyRoomRemaining, 0).toFixed(2)} left today). A loss on this trade could breach your daily limit.
            </p>
          </div>
        )}

        <p className="text-[10px] text-slate-500 leading-relaxed">
          Note: Pip value is based on standard contract sizes verified against MT5. For 3-digit Gold pricing, MT5 may label this distance in "points" — 1 pip here equals 10 of those points. Always verify lot size in MT5 before placing the trade.
        </p>
      </div>
    </div>
  );
}
