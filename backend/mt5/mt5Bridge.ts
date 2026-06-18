import * as db from '../database/sqliteDB.js';

// Base contract sizes for Forex and Gold
const CONTRACT_SIZES: Record<string, number> = {
  'EURUSD': 100000,
  'GBPUSD': 100000,
  'USDJPY': 100000, // 100,000 * (current - entry) / current but we can simplify to $1000/pip
  'XAUUSD': 100, // 1 oz Gold contract size = 100
  'DEFAULT': 100000
};

// Start prices of pairs to keep simulation stable and realistic
const BASE_PRICES: Record<string, number> = {
  'EURUSD': 1.0850,
  'GBPUSD': 1.2650,
  'USDJPY': 155.80,
  'XAUUSD': 2345.50
};

// Sync service container
let syncTimer: NodeJS.Timeout | null = null;
let simulatedTicksCount = 0;

export async function initMt5Bridge() {
  console.log('Initializing MT5 Sync Bridge ...');
  // Load settings and current state 
  await syncAccountState();
  
  // Start the background evaluation engine polling every 5 seconds for high fidelity,
  // and simulating trade updates to replicate live MT5 socket terminals inside Telegram
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(async () => {
    try {
      await tickOpenPositions();
      await syncAccountState();
    } catch (e) {
      console.error('Core MT5 Bridge Poller Error:', e);
    }
  }, 5000); 
}

// Pull general quotes slightly fluctuated to simulate tick charts inside Telegram WebApp
function getLiveQuote(symbol: string, currentVal: number): number {
  const base = BASE_PRICES[symbol] || 1.0000;
  const spreadPercent = symbol === 'XAUUSD' ? 0.0007 : 0.00015; // Realistic pip fluctuations
  const direction = Math.random() > 0.48 ? 1 : -1; // Subtle upward trend matching healthy demo accounts
  const change = currentVal * spreadPercent * direction * (Math.random() * 0.5);
  
  const newVal = currentVal + change;
  
  // Prevent extreme deviations from base price
  const maxDeviationPercent = 0.02; // max 2% dev from base
  if (newVal > base * (1 + maxDeviationPercent)) return base * (1 + maxDeviationPercent);
  if (newVal < base * (1 - maxDeviationPercent)) return base * (1 - maxDeviationPercent);
  
  return parseFloat(newVal.toFixed(symbol === 'USDJPY' ? 3 : symbol === 'XAUUSD' ? 2 : 5));
}

// Live ticking loop - updates open positions unrealized PNL
export async function tickOpenPositions() {
  const isSimulation = await db.isSandboxSimulationEnabled();
  if (!isSimulation) {
    return;
  }

  const positions = await db.all<any>('SELECT * FROM open_positions');
  if (positions.length === 0) return;

  for (const pos of positions) {
    const symbol = pos.symbol;
    const currentPrice = getLiveQuote(symbol, pos.current_price || BASE_PRICES[symbol] || 1.1000);
    const entryPrice = pos.entry_price;
    const lotSize = pos.lot_size;
    const type = pos.type; // BUY or SELL
    
    // Calculate PNL
    const contract = CONTRACT_SIZES[symbol] || CONTRACT_SIZES['DEFAULT'];
    let pnl = 0;
    if (type === 'BUY') {
      pnl = (currentPrice - entryPrice) * lotSize * contract;
    } else {
      pnl = (entryPrice - currentPrice) * lotSize * contract;
    }
    
    if (symbol === 'USDJPY') {
      // JPY has a different exchange divisor, divide by current price approx
      pnl = pnl / currentPrice;
    }

    pnl = parseFloat(pnl.toFixed(2));
    const pctGain = parseFloat(((pnl / (entryPrice * lotSize * (contract / 100))) * 100).toFixed(2));

    await db.run(
      'UPDATE open_positions SET current_price = ?, unrealized_pnl = ?, pct_gain = ? WHERE id = ?',
      [currentPrice, pnl, pctGain, pos.id]
    );
  }
}

