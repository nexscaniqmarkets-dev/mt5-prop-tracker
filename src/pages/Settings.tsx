import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Server, RefreshCw, AlertTriangle, CheckCircle, Database, Trash2, ToggleLeft, ToggleRight, Wifi, Terminal, Sliders, Cpu, AlertCircle, Copy, Check } from 'lucide-react';
import { DashboardState } from '../types';

interface SettingsProps {
  state: DashboardState;
  onRefresh: () => Promise<void>;
  onShowNotification: (msg: string, type: 'success' | 'info') => void;
}

export default function Settings({ state, onRefresh, onShowNotification }: SettingsProps) {
  const { rules, broker } = state;

  // Rules form state
  const [phase, setPhase] = useState(rules.phase);
  const [initialBalance, setInitialBalance] = useState(rules.initial_balance);
  const [profitTarget, setProfitTarget] = useState(rules.profit_target);
  const [dailyDrawdown, setDailyDrawdown] = useState(rules.daily_drawdown_limit);
  const [maxDrawdown, setMaxDrawdown] = useState(rules.max_drawdown_limit);
  const [minTradingDays, setMinTradingDays] = useState(rules.min_trading_days);
  const [maxProfitPct, setMaxProfitPct] = useState(rules.max_profit_limit);
  const [cutoffHour, setCutoffHour] = useState(rules.daily_cutoff_hour);

  // Broker Settings form state
  const [login, setLogin] = useState(broker.login);
  const [password, setPassword] = useState('••••••••••••');
  const [serverName, setServerName] = useState(broker.server);

  const [savingRules, setSavingRules] = useState(false);
  const [savingBroker, setSavingBroker] = useState(false);
  const [resettingDay, setResettingDay] = useState(false);
  const [clearingAccount, setClearingAccount] = useState(false);

  // Live direct MT5 Sync states
  const [sandboxEnabled, setSandboxEnabled] = useState(true);
  const [loadingSimulation, setLoadingSimulation] = useState(false);
  const [liveBalance, setLiveBalance] = useState(state.metrics.currentBalance);
  const [liveEquity, setLiveEquity] = useState(state.metrics.equity);
  const [liveMargin, setLiveMargin] = useState(0);
  const [updatingLiveStats, setUpdatingLiveStats] = useState(false);
  const [showSyncScript, setShowSyncScript] = useState(false);

  useEffect(() => {
    const fetchSimulationStatus = async () => {
      try {
        const response = await fetch('/api/settings/simulation-mode');
        const data = await response.json();
        if (data && data.enabled !== undefined) {
          setSandboxEnabled(data.enabled);
        }
      } catch (err) {
        console.error('Failed to load simulation status', err);
      }
    };
    fetchSimulationStatus();
  }, []);

  // Sync snapshot defaults on dashboard updates
  useEffect(() => {
    setLiveBalance(state.metrics.currentBalance);
    setLiveEquity(state.metrics.equity);
  }, [state.metrics.currentBalance, state.metrics.equity]);

  // Default parameters matching Funding Pips Challenge Tiers
  const loadFundingPipsPreset = (size: number, challengePhase: number) => {
    setInitialBalance(size);
    setPhase(challengePhase);
    setDailyDrawdown(5.0); // 5% Standard limit
    setMaxDrawdown(10.0); // 10% Overall Limit
    setMinTradingDays(3);
    setMaxProfitPct(3.0);
    setCutoffHour(0); // UTC midnight reset time

    if (challengePhase === 1) {
      // Phase 1: 8% ($400 for 5K)
      setProfitTarget(size * 0.08);
    } else {
      // Phase 2: 5% ($250 for 5K)
      setProfitTarget(size * 0.05);
    }
    
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
        onShowNotification('Evaluation guidelines updated successfully!', 'success');
      } else {
        alert(data.error || 'Failed to update rules');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setSavingRules(false);
    }
  };

  const handleUpdateBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBroker(true);
    try {
      const response = await fetch('/api/settings/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          password,
          server: serverName
        })
      });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        onShowNotification('Broker MT5 server credentials saved securely!', 'success');
      } else {
        alert(data.error || 'Failed to update broker details');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setSavingBroker(false);
    }
  };

  // Triggers the standard prop-firm daily cutoff where evaluation resets to current balance
  const handleTriggerDailyReset = async () => {
    setResettingDay(true);
    try {
      const response = await fetch('/api/sync/daily-reset', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        onShowNotification('Daily drawdown limits reset! Start Of Day Balance set to current Balance.', 'success');
      } else {
        alert(data.error || 'Failed to trigger reset');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setResettingDay(false);
    }
  };

  // Triggers complete database trade removal to reset account to fully empty state
  const handleClearAccountData = async () => {
    if (!window.confirm('Are you sure you want to completely wipe all simulated trades, positions, histories, and reset this dashboard to a fully clean state? This cannot be undone.')) {
      return;
    }
    setClearingAccount(true);
    try {
      const response = await fetch('/api/sync/clear-account', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        onShowNotification('Account cleared! Dashboard reset to a fresh blank starting point.', 'success');
      } else {
        alert(data.error || 'Failed to clean account');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setClearingAccount(false);
    }
  };

  const [copiedSyncScript, setCopiedSyncScript] = useState(false);

  const pythonSyncScriptText = `import time
import requests
import MetaTrader5 as mt5

# Configuration Parameters
WEBHOOK_URL = "${window.location.origin}/api/webhook/mt5"
LOGIN = ${state.broker?.login || "389456"}               # Connected Fusion Account Login
PASSWORD = "your_mt5_password"       # Replace with your actual password
SERVER = "${state.broker?.server || "FusionMarkets-Demo"}"  # Fusion Markets Server

def sync_terminal_state():
    # Initialize connection to custom broker specifications
    if not mt5.initialize(login=LOGIN, password=PASSWORD, server=SERVER):
        print(f"[WARNING] Named initialization failed. Error: {mt5.last_error()}")
        # Fallback to already logged-in terminal on other server
        print("[INFO] Attempting terminal-level fallback initialization...")
        if not mt5.initialize():
            print(f"[FATAL] Terminal connection failed. Error: {mt5.last_error()}")
            return False
            
    # Fetch core account details
    acc_info = mt5.account_info()
    if acc_info is None:
        print(f"[ERROR] Failed to query account details. Error: {mt5.last_error()}")
        return False
        
    print(f"\\n[Connected] Live Account: {acc_info.login} | Balance: \${acc_info.balance:.2f} | Equity: \${acc_info.equity:.2f}")
    
    # Query active open positions
    open_positions = mt5.positions_get()
    positions_payload = []
    if open_positions:
        for p in open_positions:
            pos_type = "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL"
            # Calculate dynamic percentage gain
            pct_gain = 0.0
            if p.price_open > 0:
                contract_size = 100000 if p.symbol != "XAUUSD" else 100
                pct_gain = (p.profit / (p.price_open * p.volume * contract_size)) * 100
                
            positions_payload.append({
                "id": str(p.ticket),
                "symbol": p.symbol,
                "type": pos_type,
                "entry_price": float(p.price_open),
                "current_price": float(p.price_current),
                "lot_size": float(p.volume),
                "unrealized_pnl": float(p.profit),
                "pct_gain": float(round(pct_gain, 4))
            })
            
    # Query historic deals (past 3 days) to sync closed transactions
    from datetime import datetime, timedelta
    now_dt = datetime.now()
    start_dt = now_dt - timedelta(days=3)
    
    deals = mt5.history_deals_get(start_dt, now_dt)
    closed_deals_payload = []
    if deals:
        for d in deals:
            # Filter out pure balance adjustments or deposit entries
            if d.entry == mt5.DEAL_ENTRY_OUT and d.profit != 0:
                type_str = "BUY" if d.type == mt5.DEAL_TYPE_SELL else "SELL" # opposite of closing deal type
                # Estimate open price approx based on commission/profit math
                closed_deals_payload.append({
                    "id": str(d.ticket),
                    "symbol": d.symbol,
                    "type": type_str,
                    "entry_price": float(d.price), # transaction price, open can be estimated or set equal
                    "exit_price": float(d.price),
                    "lot_size": float(d.volume),
                    "pnl": float(d.profit),
                    "open_time": datetime.fromtimestamp(d.time).isoformat(),
                    "close_time": datetime.fromtimestamp(d.time).isoformat()
                })
                
    # Compile JSON Sync Payload
    sync_data = {
        "balance": float(acc_info.balance),
        "equity": float(acc_info.equity),
        "margin": float(acc_info.margin),
        "free_margin": float(acc_info.margin_free),
        "open_positions": positions_payload,
        "closed_trades": closed_deals_payload
    }
    
    # Post updates directly to our Cloud Applet Webhook
    try:
        response = requests.post(WEBHOOK_URL, json=sync_data, timeout=8)
        if response.status_code == 200:
            print(f"[OK] Synced successfully. Active Trades: {len(positions_payload)}")
        else:
            print(f"[SYNC FAILED] Server status={response.status_code}. Response={response.text}")
    except Exception as exc:
        print(f"[ERROR] Connection timed out / refused. Make sure URL is correct: {exc}")
        
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("        METATRADER 5 AUTO-SYNC CONNECTOR CONNECTED")
    print("=" * 60)
    print("Prerequisites: pip install MetaTrader5 requests")
    print("Keep this terminal window running in the background while trading.")
    
    while True:
        try:
            sync_terminal_state()
        except Exception as err:
            print(f"[EXCEPTION] Loop broken: {err}")
        time.sleep(1.5) # Poll intervals
`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(pythonSyncScriptText);
    setCopiedSyncScript(true);
    onShowNotification('Python auto-sync script copied to clipboard!', 'success');
    setTimeout(() => setCopiedSyncScript(false), 3000);
  };

  const handleToggleSimulation = async (enabled: boolean) => {
    setLoadingSimulation(true);
    try {
      const response = await fetch('/api/settings/simulation-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await response.json();
      if (data.success) {
        setSandboxEnabled(enabled);
        onRefresh();
        onShowNotification(data.message, 'success');
      } else {
        alert(data.error || 'Failed to toggle simulation status');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setLoadingSimulation(false);
    }
  };

  const handleUpdateLiveStats = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingLiveStats(true);
    try {
      const response = await fetch('/api/sync/live-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          balance: Number(liveBalance), 
          equity: Number(liveEquity),
          margin: Number(liveMargin),
          free_margin: Number(liveBalance) - Number(liveMargin)
        })
      });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        onShowNotification('Fusion Markets live stats updated on dashboard!', 'success');
      } else {
        alert(data.error || 'Failed to sync specs');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating data');
    } finally {
      setUpdatingLiveStats(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" id="settings_preferences_page">
      {/* Rapid presets controller tabs */}
      <div className="bg-glass rounded-2xl p-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Funding Pips Standard Challenge Quick Presets
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button 
            type="button" 
            onClick={() => loadFundingPipsPreset(5000, 1)}
            className="p-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-bold border border-slate-800 hover:border-slate-700/80 rounded-xl transition cursor-pointer"
          >
            $5K Std • Phase 1 (8%)
          </button>
          <button 
            type="button" 
            onClick={() => loadFundingPipsPreset(5000, 2)}
            className="p-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-bold border border-slate-800 hover:border-slate-700/80 rounded-xl transition cursor-pointer"
          >
            $5K Std • Phase 2 (5%)
          </button>
          <button 
            type="button" 
            onClick={() => loadFundingPipsPreset(100000, 1)}
            className="p-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-bold border border-slate-800 hover:border-slate-700/80 rounded-xl transition cursor-pointer"
          >
            $100K Challenge • P1
          </button>
          <button 
            type="button" 
            onClick={() => loadFundingPipsPreset(100000, 2)}
            className="p-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-bold border border-slate-800 hover:border-slate-700/80 rounded-xl transition cursor-pointer"
          >
            $100K Challenge • P2
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Challenge Evaluation Rules configuration Form */}
        <form onSubmit={handleUpdateRules} className="bg-glass rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3 mb-1">
            <Shield className="text-blue-400 w-4.5 h-4.5" /> Challenge Evaluation Rules
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Challenge Step</label>
              <select 
                value={phase}
                onChange={(e) => setPhase(Number(e.target.value))}
                className="w-full text-xs font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
              >
                <option value={1}>Phase 1 (Evaluation)</option>
                <option value={2}>Phase 2 (Verification)</option>
                <option value={3}>Phase 3 (Funded Trader)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Challenge Size (USD)</label>
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
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Overall Max Drawdown %</label>
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
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Daily Cutoff Time (GMT/UTC)</label>
              <select 
                value={cutoffHour}
                onChange={(e) => setCutoffHour(Number(e.target.value))}
                className="w-full text-xs font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
              >
                <option value={0}>00:00 (Midnight UTC)</option>
                <option value={8}>08:00 (London Open)</option>
                <option value={12}>12:00 (NY Open)</option>
                <option value={22}>22:00 (NY Close / rollover)</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={savingRules}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition duration-150 active:scale-95 cursor-pointer"
          >
            {savingRules ? 'Saving Evaluation Parameters...' : 'Save Rule Guidelines'}
          </button>
        </form>

        {/* 2. Secure Broker Settings configuration Form (The core requirement) */}
        <form onSubmit={handleUpdateBroker} className="bg-glass rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3 mb-1">
            <Server className="text-emerald-400 w-4.5 h-4.5" /> Broker Server Credentials (MT5 Connection)
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">MetaTrader 5 Log Account Number</label>
              <input 
                type="text" 
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
                placeholder="e.g. 389456"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">MT5 Secure Terminal Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
                placeholder="DemoPassword@123"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Premium Platform Server Name</label>
              <input 
                type="text" 
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="w-full text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg p-2 outline-none focus:border-blue-500"
                placeholder="e.g. FusionMarkets-Demo"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-950/25 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-400/90 leading-relaxed space-y-1">
            {broker.updated_at && (
              <span className="block font-semibold">Last synchronization details:</span>
            )}
            <span className="block text-[10px] text-slate-400">
              Credentials stored securely inside full-stack SQLite database and protected from third-party client visibility.
            </span>
          </div>

          <button 
            type="submit" 
            disabled={savingBroker}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition duration-150 active:scale-95 cursor-pointer"
          >
            {savingBroker ? 'Connecting MT5 Platform...' : 'Save & Hot-Reconnect MT5'}
          </button>
        </form>
      </div>

      {/* 3. Live Account Synchronizer Options (Specifically for Fusion Markets and Direct Live Ticks) */}
      <div className="bg-glass rounded-2xl p-5 space-y-6" id="fusion_markets_sync_panel">
        <div className="border-b border-slate-800 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Wifi className="text-blue-400 w-4.5 h-4.5 animate-pulse" /> Live Broker Sync & Sandbox Controls
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure whether this dashboard displays real connected Fusion Markets metrics or simulated data.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggleSimulation(!sandboxEnabled)}
                disabled={loadingSimulation}
                className={`px-4 py-2 text-xs font-bold rounded-xl border flex items-center gap-2 transition cursor-pointer ${
                  sandboxEnabled
                    ? 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:bg-amber-900/40'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40'
                }`}
              >
                {sandboxEnabled ? <ToggleRight className="w-5 h-5 text-amber-400" /> : <ToggleLeft className="w-5 h-5 text-emerald-400" />}
                {sandboxEnabled ? 'Sandbox Simulated Mode (On)' : 'Live Fusion Markets Mode (On)'}
              </button>
            </div>
          </div>
        </div>

        {/* Display Banner explaining current mode */}
        {sandboxEnabled ? (
          <div className="p-4 bg-amber-950/15 border border-amber-500/10 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-amber-400 block mb-1">Simulated Ticks Mode is Active</strong>
              The backend is currently generating mock EURUSD, GBPUSD and XAUUSD price ticks to simulate interactive fluctuations for demo purposes. Turn this off to completely lock the dashboard to your actual Fusion Markets account metrics.
            </div>
          </div>
        ) : (
          <div className="p-4 bg-blue-950/20 border border-blue-500/25 rounded-xl flex items-start gap-3">
            <Wifi className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-blue-400 block mb-1">Live Integration Mode Active</strong>
              Artificial ticks and sandboxed mock trades have been removed. The dashboard will now exclusively reflect information synced from your connected <strong>Fusion Markets ({broker.login || 'No Login Saved'})</strong> MT5 account.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form for manual sync snapshot override */}
          <form onSubmit={handleUpdateLiveStats} className="space-y-4 bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="text-slate-400 w-4 h-4" /> Live Account Snapshot Override
            </h4>
            <p className="text-[11px] text-slate-400">
              No trades taken on your live account yet? Enter your exact connected Fusion Markets balance parameters below to override the mock values instantly.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Live Account Balance</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-500 font-mono text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={liveBalance}
                    onChange={(e) => setLiveBalance(parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg outline-none focus:border-blue-500"
                    placeholder="5000.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Live Account Equity</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-500 font-mono text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={liveEquity}
                    onChange={(e) => setLiveEquity(parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg outline-none focus:border-blue-500"
                    placeholder="5000.00"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Used Margin (USD)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-500 font-mono text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={liveMargin}
                    onChange={(e) => setLiveMargin(parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 rounded-lg outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={updatingLiveStats}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition duration-150 active:scale-95 cursor-pointer"
            >
              {updatingLiveStats ? 'Syncing...' : 'Force Update Snapshot on Dashboard'}
            </button>
          </form>

          {/* Webhook API & Script Integration instruction block */}
          <div className="space-y-4 bg-slate-950/40 p-4 border border-slate-900 rounded-xl flex flex-col justify-between" id="webhook_automation_instructions">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="text-slate-400 w-4 h-4" /> Automate Real Sync via Webhook
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                To sync trades opened directly in your MetaTrader 5 desktop client, we recommend running a simple Python bridge script in the background of your PC/VPS:
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Your App Secure Webhook URL:</span>
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/webhook/mt5`);
                      onShowNotification('Webhook URL copied!', 'success');
                    }}
                    className="text-[10px] text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Copy URL
                  </button>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800/60 font-mono text-[9.5px] text-blue-300 break-all select-all">
                  {window.location.origin}/api/webhook/mt5
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSyncScript(!showSyncScript)}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 text-[11px] font-bold rounded-xl transition duration-150 flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-sans">
                    🐍 Get Plug-and-Play Python Sync Script
                  </span>
                  <span className="text-xs text-blue-400">{showSyncScript ? 'Hide Script ▲' : 'Show Script Code ▼'}</span>
                </button>

                {showSyncScript && (
                  <div className="space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9.5px] text-emerald-450 font-semibold">Pre-configured for Login #{state.broker?.login}</span>
                      <button
                        type="button"
                        onClick={handleCopyScript}
                        className="py-1 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        {copiedSyncScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedSyncScript ? 'Copied script!' : 'Copy Script'}
                      </button>
                    </div>
                    
                    <div className="relative">
                      <pre className="p-3 bg-slate-950 text-slate-350 font-mono text-[9px] rounded-lg overflow-y-auto max-h-48 border border-slate-900 leading-relaxed select-all">
                        {pythonSyncScriptText}
                      </pre>
                    </div>
                    
                    <p className="text-[10px] text-slate-500 leading-relaxed font-sans text-left">
                      <strong>How to Run:</strong> Install using <code className="bg-slate-900 px-1 py-0.5 rounded text-[9.5px] font-mono text-slate-300">pip install MetaTrader5 requests</code> on a Windows PC/VPS hosting your MT5 terminal, paste this script, insert your MT5 password, and run!
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" /> Webhook Engine Active
              </span>
              <span>Port 3000 Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Daily resets toolkit */}
      <div className="bg-glass rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3 mb-1">
          <Database className="text-amber-500 w-4.5 h-4.5" /> Prop Firm Sandbox Simulator Utilities
        </h3>
        <p className="text-xs text-slate-400">
          Replicate the MT5 server-side timezone rollovers instantly. Triggering a daily reset locks in the end of day balance so you can begin testing a new session's 5% drawdown standard!
        </p>

        <div className="flex flex-col lg:flex-row gap-2">
          <button 
            type="button" 
            onClick={handleTriggerDailyReset}
            disabled={resettingDay}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-amber-600/95 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition duration-150 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${resettingDay ? 'animate-spin' : ''}`} />
            Trigger Daily Cutoff (SOD Reset)
          </button>

          <button 
            type="button" 
            onClick={handleClearAccountData}
            disabled={clearingAccount}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition duration-150 active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            {clearingAccount ? 'Clearing Backend Data...' : 'Clear Demo Data & Start Fresh'}
          </button>
          
          <div className="flex-1 p-3 bg-slate-950/50 rounded-xl text-[11px] text-slate-400 flex items-center">
            <span>
              ℹ️ Benchmark Start of Day: <strong className="font-mono text-white">${state.metrics.startOfDayBalance}</strong> (Used for standard 5% limits check)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
