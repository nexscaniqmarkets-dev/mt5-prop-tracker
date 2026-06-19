import React, { useState } from 'react';
import { Shield, RefreshCw, Trash2, Database } from 'lucide-react';
import { DashboardState } from '../types';

interface SettingsProps {
  state: DashboardState;
  onRefresh: () => Promise<void>;
  onShowNotification: (msg: string, type: 'success' | 'info') => void;
}

export default function Settings({ state, onRefresh, onShowNotification }: SettingsProps) {
  const { rules } = state;

  const [phase, setPhase] = useState(rules.phase);
  const [initialBalance, setInitialBalance] = useState(rules.initial_balance);
  const [profitTarget, setProfitTarget] = useState(rules.profit_target);
  const [dailyDrawdown, setDailyDrawdown] = useState(rules.daily_drawdown_limit);
  const [maxDrawdown, setMaxDrawdown] = useState(rules.max_drawdown_limit);
  const [minTradingDays, setMinTradingDays] = useState(rules.min_trading_days);
  const [maxProfitPct, setMaxProfitPct] = useState(rules.max_profit_limit);
  const [cutoffHour, setCutoffHour] = useState(rules.daily_cutoff_hour);

  const [savingRules, setSavingRules] = useState(false);
  const [resettingDay, setResettingDay] = useState(false);
  const [clearingAccount, setClearingAccount] = useState(false);

  const loadFundingPipsPreset = (size: number, challengePhase: number) => {
    setInitialBalance(size);
    setPhase(challengePhase);
    setDailyDrawdown(5.0);
    setMaxDrawdown(10.0);
    setMinTradingDays(3);
    setMaxProfitPct(3.0);
    setCutoffHour(0);
    setProfitTarget(challengePhase === 1 ? size * 0.08 : size * 0.05);
    onShowNotification(`Loaded Funding Pips Phase ${challengePhase} ($${size.toLocaleString()}) presets!`, 'info');
  };

  const handleUpdateRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const response = await fetch('/api/settings/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          initial_balance: initialBalance,
          profit_target: profitTarget,
          daily_drawdown_limit: dailyDrawdown,
          max_drawdown_limit: maxDrawdown,
          min_trading_days: minTradingDays,
          max_profit_limit: maxProfitPct,
          daily_cutoff_hour: cutoffHour
        })
      });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        onShowNotification('Challenge rules updated successfully!', 'success');
      } else {
        alert(data.error || 'Failed to update rules');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setSavingRules(false);
    }
  };

  const handleTriggerDailyReset = async () => {
    setResettingDay(true);
    try {
      const response = await fetch('/api/sync/daily-reset', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        onShowNotification('Daily drawdown reset! Start of day balance updated.', 'success');
      } else {
        alert(data.error || 'Failed to trigger reset');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setResettingDay(false);
    }
  };

  const handleClearAccountData = async () => {
    if (!window.confirm('Are you sure you want to clear all trades and reset the dashboard? This cannot be undone.')) return;
    setClearingAccount(true);
    try {
      const response = await fetch('/api/sync/clear-account', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        onShowNotification('Account cleared! Dashboard reset to fresh state.', 'success');
      } else {
        alert(data.error || 'Failed to clear account');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setClearingAccount(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Quick Presets */}
      <div className="bg-glass rounded-2xl p-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Funding Pips $5K Challenge Quick Presets
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => loadFundingPipsPreset(5000, 1)}
            className="p-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-bold border border-slate-800 hover:border-slate-700/80 rounded-xl transition cursor-pointer"
          >
            $5K Phase 1 (8% target)
          </button>
          <button
            type="button"
            onClick={() => loadFundingPipsPreset(5000, 2)}
            className="p-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-bold border border-slate-800 hover:border-slate-700/80 rounded-xl transition cursor-pointer"
          >
            $5K Phase 2 (5% target)
          </button>
        </div>
      </div>

      {/* Challenge Evaluation Rules */}
      <form onSubmit={handleUpdateRules} className="bg-glass rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3 mb-1">
          <Shield className="text-blue-400 w-4 h-4" /> Challenge Evaluation Rules
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Challenge Phase</label>
            <select
              value={phase}
              onChange={(e) => setPhase(Number(e.target.value))}
              className="w-full text-xs font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
            >
              <option value={1}>Phase 1 (Evaluation)</option>
              <option value={2}>Phase 2 (Verification)</option>
              <option value={3}>Phase 3 (Funded)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Account Size (USD)</label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 5000)}
              className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
              placeholder="5000"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profit Target (USD)</label>
            <input
              type="number"
              value={profitTarget}
              onChange={(e) => setProfitTarget(parseFloat(e.target.value) || 400)}
              className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
              placeholder="400"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Daily Drawdown %</label>
            <input
              type="number"
              step="0.1"
              value={dailyDrawdown}
              onChange={(e) => setDailyDrawdown(parseFloat(e.target.value) || 5)}
              className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
              placeholder="5.0"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max Drawdown %</label>
            <input
              type="number"
              step="0.1"
              value={maxDrawdown}
              onChange={(e) => setMaxDrawdown(parseFloat(e.target.value) || 10)}
              className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
              placeholder="10.0"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Min Trading Days</label>
            <input
              type="number"
              value={minTradingDays}
              onChange={(e) => setMinTradingDays(parseInt(e.target.value) || 3)}
              className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
              placeholder="3"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max 1-Trade Profit %</label>
            <input
              type="number"
              step="0.1"
              value={maxProfitPct}
              onChange={(e) => setMaxProfitPct(parseFloat(e.target.value) || 3)}
              className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
              placeholder="3.0"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Daily Cutoff (UTC)</label>
            <select
              value={cutoffHour}
              onChange={(e) => setCutoffHour(Number(e.target.value))}
              className="w-full text-xs font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
            >
              <option value={0}>00:00 (Midnight UTC)</option>
              <option value={8}>08:00 (London Open)</option>
              <option value={12}>12:00 (NY Open)</option>
              <option value={22}>22:00 (NY Close)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={savingRules}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition duration-150 active:scale-95 cursor-pointer"
        >
          {savingRules ? 'Saving...' : 'Save Challenge Rules'}
        </button>
      </form>

      {/* Account Management */}
      <div className="bg-glass rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3 mb-1">
          <Database className="text-amber-500 w-4 h-4" /> Account Management
        </h3>

        <p className="text-xs text-slate-400">
          Trigger a daily reset to lock in end-of-day balance and start a new session's 5% drawdown limit. Use "Clear Data" to start fresh.
        </p>

        <div className="flex flex-col gap-2">
          <div className="p-3 bg-slate-950/50 rounded-xl text-[11px] text-slate-400">
            Start of Day Balance: <strong className="font-mono text-white">${state.metrics.startOfDayBalance}</strong>
          </div>

          <button
            type="button"
            onClick={handleTriggerDailyReset}
            disabled={resettingDay}
            className="flex items-center justify-center gap-2 p-3 bg-amber-600/95 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition duration-150 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${resettingDay ? 'animate-spin' : ''}`} />
            {resettingDay ? 'Resetting...' : 'Trigger Daily Reset (Start New Session)'}
          </button>

          <button
            type="button"
            onClick={handleClearAccountData}
            disabled={clearingAccount}
            className="flex items-center justify-center gap-2 p-3 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition duration-150 active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            {clearingAccount ? 'Clearing...' : 'Clear All Data & Start Fresh'}
          </button>
        </div>
      </div>

    </div>
  );
}
