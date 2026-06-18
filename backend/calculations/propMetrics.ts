export interface Trade {
  id: string;
  symbol: string;
  type: string;
  entry_price: number;
  exit_price?: number;
  current_price?: number;
  lot_size: number;
  pnl: number;
  open_time: string;
  close_time?: string;
}

export interface Rule {
  phase: number;
  initial_balance: number;
  profit_target: number;
  daily_drawdown_limit: number;
  max_drawdown_limit: number;
  min_trading_days: number;
  max_profit_limit: number;
  daily_cutoff_hour: number;
}

export interface AccountState {
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  peak_balance: number;
  start_of_day_balance: number;
  last_sync_time: string;
}

export interface CalculateMetricsResult {
  currentBalance: number;
  peakBalance: number;
  equity: number;
  initialBalance: number;
  profitTarget: number;
  tradingDaysCompleted: number;
  minTradingDaysRequired: number;
  
  // Progress/Drawdown percentages
  totalDrawdownPct: number;
  dailyDrawdownPct: number;
  profitProgressPct: number;

  // Actual values in cash
  totalDrawdownCash: number;
  dailyDrawdownCash: number;
  profitCash: number;
  startOfDayBalance: number;

  // Breach states
  dailyDrawdownBreached: boolean;
  maxDrawdownBreached: boolean;

  // Stats
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

export function calculateMetrics(
  state: AccountState,
  rules: Rule,
  closedTrades: Trade[],
  openPositions: Trade[]
): CalculateMetricsResult {
  const initialBalance = rules.initial_balance || 5000.0;
  const currentBalance = state.balance;
  const equity = state.equity;
  const peakBalance = Math.max(state.peak_balance, currentBalance);
  const startOfDayBalance = state.start_of_day_balance;
  const profitTarget = rules.profit_target;

  // Drawdowns
  // Peak Balance is highest achieved balance
  // Total Drawdown relative to initial balance is: (Peak Balance - Current Balance) / Initial Balance * 100
  // Note: Standard prop firms also track equity-based drawdown. Let's calculate based on current balance or equity (whichever draws down more, i.e., lowest of balance or equity) to be safe and accurate!
  const lowestAccountVal = Math.min(currentBalance, equity);
  
  const totalDrawdownCash = Math.max(0, peakBalance - lowestAccountVal);
  const totalDrawdownPct = initialBalance > 0 ? (totalDrawdownCash / initialBalance) * 100 : 0;

  // Daily Drawdown: relative to start of day balance
  const dailyDrawdownCash = Math.max(0, startOfDayBalance - lowestAccountVal);
  const dailyDrawdownPct = startOfDayBalance > 0 ? (dailyDrawdownCash / startOfDayBalance) * 100 : 0;

  // Progress to Profit Target: (Current Balance - Initial Balance) / Profit Target * 100
  const profitCash = currentBalance - initialBalance;
  const profitProgressPct = profitTarget > 0 ? (profitCash / profitTarget) * 100 : 0;

  // Breach checks
  const dailyDrawdownBreached = dailyDrawdownPct >= rules.daily_drawdown_limit;
  const maxDrawdownBreached = totalDrawdownPct >= rules.max_drawdown_limit;

  // Trading Days Completed
  // Unique calendar days with at least 1 closed or open trade
  const tradeDates = new Set<string>();
  
  const allTrades = [...closedTrades, ...openPositions];
  allTrades.forEach(t => {
    if (t.open_time) {
      const dateStr = t.open_time.split('T')[0];
      tradeDates.add(dateStr);
    }
    if (t.close_time) {
      const dateStr = t.close_time.split('T')[0];
      tradeDates.add(dateStr);
    }
  });

  const tradingDaysCompleted = tradeDates.size;

  // Trades completed today (UTC/local day count)
  const todayStr = new Date().toISOString().split('T')[0];
  const totalTradesToday = closedTrades.filter(t => {
    return t.close_time && t.close_time.startsWith(todayStr);
  }).length;

  // Metrics on closed trades
  const totalTradesOverall = closedTrades.length;
  let wins = 0;
  let losses = 0;
  let sumWin = 0;
  let sumLoss = 0;
  let largestWin = 0;
  let largestLoss = 0;

  closedTrades.forEach(t => {
    if (t.pnl > 0) {
      wins++;
      sumWin += t.pnl;
      if (t.pnl > largestWin) largestWin = t.pnl;
    } else if (t.pnl < 0) {
      losses++;
      sumLoss += Math.abs(t.pnl);
      if (t.pnl < largestLoss) largestLoss = t.pnl; // Note: t.pnl is negative, largestLoss matches most negative value
    }
  });

  // Streaks calculations
  let winningStreak = 0;
  let losingStreak = 0;
  
  // Sort closed trades by close_time ascending to trace historical sequences
  const chronologicalTrades = [...closedTrades].sort((a, b) => {
    const aTime = a.close_time ? new Date(a.close_time).getTime() : 0;
    const bTime = b.close_time ? new Date(b.close_time).getTime() : 0;
    return aTime - bTime;
  });

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  
  chronologicalTrades.forEach(t => {
    if (t.pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > winningStreak) winningStreak = currentWinStreak;
    } else if (t.pnl < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > losingStreak) losingStreak = currentLossStreak;
    }
  });

  // Win Rate
  const winRate = totalTradesOverall > 0 ? (wins / totalTradesOverall) * 100 : 0;

  // Averages
  const averageWin = wins > 0 ? sumWin / wins : 0;
  const averageLoss = losses > 0 ? sumLoss / losses : 0;

  // Profit Factor
  const profitFactor = sumLoss > 0 ? sumWin / sumLoss : sumWin > 0 ? sumWin : 0;

  return {
    currentBalance,
    peakBalance,
    equity,
    initialBalance,
    profitTarget,
    tradingDaysCompleted,
    minTradingDaysRequired: rules.min_trading_days,
    
    totalDrawdownPct,
    dailyDrawdownPct,
    profitProgressPct,

    totalDrawdownCash,
    dailyDrawdownCash,
    profitCash,
    startOfDayBalance,

    dailyDrawdownBreached,
    maxDrawdownBreached,

    winRate,
    totalTradesOverall,
    totalTradesToday,
    averageWin,
    averageLoss,
    profitFactor,
    largestWin,
    largestLoss: Math.abs(largestLoss), // return as positive absolute
    winningStreak,
    losingStreak
  };
}
