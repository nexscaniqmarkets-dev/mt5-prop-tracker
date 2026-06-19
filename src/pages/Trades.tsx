import React, { useState } from 'react';
import { Search, Filter, Calendar, Activity, CheckSquare, Download, Trash, RefreshCw, BookOpen } from 'lucide-react';
import { DashboardState, ClosedTrade, Position } from '../types';

interface TradesProps {
  state: DashboardState;
  onRefresh: () => Promise<void>;
  onClosePosition: (id: string) => Promise<void>;
}

const JOURNAL_TAGS = [
  { value: '', label: 'No tag' },
  { value: 'followed_plan', label: '✅ Followed Plan' },
  { value: 'good_entry', label: '🎯 Good Entry' },
  { value: 'revenge_trade', label: '⚠️ Revenge Trade' },
  { value: 'fomo', label: '⚠️ FOMO Entry' },
  { value: 'early_exit', label: '⏱️ Exited Early' },
  { value: 'overleveraged', label: '⚠️ Overleveraged' },
];

export default function Trades({ state, onRefresh, onClosePosition }: TradesProps) {
  const { openPositions, closedTrades, rules } = state;
  const [searchTerm, setSearchTerm] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const openJournalEditor = (trade: ClosedTrade) => {
    if (expandedTradeId === trade.id) {
      setExpandedTradeId(null);
      return;
    }
    setExpandedTradeId(trade.id);
    setNoteDraft(trade.journal_note || '');
    setTagDraft(trade.journal_tag || '');
  };

  const saveJournalNote = async (tradeId: string) => {
    setSavingNote(true);
    try {
      const response = await fetch('/api/trades/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tradeId, note: noteDraft, tag: tagDraft })
      });
      const data = await response.json();
      if (data.success) {
        await onRefresh();
        setExpandedTradeId(null);
      } else {
        alert(data.error || 'Failed to save journal note');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setSavingNote(false);
    }
  };

  const getTagLabel = (tagValue?: string) => {
    return JOURNAL_TAGS.find(t => t.value === tagValue)?.label || null;
  };

  // Find unique symbols from all trades to populate filter dropdown dynamically
  const uniqueSymbols = React.useMemo(() => {
    const symbols = new Set<string>();
    openPositions.forEach(t => symbols.add(t.symbol));
    closedTrades.forEach(t => symbols.add(t.symbol));
    return Array.from(symbols);
  }, [openPositions, closedTrades]);

  // Filtering Closed Trades
  const filteredClosedTrades = closedTrades.filter(trade => {
    const matchesSearch = trade.id.includes(searchTerm) || trade.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSymbol = symbolFilter === 'ALL' || trade.symbol === symbolFilter;
    const matchesType = typeFilter === 'ALL' || trade.type === typeFilter;
    return matchesSearch && matchesSymbol && matchesType;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="space-y-6 pb-12" id="trades_history_page">
      {/* 1. Header and search filtering toolbar */}
      <div className="bg-glass rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-500" />
            MetaTrader 5 Transaction History
          </h2>
          <button 
            onClick={onRefresh}
            className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Sync MT5
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Ticket, Asset..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs text-white placeholder-slate-500 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl py-2 pl-9 pr-4 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <select 
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="w-full text-xs text-white bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl py-2 pl-9 pr-4 outline-none appearance-none"
              >
                <option value="ALL">All Symbols</option>
                {uniqueSymbols.map(sym => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1">
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full text-xs text-white bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-4 outline-none appearance-none"
              >
                <option value="ALL">All Actions</option>
                <option value="BUY">BUY Order</option>
                <option value="SELL">SELL Order</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Live Positions Sub-table */}
      <div className="bg-glass rounded-2xl p-5" id="trades_active_subset">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
          Active Working Orders ({openPositions.length})
        </h3>

        {openPositions.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 italic">
            No working orders inside MT5 demo app currently.
          </div>
        ) : (
          <div className="space-y-3">
            {openPositions.map(pos => {
              const isProfit = pos.unrealized_pnl >= 0;
              return (
                <div key={pos.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-7 rounded-sm ${pos.type === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <div>
                      <span className="font-bold text-white text-xs">{pos.symbol}</span>
                      <span className="text-[10px] text-slate-500 block">#{pos.id} • {pos.type} {pos.lot_size.toFixed(2)} Vol</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`text-xs font-bold block ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isProfit ? '+' : ''}{formatCurrency(pos.unrealized_pnl)}
                    </span>
                    <span className="text-[9px] text-slate-500 block">Entry: {pos.entry_price.toFixed(pos.symbol === 'USDJPY' ? 3 : 5)}</span>
                  </div>

                  <div className="shrink-0">
                    <button 
                      onClick={() => onClosePosition(pos.id)}
                      className="p-1 px-2.5 bg-red-950/40 hover:bg-red-800 text-red-400 hover:text-white text-[10px] font-semibold border border-red-500/20 rounded-md transition duration-150 cursor-pointer"
                    >
                      Close 
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Closed Trades History List */}
      <div className="bg-glass rounded-2xl p-5" id="trades_closed_history">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Closed Positions Ledger ({filteredClosedTrades.length})
          </h3>
          <span className="text-[10px] text-slate-500">Sorted by time (latest first)</span>
        </div>

        {filteredClosedTrades.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-1">
            <span className="text-lg block">📭</span>
            <p className="text-xs">No records correspond with search Filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 pb-2">
                  <th className="pb-2 font-semibold">TICKET / ASSET</th>
                  <th className="pb-2 font-semibold">ORDER Type</th>
                  <th className="pb-2 font-semibold text-right">SIZE</th>
                  <th className="pb-2 font-semibold text-right">ENTRY / EXIT</th>
                  <th className="pb-2 font-semibold text-right">RESULT USD</th>
                  <th className="pb-2 font-semibold text-right">EXECUTION TIMINGS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredClosedTrades.map((trade) => {
                  const isProfit = trade.pnl >= 0;
                  const maxProfitExceeded = trade.pnl >= rules.initial_balance * (rules.max_profit_limit / 100);
                  const isExpanded = expandedTradeId === trade.id;
                  const tagLabel = getTagLabel(trade.journal_tag);
                  return (
                    <React.Fragment key={trade.id}>
                    <tr
                      onClick={() => openJournalEditor(trade)}
                      className="hover:bg-slate-800/10 transition duration-150 cursor-pointer"
                    >
                      <td className="py-3 font-mono">
                        <span className="text-[10px] text-slate-500 block">#{trade.id}</span>
                        <span className="text-slate-200 mt-0.5 block font-bold">{trade.symbol}</span>
                        {(trade.journal_note || tagLabel) && (
                          <span className="flex items-center gap-1 text-[9px] text-blue-400 mt-1">
                            <BookOpen className="w-2.5 h-2.5" /> {tagLabel || 'Noted'}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${trade.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {trade.type}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono text-slate-300">{trade.lot_size.toFixed(2)}</td>
                      <td className="py-3 text-right font-mono text-slate-400">
                        <span className="block text-slate-300">{trade.entry_price.toFixed(trade.symbol === 'USDJPY' ? 3 : 5)}</span>
                        <span className="block text-[10px] text-slate-500">{trade.exit_price.toFixed(trade.symbol === 'USDJPY' ? 3 : 5)}</span>
                      </td>
                      <td className="py-3 text-right font-mono">
                        <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}{formatCurrency(trade.pnl)}
                        </span>
                        {maxProfitExceeded && (
                          <span className="block text-[9px] text-amber-400 font-sans" title="Maximum single trade profit exceeded rule target">
                            ⚠️ &gt;{rules.max_profit_limit}% limit warning
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono text-slate-500 text-[10px]">
                        <span className="block text-slate-400">{formatDate(trade.close_time)}</span>
                        <span className="block text-[9px] text-slate-600">Opened: {formatDate(trade.open_time)}</span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-slate-900/60 p-4">
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tag this trade</label>
                              <select
                                value={tagDraft}
                                onChange={(e) => setTagDraft(e.target.value)}
                                className="w-full text-xs font-bold text-white bg-slate-800 border border-slate-700 rounded-lg p-2 outline-none focus:border-blue-500"
                              >
                                {JOURNAL_TAGS.map(t => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Journal note</label>
                              <textarea
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="What was your reasoning? What would you do differently?"
                                rows={3}
                                className="w-full text-xs text-white bg-slate-800 border border-slate-700 rounded-lg p-2 outline-none focus:border-blue-500 resize-none"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveJournalNote(trade.id)}
                                disabled={savingNote}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition active:scale-95"
                              >
                                {savingNote ? 'Saving...' : 'Save Note'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setExpandedTradeId(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
