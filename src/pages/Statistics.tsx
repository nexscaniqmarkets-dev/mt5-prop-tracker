import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Landmark, TrendingUp, TrendingDown, DollarSign, Award, Percent, ClipboardList, Target } from 'lucide-react';
import { DashboardState } from '../types';

interface StatisticsProps {
  state: DashboardState;
}

export default function Statistics({ state }: StatisticsProps) {
  const { metrics, closedTrades, rules } = state;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val);
  };

  // 1. Calculate historical balance dataset for Recharts AreaChart
  const balanceData = React.useMemo(() => {
    const data: { tradeIndex: number; ticket: string; value: number }[] = [];
    let runningBalance = rules.initial_balance;
    
    // Add point zero (starting point)
    data.push({
      tradeIndex: 0,
      ticket: 'Start',
      value: runningBalance
    });

    // Chronologically add closed trades
    const sortedTrades = [...closedTrades].sort((a, b) => {
      const aTime = a.close_time ? new Date(a.close_time).getTime() : 0;
      const bTime = b.close_time ? new Date(b.close_time).getTime() : 0;
      return aTime - bTime;
    });

    sortedTrades.forEach((trade, index) => {
      runningBalance += trade.pnl;
      data.push({
        tradeIndex: index + 1,
        ticket: trade.symbol,
        value: parseFloat(runningBalance.toFixed(2))
      });
    });

    return data;
  }, [closedTrades, rules.initial_balance]);

  // 2. Prepare bar dataset for win/loss categorization
  const performanceBars = React.useMemo(() => {
    const counts = { WIN: 0, LOSS: 0 };
    closedTrades.forEach(t => {
      if (t.pnl >= 0) counts.WIN++;
      else counts.LOSS++;
    });

    return [
      { name: 'Wins', value: counts.WIN, color: '#10b981' },
      { name: 'Losses', value: counts.LOSS, color: '#ef4444' }
    ];
  }, [closedTrades]);

  return (
    <div className="space-y-6 pb-12" id="statistics_details_page">
      {/* Top visual charts block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Balance growth curve line */}
        <div className="lg:col-span-2 bg-glass rounded-2xl p-5 space-y-4">
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Account Balance Growth Curve</span>
            <h4 className="text-sm font-semibold text-slate-200 mt-1">Challenge Progression Analysis</h4>
          </div>

          <div className="h-64 w-full" id="growth_curve_chart_container">
            <ResponsiveContainer width="105%" height="100%">
              <AreaChart data={balanceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="tradeIndex" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  label={{ value: 'Trade Sequential Sequence', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  domain={['dataMin - 150', 'dataMax + 150']}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }}
                  labelFormatter={(idx) => `Trade ${idx}`}
                  formatter={(value: any) => [`$${value}`, 'Balance']}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win/Loss categorization distribution bar */}
        <div className="bg-glass rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Win Ratio Distribution</span>
            <h4 className="text-sm font-semibold text-slate-200 mt-1">Closed Orders Breakdown</h4>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceBars} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                  formatter={(value: any) => [value, 'TradesCount']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {performanceBars.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Overall Win Rate</span>
            <span className="text-emerald-400 font-mono font-bold text-base">{metrics.winRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Grid containing 8 fine prop firm evaluation metric panels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="stats_dashboard_bento">
        {/* Win Rate */}
        <div className="bg-glass rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Trading Win Rate</span>
            <h4 className="text-lg font-bold text-white font-mono mt-1">{metrics.winRate.toFixed(1)}%</h4>
            <span className="text-[9px] text-slate-500 block mt-0.5">Based on closed trades</span>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-glass rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Profit Factor</span>
            <h4 className="text-lg font-bold text-white font-mono mt-1">
              {metrics.profitFactor === 0 ? 'N/A' : metrics.profitFactor.toFixed(2)}
            </h4>
            <span className="text-[9px] text-slate-500 block mt-0.5">Gross gains / Gross losses</span>
          </div>
        </div>

        {/* Average Gain */}
        <div className="bg-glass rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Average Win</span>
            <h4 className="text-lg font-bold text-emerald-400 font-mono mt-1">{formatCurrency(metrics.averageWin)}</h4>
            <span className="text-[9px] text-slate-500 block mt-0.5">Normalized win returns</span>
          </div>
        </div>

        {/* Average Loss */}
        <div className="bg-glass rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Average Loss</span>
            <h4 className="text-lg font-bold text-rose-400 font-mono mt-1">-{formatCurrency(metrics.averageLoss)}</h4>
            <span className="text-[9px] text-slate-500 block mt-0.5">Expected loss average</span>
          </div>
        </div>

        {/* Largest Win */}
        <div className="bg-glass rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Largest Win</span>
            <h4 className="text-lg font-bold text-emerald-400 font-mono mt-1">+{formatCurrency(metrics.largestWin)}</h4>
            <span className="text-[9px] text-slate-500 block mt-0.5">Single transaction peak</span>
          </div>
        </div>

        {/* Largest Loss */}
        <div className="bg-glass rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Largest Loss</span>
            <h4 className="text-lg font-bold text-rose-400 font-mono mt-1">-{formatCurrency(metrics.largestLoss)}</h4>
            <span className="text-[9px] text-slate-500 block mt-0.5">Worst transaction drawdown</span>
          </div>
        </div>

        {/* Total positions count */}
        <div className="bg-glass rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-slate-800 text-slate-300 rounded-lg">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Trades</span>
            <h4 className="text-lg font-bold text-white font-mono mt-1">{metrics.totalTradesOverall}</h4>
            <span className="text-[9px] text-slate-500 block mt-0.5">{metrics.totalTradesToday} transaction(s) today</span>
          </div>
        </div>

        {/* Challenge Evaluation Requirements Badge */}
        <div className="bg-glass rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Daily Loss Goal</span>
            <h4 className="text-base font-bold text-slate-200 mt-1">Max 5% Loss</h4>
            <span className="text-[9px] text-slate-500 block mt-0.5">Funding Pips standard limit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