// Calculate drawdowns and peak balances, update db and detect breaches
export async function syncAccountState() {
  // 1. Fetch current balance
  const stateRow = await db.get<any>('SELECT * FROM account_state LIMIT 1');
  const rules = await db.get<any>('SELECT * FROM evaluation_rules ORDER BY id DESC LIMIT 1');
  
  if (!stateRow || !rules) return;

  // Let's sum up unrealized pnl of all open positions
  const openPos = await db.get<any>('SELECT SUM(unrealized_pnl) as total_unrealized FROM open_positions');
  const totalUnrealized = openPos?.total_unrealized || 0;
  
  const currentBalance = stateRow.balance;
  const equity = parseFloat((currentBalance + totalUnrealized).toFixed(2));
  
  // Track peak balance (highest achieved balance)
  let peakBalance = stateRow.peak_balance;
  if (currentBalance > peakBalance) {
    peakBalance = currentBalance;
  }

  // Daily drawdown rules calculations
  const startOfDayBalance = stateRow.start_of_day_balance;
  const lowestVal = Math.min(currentBalance, equity);
  
  const dailyDrawdownCash = Math.max(0, startOfDayBalance - lowestVal);
  const dailyDrawdownPct = startOfDayBalance > 0 ? (dailyDrawdownCash / startOfDayBalance) * 100 : 0;

  const totalDrawdownCash = Math.max(0, peakBalance - lowestVal);
  const totalDrawdownPct = rules.initial_balance > 0 ? (totalDrawdownCash / rules.initial_balance) * 100 : 0;

  // Check and log breach events in the DB
  const nowStr = new Date().toISOString();
  
  if (dailyDrawdownPct >= rules.daily_drawdown_limit) {
    // Inserts a breach if not already logged recently (within last hour for same level to prevent duplicate logs)
    const existingBreach = await db.get<any>(
      "SELECT id FROM breach_events WHERE rule_name = 'DAILY_DRAWDOWN' AND acknowledged = 0 LIMIT 1"
    );
    if (!existingBreach) {
      await db.run(
        'INSERT INTO breach_events (rule_name, info, limit_value, current_value, timestamp, acknowledged) VALUES (?, ?, ?, ?, ?, 0)',
        [
          'DAILY_DRAWDOWN',
          `Daily Drawdown of ${dailyDrawdownPct.toFixed(2)}% exceeded the Funding Pips limit of ${rules.daily_drawdown_limit}%. Start of day balance was $${startOfDayBalance.toFixed(2)}. Equity/Balance drew down to $${lowestVal.toFixed(2)}.`,
          rules.daily_drawdown_limit,
          parseFloat(dailyDrawdownPct.toFixed(2)),
          nowStr
        ]
      );
    }
  }

  if (totalDrawdownPct >= rules.max_drawdown_limit) {
    const existingBreach = await db.get<any>(
      "SELECT id FROM breach_events WHERE rule_name = 'MAX_DRAWDOWN' AND acknowledged = 0 LIMIT 1"
    );
    if (!existingBreach) {
      await db.run(
        'INSERT INTO breach_events (rule_name, info, limit_value, current_value, timestamp, acknowledged) VALUES (?, ?, ?, ?, ?, 0)',
        [
          'MAX_DRAWDOWN',
          `Maximum Lifetime Drawdown of ${totalDrawdownPct.toFixed(2)}% breached limit (${rules.max_drawdown_limit}%). Max peak balance achieved was $${peakBalance.toFixed(2)}. Equity/Balance fell to $${lowestVal.toFixed(2)}.`,
          rules.max_drawdown_limit,
          parseFloat(totalDrawdownPct.toFixed(2)),
          nowStr
        ]
      );
    }
  }

  // Update account state
  await db.run(
    'UPDATE account_state SET equity = ?, peak_balance = ?, last_sync_time = ? WHERE id = ?',
    [equity, peakBalance, nowStr, stateRow.id]
  );
}

