import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import PositionCalculator from './pages/PositionCalculator';
import { DashboardState } from './types';
import { CheckCircle, AlertCircle, Info, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Core state holding all SQLite-based calculations & trades synced from backend Express router
  const [dashboardState, setDashboardState] = useState<DashboardState | null>(null);

  const fetchDashboardState = async () => {
    try {
      const res = await fetch('/api/dashboard-state');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'The server returned an error during calculation sync.');
      }
      const data = await res.json();
      setDashboardState(data);
      setFetchError(null);
    } catch (err: any) {
      console.error('Error fetching state:', err);
      // Only set error if we don't already have stale dashboard data to display to user
      if (!dashboardState) {
        setFetchError(err.message || 'Failed to fetch current account statistics. Check if the server is starting.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Telegram WebApp Initialization Hook
  useEffect(() => {
    // Check if running inside Telegram Mini App
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      try {
        console.log('Telegram WebApp environment detected');
        tg.ready();
        tg.expand();
        
        // Notify user or match theme colors dynamically
        if (tg.initDataUnsafe?.user) {
          setTelegramUser(tg.initDataUnsafe.user);
        }

        // Apply Telegram theme background colors
        if (tg.themeParams?.bgColor) {
          document.body.style.backgroundColor = tg.themeParams.bgColor;
        }

        // Support Telegram Main Button trigger on standard tabs
        tg.MainButton.setText("🔄 REFRESH MT5 METRICS");
        tg.MainButton.show();
        tg.MainButton.onClick(() => {
          fetchDashboardState();
          showToast('MetaTrader 5 details re-synchronized!', 'info');
        });
      } catch (err) {
        console.error('Telegram Native SDK configuration error:', err);
      }
    } else {
      // Offline fallback demo user for standard browse testing in standard desktop layout
      setTelegramUser({
        first_name: "Demo Account",
        username: "fusion_demo_user",
        photo_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=120&auto=format&fit=crop&q=60"
      });
    }

    // Dynamic initial loading
    fetchDashboardState();

    // High frequency 5s polling intervals to support automated ticking live and breach warning alerts
    const statePoller = setInterval(fetchDashboardState, 5000);
    return () => clearInterval(statePoller);
  }, []);

  const handleManualSync = async () => {
    try {
      const response = await fetch('/api/sync/manual', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        await fetchDashboardState();
        showToast('MT5 server synced successfully', 'success');
      }
    } catch (e: any) {
      showToast('Synchronization error: ' + e.message, 'error');
    }
  };

  const handleClosePosition = async (id: string) => {
    try {
      const response = await fetch('/api/trades/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        await fetchDashboardState();
        showToast(`Position #${id} closed out on MT5`, 'success');
      } else {
        alert(data.error || 'Failed to close trade');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAcknowledgeBreach = async (id: number) => {
    try {
      const response = await fetch('/api/breaches/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        await fetchDashboardState();
        showToast('Rule breach alarm acknowledged', 'info');
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Helper render
  if (loading && !dashboardState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400 p-6 space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
        <div className="text-center">
          <p className="text-sm font-bold text-white tracking-widest uppercase animate-pulse">Connecting Fusion Markets</p>
          <p className="text-xs text-slate-500 mt-1">Downloading live MT5 tickets & snapshots...</p>
        </div>
      </div>
    );
  }

  if (fetchError && !dashboardState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400 p-6 max-w-lg mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full text-center space-y-5 shadow-2xl">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sync Connection Required</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We couldn't connect to the local integration server to load your MetaTrader 5 account statistics. This usually happens while the application server boots or restarts.
            </p>
            {fetchError !== 'true' && (
              <p className="text-[10px] text-slate-500 bg-slate-950 p-2 rounded-lg font-mono text-left break-words overflow-auto max-h-24">
                Error Details: {fetchError}
              </p>
            )}
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                setLoading(true);
                setFetchError(null);
                fetchDashboardState();
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition duration-150 cursor-pointer"
            >
              🔄 Retry Connection
            </button>
            <p className="text-[10px] text-slate-500">
              Wait 5-10 seconds for the node backend to compile fully, then press Retry.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400 p-6 space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
        <div className="text-center">
          <p className="text-sm font-bold text-white tracking-widest uppercase">Preparing Interface</p>
          <p className="text-xs text-slate-500 mt-1">Parsing metrics and compiling charts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto bg-slate-950 min-h-screen text-slate-100 flex flex-col relative pb-32">
      {/* Dynamic Toast notifications banner */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-sm p-3 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-2.5 animate-fadeIn bg-slate-900 border-slate-800">
          {toast.type === 'success' ? (
            <CheckCircle className="text-emerald-500 shrink-0 w-4 h-4" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="text-rose-500 shrink-0 w-4 h-4" />
          ) : (
            <Info className="text-blue-500 shrink-0 w-4 h-4" />
          )}
          <span className="text-xs text-slate-200 font-semibold leading-none">{toast.message}</span>
        </div>
      )}

      {/* Header View Components */}
      <Header 
        state={dashboardState} 
        onRefresh={handleManualSync} 
        telegramUser={telegramUser} 
      />

      {/* Primary Page Layouts */}
      <main className="px-4 flex-1">
        {activeTab === 'dashboard' && (
          <Dashboard 
            state={dashboardState} 
            onRefresh={handleManualSync}
            onClosePosition={handleClosePosition} 
            onAckBreach={handleAcknowledgeBreach}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'trades' && (
          <Trades 
            state={dashboardState} 
            onRefresh={handleManualSync} 
            onClosePosition={handleClosePosition} 
          />
        )}
        {activeTab === 'statistics' && (
          <Statistics state={dashboardState} />
        )}
        {activeTab === 'calculator' && (
          <PositionCalculator state={dashboardState} />
        )}
        {activeTab === 'settings' && (
          <Settings 
            state={dashboardState} 
            onRefresh={fetchDashboardState} 
            onShowNotification={showToast} 
          />
        )}
      </main>

      {/* Bottom Nav Components */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
