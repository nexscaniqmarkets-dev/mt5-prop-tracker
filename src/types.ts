export interface Metrics {
  currentBalance: number;
  peakBalance: number;
  equity: number;
  initialBalance: number;
  profitTarget: number;
  tradingDaysCompleted: number;
  minTradingDaysRequired: number;

  totalDrawdownPct: number;
  dailyDrawdownPct: number;
  profitProgressPct: number;

  totalDrawdownCash: number;
  dailyDrawdownCash: number;
  profitCash: number;
  startOfDayBalance: number;

  dailyDrawdownBreached: boolean;
  maxDrawdownBreached: boolean;

  winRate: number;
  totalTradesOverall: number;
  totalTradesToday: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  winningStreak: number;
  losingStreak: number;
}

export interface Position {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entry_price: number;
  current_price: number;
  lot_size: number;
  unrealized_pnl: number;
  pct_gain: number;
  open_time: string;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number;
  lot_size: number;
  pnl: number;
  open_time: string;
  close_time: string;
}

export interface Rules {
  id?: number;
  phase: number;
  initial_balance: number;
  profit_target: number;
  daily_drawdown_limit: number;
  max_drawdown_limit: number;
  min_trading_days: number;
  max_profit_limit: number;
  daily_cutoff_hour: number;
}

export interface Broker {
  id?: number;
  login: string;
  server: string;
  updated_at: string;
}

export interface BreachAlert {
  id: number;
  rule_name: 'DAILY_DRAWDOWN' | 'MAX_DRAWDOWN';
  info: string;
  limit_value: number;
  current_value: number;
  timestamp: string;
  acknowledged: number;
}

export interface DashboardState {
  metrics: Metrics;
  openPositions: Position[];
  closedTrades: ClosedTrade[];
  rules: Rules;
  broker: Broker;
  breachAlerts: BreachAlert[];
  sandboxSimulationEnabled?: boolean;
}
