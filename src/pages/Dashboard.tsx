import React from 'react';
import { 
  TrendingUp, TrendingDown, Clock, ShieldAlert, BadgeInfo, 
  RefreshCw, ChevronRight, Activity, Zap
} from 'lucide-react';
import { DashboardState, Position } from '../types';

interface DashboardProps {
  state: DashboardState;
  onRefresh: () => Promise<void>;
  onClosePosition: (id: string) => Promise<void>;
  onAckBreach: (id: number) => Promise<void>;
  setActiveTab?: (tab: string) => void;
}

export default function Dashboard({ state, onRefresh, onClosePosition, onAckBreach, setActiveTab }: DashboardProps) {
  const { metrics, openPositions, rules, broker, breachAlerts } = state;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val);
  };

  // Profit target calculations
  const profitTargetCash = rules.profit_target;
  const currentProfitCash = metrics.profitCash;
  const profitPct = Math.min(120, Math.max(0, metrics.profitProgressPct));
  
  // Progress Bar color matching constraints
  const getProfitProgressColor = (pct: number) => {
    if (pct <= 0) return 'bg-slate-700';
    if (pct < 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Daily drawdown metrics
  const dailyDrawdownPct = metrics.dailyDrawdownPct;
  const getDailyDrawdownColor = (pct: number) => {
    if (pct < 3) return 'bg-green-500';
    if (pct < 5) return 'bg-amber-500';
    return 'bg-red-500';
  };
  const getDailyDrawdownProgressColor = (pct: number) => {
    if (pct < 3) return 'from-emerald-600 to-green-500';
    if (pct < 5) return 'from-amber-600 to-yellow-500';
    return 'from-red-700 to-rose-500';
  };

  // Overall drawdown metrics
  const totalDrawdownPct = metrics.totalDrawdownPct;
  const getTotalDrawdownColor = (pct: number) => {
    if (pct < 6) return 'bg-green-500';
    if (pct < 10) return 'bg-amber-500';
    return 'bg-red-500';
  };
  const getTotalDrawdownProgressColor = (pct: number) => {
    if (pct < 6) return 'from-emerald-600 to-green-500';
    if (pct < 10) return 'from-amber-600 to-yellow-500';
    return 'from-red-700 to-rose-500';
  };

  return (
    <div className="space-y-6 pb-12" id="dashboard_page">
      {/* 1. Alarms/Breaches Banner alert */}
      {breachAlerts.length > 0 && (
        <div className="space-y-3" id="breach_notification_section">
          {breachAlerts.map(alert => (
            <div key={alert.id} className="p-4 bg-red-950/80 border border-red-500/40 rounded-xl flex items-start gap-3 shadow-lg shadow-red-950/20 backdrop-blur-md animate-pulse">
              <ShieldAlert className="text-red-500 w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <span className="font-bold text-red-400 block mb-1">
                  {alert.rule_name === 'DAILY_DRAWDOWN' ? '⚠️ DAILY LOSS LIMIT BREACHED' : '❌ MAXIMUM DRAWDOWN BREACHED'}
                </span>
                <p className="text-slate-300 leading-relaxed text-xs">{alert.info}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Occurred: {new Date(alert.timestamp).toLocaleTimeString()}</span>
                  <button 
                    onClick={() => onAckBreach(alert.id)}
                    className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white font-medium rounded-md transition duration-200 cursor-pointer"
                  >
                    Acknowledge Limit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Top Header Widget */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-glass rounded-2xl p-5" id="dashboard_hero">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-emerald-500 text-xs px-2.5 py-0.5 font-bold rounded-full bg-emerald-500/10 border border-emerald-500/20">
              Funding Pips Challenge
            </span>
            <span className="text-blue-400 text-xs px-2.5 py-0.5 font-bold rounded-full bg-blue-500/10 border border-blue-500/20">
              Phase {rules.phase} Standard
            </span>
            {state.sandboxSimulationEnabled ? (
              <span className="text-amber-400 text-xs px-2.5 py-0.5 font-bold rounded-full bg-amber-500/10 border border-amber-500/20">
                Sandbox Mode
              </span>
            ) : (
              <span className="text-cyan-400 text-xs px-2.5 py-0.5 font-bold rounded-full bg-cyan-500/10 border border-cyan-500/20 animate-pulse">
                Direct Sync Active
              </span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            MT5 Integration Dashboard
            <span className="text-xs font-normal text-slate-400 font-mono">#{broker.login}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {state.sandboxSimulationEnabled ? (
              <span>Connected to <span className="font-semibold text-slate-300 font-mono">{broker.server}</span> • Syncs every 5s</span>
            ) : (
              <span>Webhook API Direct Sync Mode • <span className="text-cyan-400 font-semibold font-mono">Ready for client ticks</span></span>
            )}
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto shrink-0">
          <button 
            onClick={onRefresh}
            className="flex items-center justify-center p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition duration-200 cursor-pointer"
            title="Manual Sync MT5"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Account Balance Statistics Board */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" id="prop_summary_cards">
        <div className="bg-glass rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Balance</span>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-white block">
              {formatCurrency(metrics.currentBalance)}
            </span>
          </div>
        </div>

        <div className="bg-glass rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Equity</span>
          <div className="mt-1">
            <span className={`text-lg font-bold font-mono block ${metrics.equity >= metrics.currentBalance ? 'text-emerald-400' : 'text-amber-400'}`}>
              {formatCurrency(metrics.equity)}
            </span>
          </div>
        </div>

        <div className="bg-glass rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Peak Balance</span>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-white block">
              {formatCurrency(metrics.peakBalance)}
            </span>
          </div>
        </div>

        <div className="bg-glass rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Daily Margin P&L</span>
          <div className="mt-1">
            {metrics.dailyDrawdownPct > 0 ? (
              <span className="text-lg font-bold font-mono text-rose-400 block">
                -{formatCurrency(metrics.dailyDrawdownCash)}
              </span>
            ) : (
              <span className="text-lg font-bold font-mono text-emerald-400 block">
                +{formatCurrency(Math.max(0, metrics.currentBalance - metrics.startOfDayBalance))}
              </span>
            )}
          </div>
        </div>

        <div className="bg-glass rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Overall Return</span>
          <div className="mt-1">
            <span className={`text-base font-bold font-mono block ${metrics.profitCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {metrics.profitCash >= 0 ? '+' : ''}{formatCurrency(metrics.profitCash)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {metrics.profitCash >= 0 ? '+' : ''}{((metrics.profitCash / rules.initial_balance) * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="bg-glass rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Trading Days</span>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-white block">
              {metrics.tradingDaysCompleted} <span className="text-xs text-slate-400 font-normal">/ {metrics.minTradingDaysRequired} min</span>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Active Progress metrics panel (Drawdowns & Targets) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="progress_bars_panel">
        {/* Profit Target progress */}
        <div className="bg-glass rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-400 block">PROFIT PROGRESS TARGET</span>
              <h4 className="text-base font-bold text-white mt-1">
                {formatCurrency(currentProfitCash)} <span className="text-xs text-slate-400 font-normal">/ {formatCurrency(profitTargetCash)} target</span>
              </h4>
            </div>
            <span className={`px-2 py-0.5 text-xs font-bold font-mono rounded ${currentProfitCash >= profitTargetCash ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-300'}`}>
              {metrics.profitProgressPct.toFixed(1)}%
            </span>
          </div>
          
          <div className="space-y-1.5">
            <div className="relative h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${getProfitProgressColor(metrics.profitProgressPct)}`}
                style={{ width: `${profitPct}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Start: {formatCurrency(rules.initial_balance)}</span>
              <span>Target: {formatCurrency(rules.initial_balance + rules.profit_target)}</span>
            </div>
          </div>
        </div>

        {/* Daily drawdown limit progress */}
        <div className="bg-glass rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-400 block">DAILY DRAWDOWN LIMIT</span>
              <h4 className="text-base font-bold text-white mt-1">
                {dailyDrawdownPct.toFixed(2)}% <span className="text-xs text-slate-400 font-normal">/ {rules.daily_drawdown_limit}% limit</span>
              </h4>
            </div>
            <span className={`px-2 py-0.5 text-xs font-bold font-mono rounded ${getDailyDrawdownColor(dailyDrawdownPct)} bg-opacity-10 border border-current`}>
              {formatCurrency(metrics.dailyDrawdownCash)} max loss
            </span>
          </div>
          
          <div className="space-y-1.5">
            <div className="relative h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r transition-all duration-500 ${getDailyDrawdownProgressColor(dailyDrawdownPct)}`}
                style={{ width: `${Math.min(100, (dailyDrawdownPct / rules.daily_drawdown_limit) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Equity/Balance low today: {formatCurrency(Math.min(metrics.currentBalance, metrics.equity))}</span>
              <span>Daily Limit Cutoff: {rules.daily_cutoff_hour}:00 UTC</span>
            </div>
          </div>
        </div>

        {/* Overall drawdown progress */}
        <div className="bg-glass rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-400 block">MAXIMUM DRAWDOWN LIMIT</span>
              <h4 className="text-base font-bold text-white mt-1">
                {totalDrawdownPct.toFixed(2)}% <span className="text-xs text-slate-400 font-normal">/ {rules.max_drawdown_limit}% limit</span>
              </h4>
            </div>
            <span className={`px-2 py-0.5 text-xs font-bold font-mono rounded ${getTotalDrawdownColor(totalDrawdownPct)} bg-opacity-10 border border-current`}>
              {formatCurrency(metrics.totalDrawdownCash)} max loss
            </span>
          </div>
          
          <div className="space-y-1.5">
            <div className="relative h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r transition-all duration-500 ${getTotalDrawdownProgressColor(totalDrawdownPct)}`}
                style={{ width: `${Math.min(100, (totalDrawdownPct / rules.max_drawdown_limit) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Peak Balance: {formatCurrency(metrics.peakBalance)}</span>
              <span>Breach Value: {formatCurrency(rules.initial_balance - (rules.initial_balance * rules.max_drawdown_limit / 100))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Active Forex Market Positions */}
      <div className="bg-glass rounded-2xl p-5" id="open_positions_widget">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400 animate-spin" /> Live Open Positions ({openPositions.length})
          </h3>
          <span className="text-xs text-slate-400 font-mono">Ticking Live</span>
        </div>

        {openPositions.length === 0 ? (
          <div className="py-8 px-4 text-center text-slate-400 space-y-4 border border-dashed border-slate-800 rounded-xl">
            <div className="space-y-1">
              <BadgeInfo className="w-6 h-6 mx-auto text-slate-500" />
              <p className="text-xs font-semibold text-slate-300">No open trades on MetaTrader 5 server at this time.</p>
              <p className="text-[10px] text-slate-500">
                Direct MT5 integration mode is active. Trades placed on your Fusion Markets MT5 account will appear here automatically.
              </p>
            </div>
            
            {!state.sandboxSimulationEnabled && (
              <div className="max-w-md mx-auto p-3.5 bg-blue-950/25 border border-blue-500/15 rounded-xl text-left space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="p-1 rounded-md bg-blue-500/15 text-blue-400 shrink-0 mt-0.5">🚀</span>
                  <div>
                    <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Want your MetaTrader 5 trades to reflect instantly?</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                      Since your MT5 terminal runs locally on your PC or VPS, the cloud server cannot fetch trades without a bridge. 
                      You can instantly connect them by running our lightweight, <strong>plug-and-play Python background script</strong>. It will sync your trades and account stats in real time!
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                  <span className="text-[9px] text-slate-500 font-mono select-all">API: {window.location.origin}/api/webhook/mt5</span>
                  {setActiveTab && (
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center cursor-pointer"
                    >
                      Get Python Script →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 pb-2">
                  <th className="pb-2 font-semibold">TICKET / SYMBOL</th>
                  <th className="pb-2 font-semibold">TYPE</th>
                  <th className="pb-2 font-semibold text-right">LOTS</th>
                  <th className="pb-2 font-semibold text-right">ENTRY Price</th>
                  <th className="pb-2 font-semibold text-right">CURRENT Price</th>
                  <th className="pb-2 font-semibold text-right text-blue-400">FLOAT P&L</th>
                  <th className="pb-2 font-semibold text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {openPositions.map((pos) => {
                  const isBuy = pos.type === 'BUY';
                  const isPositive = pos.unrealized_pnl >= 0;
                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/20">
                      <td className="py-3 font-mono">
                        <span className="text-[10px] text-slate-500 block">#{pos.id}</span>
                        <span className="text-slate-200 mt-0.5 block font-bold">{pos.symbol}</span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'}`}>
                          {pos.type}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-slate-300">{pos.lot_size.toFixed(2)}</td>
                      <td className="py-3 text-right font-mono text-slate-400">{pos.entry_price.toFixed(pos.symbol === 'USDJPY' ? 3 : pos.symbol === 'XAUUSD' ? 2 : 5)}</td>
                      <td className="py-3 text-right font-mono text-slate-200">{pos.current_price.toFixed(pos.symbol === 'USDJPY' ? 3 : pos.symbol === 'XAUUSD' ? 2 : 5)}</td>
                      <td className={`py-3 text-right font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(pos.unrealized_pnl)}
                        <span className="block text-[9px] text-slate-400">{(pos.unrealized_pnl / (rules.initial_balance) * 100).toFixed(2)}%</span>
                      </td>
                      <td className="py-3 text-right">
                        <button 
                          onClick={() => onClosePosition(pos.id)}
                          className="px-2.5 py-1 bg-red-950/40 hover:bg-red-800 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 rounded-md transition duration-150 text-[10px] cursor-pointer"
                        >
                          Close MT5
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Static Quick Statistics Highlights */}
      <div className="bg-glass rounded-2xl p-5" id="stats_highlights_widget">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap className="text-yellow-400 w-4 h-4" /> Quick Performance Indicators
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Trading Win Rate</span>
            <div className="text-lg font-bold text-white mt-1 font-mono">{metrics.winRate.toFixed(1)}%</div>
            <p className="text-[10px] text-slate-500">Targeting 50%+ for standard profit factors</p>
          </div>

          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Win/Loss Factor</span>
            <div className="text-lg font-bold text-white mt-1 font-mono">
              {metrics.profitFactor === 0 ? 'N/A' : metrics.profitFactor.toFixed(2)}
            </div>
            <p className="text-[10px] text-slate-500">Above 1.5 is a recommended target</p>
          </div>

          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Avg Trade Result</span>
            <div className="text-lg font-bold mt-1 font-mono text-emerald-400">
              {formatCurrency(metrics.averageWin)} <span className="text-xs text-slate-400">win</span>
            </div>
            <p className="text-[10px] font-mono text-rose-400">-{formatCurrency(metrics.averageLoss)} loss</p>
          </div>

          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Winning Streak</span>
            <div className="text-lg font-bold mt-1 font-mono text-slate-100">{metrics.winningStreak} wins</div>
            <p className="text-[10px] text-slate-500">Max losses streak: {metrics.losingStreak} trades</p>
          </div>
        </div>
      </div>
    </div>
  );
}