// Reset Start Of Day Balance dynamically
// Triggers the standard prop-firm daily cutoff where evaluation draws down metric resets to current balance
export async function triggerDailyReset() {
  const stateRow = await db.get<any>('SELECT * FROM account_state LIMIT 1');
  if (!stateRow) return;

  const currentBalance = stateRow.balance;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Store in daily_stats calendar
  await db.run(
    `INSERT INTO daily_stats (date, start_balance, end_balance, has_traded)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(date) DO UPDATE SET start_balance = ?`,
    [todayStr, stateRow.start_of_day_balance, currentBalance, stateRow.start_of_day_balance]
  );

  // Set start_of_day_balance to current balance
  await db.run(
    'UPDATE account_state SET start_of_day_balance = ?, last_sync_time = ? WHERE id = ?',
    [currentBalance, now.toISOString(), stateRow.id]
  );

  console.log(`Daily reset complete. Start of day balance set to current balance $${currentBalance}`);
}

// Add closed trade manually or from MT5 Sync
export async function createClosedTrade(trade: {
  id: string,
  symbol: string,
  type: string,
  entry_price: number,
  exit_price: number,
  lot_size: number,
  pnl: number,
  open_time: string,
  close_time: string
}) {
  await db.run(
    `INSERT INTO closed_trades (id, symbol, type, entry_price, exit_price, lot_size, pnl, open_time, close_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [trade.id, trade.symbol, trade.type, trade.entry_price, trade.exit_price, trade.lot_size, trade.pnl, trade.open_time, trade.close_time]
  );

  // Adjust account balance accordingly
  const stateRow = await db.get<any>('SELECT * FROM account_state LIMIT 1');
  if (stateRow) {
    const newBalance = parseFloat((stateRow.balance + trade.pnl).toFixed(2));
    await db.run(
      'UPDATE account_state SET balance = ? WHERE id = ?',
      [newBalance, stateRow.id]
    );
  }
}

// Place a new open trade manually (e.g. simulating active trader placements or direct terminal executions)
export async function openNewPosition(pos: {
  symbol: string,
  type: string,
  entry_price: number,
  lot_size: number
}) {
  const id = Math.floor(10000000 + Math.random() * 90000000).toString();
  const nowStr = new Date().toISOString();
  await db.run(
    `INSERT INTO open_positions (id, symbol, type, entry_price, current_price, lot_size, unrealized_pnl, pct_gain, open_time)
     VALUES (?, ?, ?, ?, ?, ?, 0.0, 0.0, ?)`,
    [id, pos.symbol, pos.type, pos.entry_price, pos.entry_price, pos.lot_size, nowStr]
  );
  await syncAccountState();
}

// Close an active open position - and log it to closed_trades history
export async function closePosition(id: string) {
  const pos = await db.get<any>('SELECT * FROM open_positions WHERE id = ?', [id]);
  if (!pos) return;

  const nowStr = new Date().toISOString();
  
  // Move to closed list
  await db.run(
    `INSERT INTO closed_trades (id, symbol, type, entry_price, exit_price, lot_size, pnl, open_time, close_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pos.id, pos.symbol, pos.type, pos.entry_price, pos.current_price, pos.lot_size, pos.unrealized_pnl, pos.open_time, nowStr]
  );

  // Update Account Balance
  const stateRow = await db.get<any>('SELECT * FROM account_state LIMIT 1');
  if (stateRow) {
    const newBalance = parseFloat((stateRow.balance + pos.unrealized_pnl).toFixed(2));
    await db.run(
      'UPDATE account_state SET balance = ? WHERE id = ?',
      [newBalance, stateRow.id]
    );
  }

  // Delete from open positions
  await db.run('DELETE FROM open_positions WHERE id = ?', [id]);
  await syncAccountState();
}
