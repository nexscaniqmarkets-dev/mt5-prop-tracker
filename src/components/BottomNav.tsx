import React from 'react';
import { LayoutDashboard, CheckSquare, BarChart3, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trades', label: 'Trades', icon: CheckSquare },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-slate-950/85 backdrop-blur-md border-t border-slate-900 shadow-2xl py-2 px-6 flex justify-between items-center z-50 max-w-lg mx-auto rounded-t-2xl"
      id="telegram_bottom_navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center justify-center space-y-1 py-1.5 px-3 rounded-xl transition duration-150 cursor-pointer group"
          >
            <div className={`p-1.5 rounded-xl transition duration-200 ${isActive ? 'bg-blue-600/15 text-blue-400 scale-110' : 'text-slate-400 group-hover:text-slate-300'}`}>
              <Icon className="w-5 h-5 shrink-0" />
            </div>
            <span className={`text-[10px] font-bold tracking-tight transition duration-150 ${isActive ? 'text-blue-400 font-extrabold' : 'text-slate-400'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
