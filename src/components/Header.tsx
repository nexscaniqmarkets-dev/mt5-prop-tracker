import React, { useState, useEffect } from 'react';
import { Shield, Radio, Sparkles, User, RefreshCw } from 'lucide-react';
import { DashboardState } from '../types';

interface HeaderProps {
  state: DashboardState;
  onRefresh: () => Promise<void>;
  telegramUser?: { first_name?: string; username?: string; photo_url?: string } | null;
}

export default function Header({ state, onRefresh, telegramUser }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatClock = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <header className="flex justify-between items-center bg-slate-900/40 p-4 border-b border-slate-900 rounded-b-2xl mb-4 max-w-lg mx-auto" id="top_app_header">
      <div className="flex items-center gap-2.5">
        <div className="relative">
          {telegramUser?.photo_url ? (
            <img 
              src={telegramUser.photo_url} 
              alt="Telegram Profiling" 
              className="w-10 h-10 rounded-full border border-blue-500/30 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-indigo-900 border border-slate-700 flex items-center justify-center">
              <User className="text-indigo-400 w-5 h-5" />
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full animate-ping"></span>
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border border-slate-950 rounded-full"></span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-400" />
            MT5 Fusion Markets LIVE
          </span>
          <h1 className="text-xs font-bold text-slate-100 flex items-center gap-1">
            {telegramUser ? `Hello, ${telegramUser.first_name || telegramUser.username}` : 'Democount Observer'}
            <Sparkles className="text-yellow-400 w-3 h-3" />
          </h1>
        </div>
      </div>

      <div className="text-right">
        <span className="text-xs font-mono font-extrabold text-white block">
          {formatClock(time)} <span className="text-[9px] text-slate-400 font-normal">GMT</span>
        </span>
        <span className="text-[10px] text-slate-400">
          Broker sync live
        </span>
      </div>
    </header>
  );
}
