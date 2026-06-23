import express from 'express';
import * as db from '../database/sqliteDB.js';
import * as mt5 from '../mt5/mt5Bridge.js';
import { calculateMetrics } from '../calculations/propMetrics.js';

const router = express.Router();

// Get full current dashboard state including metrics, open positions, history, rules, and alert breaches
router.get('/dashboard-state', async (req, res) => {
  try {
    const accountState = await db.get<any>('SELECT * FROM account_state LIMIT 1');
    const rules = await db.get<any>('SELECT * FROM evaluation_rules ORDER BY id DESC LIMIT 1');
    const broker = await db.get<any>('SELECT login, server, updated_at FROM broker_settings ORDER BY id DESC LIMIT 1');
    
    const openPositions = await db.all<any>('SELECT * FROM open_positions');
    const closedTrades = await db.all<any>('SELECT * FROM closed_trades ORDER BY close_time DESC');
    const breachAlerts = await db.all<any>('SELECT * FROM breach_events WHERE acknowledged = 0');

    if (!accountState || !rules) {
      return res.status(500).json({ error: 'Database state or rules not initialized yet' });
    }

    const metrics = calculateMetrics(accountState, rules, closedTrades, openPositions);

    res.json({
      metrics,
      openPositions,
      closedTrades,
      rules,
      broker,
      breachAlerts,
      sandboxSimulationEnabled: await db.isSandboxSimulationEnabled()
    });
  } catch (error: any) {
    console.error('Error fetching dashboard state:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update broker settings
router.post('/settings/broker', async (req, res) => {
  try {
    const { login, password, server } = req.body;
    if (!login || !password || !server) {
      return res.status(400).json({ error: 'Login, password, and server are required' });
    }

    const nowStr = new Date().toISOString();
    
    // We update/insert into broker_settings
    await db.run(
      'INSERT INTO broker_settings (login, password, server, updated_at) VALUES (?, ?, ?, ?)',
      [String(login), String(password), String(server), nowStr]
    );

    // Automatically clear previous sandbox/mock trades when connecting the new credentials so they start clean
    const rules = await db.get<any>('SELECT * FROM evaluation_rules ORDER BY id DESC LIMIT 1');
    const initialBalance = rules ? Number(rules.initial_balance) : 5000.0;
    
    // Deactivate simulated ticks since we has connected/updated broker credentials
    await db.setSandboxSimulationEnabled(false);
    await db.clearAllAccountData(initialBalance);
    await mt5.syncAccountState();

    res.json({ success: true, message: 'Broker settings updated. Old demo trade data has been wiped to start clean!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current broker settings (without passwords for security)
router.get('/settings/broker', async (req, res) => {
  try {
    const broker = await db.get<any>('SELECT id, login, server, updated_at FROM broker_settings ORDER BY id DESC LIMIT 1');
    res.json(broker || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update evaluation rules
router.post('/settings/rules', async (req, res) => {
  try {
    const {
      phase,
      initial_balance,
      profit_target,
      daily_drawdown_limit,
      max_drawdown_limit,
      min_trading_days,
      max_profit_limit,
      daily_cutoff_hour
    } = req.body;

    // Validate
    if (!phase || !initial_balance || !profit_target) {
      return res.status(400).json({ error: 'Missing mandatory fields' });
    }

    // Insert new rules
    await db.run(
      `INSERT INTO evaluation_rules (phase, initial_balance, profit_target, daily_drawdown_limit, max_drawdown_limit, min_trading_days, max_profit_limit, daily_cutoff_hour)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(phase),
        Number(initial_balance),
        Number(profit_target),
        Number(daily_drawdown_limit || 5),
        Number(max_drawdown_limit || 10),
        Number(min_trading_days || 3),
        Number(max_profit_limit || 3),
        Number(daily_cutoff_hour || 0)
      ]
    );

    // Correct start of day balance or initial balance as well if requested
    const state = await db.get<any>('SELECT * FROM account_state LIMIT 1');
    if (state && state.balance === 5000.0 && Number(initial_balance) !== 5000.0) {
      // Re-init state to clean starting points if user changes challenge size on step 1
      await db.run(
        'UPDATE account_state SET balance = ?, equity = ?, peak_balance = ?, start_of_day_balance = ?, free_margin = ? WHERE id = ?',
        [Number(initial_balance), Number(initial_balance), Number(initial_balance), Number(initial_balance), Number(initial_balance), state.id]
      );
    }

    // Recalculate states
    await mt5.syncAccountState();

    res.json({ success: true, message: 'Challenge evaluation rules updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual trade position (for high fidelity testing/use)
router.post('/trades/open', async (req, res) => {
  try {
    const { symbol, type, entry_price, lot_size } = req.body;
    if (!symbol || !type || !entry_price || !lot_size) {
      return res.status(400).json({ error: 'Missing order execution parameters' });
    }

    await mt5.openNewPosition({
      symbol: String(symbol),
      type: String(type).toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      entry_price: Number(entry_price),
      lot_size: Number(lot_size)
    });

    res.json({ success: true, message: 'Position executed successfully on Fusion Markets demo server' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Close a position
router.post('/trades/close', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Missing ticket ID' });
    }

    await mt5.closePosition(String(id));
    res.json({ success: true, message: 'Position closed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge a drawdown or profit targets breach alerts
router.post('/breaches/acknowledge', async (req, res) => {
  try {
    const { id } = req.body;
    if (id) {
      await db.run('UPDATE breach_events SET acknowledged = 1 WHERE id = ?', [id]);
    } else {
      await db.run('UPDATE breach_events SET acknowledged = 1');
    }
    res.json({ success: true, message: 'Breach alarm acknowledged' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual force sync of states
router.post('/sync/manual', async (req, res) => {
  try {
    await mt5.tickOpenPositions();
    await mt5.syncAccountState();
    res.json({ success: true, message: 'Account state fully synchronized with MT5 terminal' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger daily roll-over (start of day reset)
router.post('/sync/daily-reset', async (req, res) => {
  try {
    await mt5.triggerDailyReset();
    res.json({ success: true, message: 'Daily drawdown limit resets successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger to completely clear positions/history and reset to perfect scratchpad
router.post('/sync/clear-account', async (req, res) => {
  try {
    const rules = await db.get<any>('SELECT * FROM evaluation_rules ORDER BY id DESC LIMIT 1');
    const initialBalance = rules ? Number(rules.initial_balance) : 5000.0;
    
    await db.clearAllAccountData(initialBalance);
    await mt5.syncAccountState();
    
    res.json({ success: true, message: 'Sandbox account reset to clean starting point.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get whether sandbox simulation mode is enabled
router.get('/settings/simulation-mode', async (req, res) => {
  try {
    const isEnabled = await db.isSandboxSimulationEnabled();
    res.json({ enabled: isEnabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update sandbox simulation mode
router.post('/settings/simulation-mode', async (req, res) => {
  try {
    const { enabled } = req.body;
    if (enabled === undefined) {
      return res.status(400).json({ error: 'Field "enabled" is required' });
    }
    await db.setSandboxSimulationEnabled(!!enabled);
    res.json({ success: true, message: `Sandbox simulation mode is now ${enabled ? 'enabled' : 'disabled'}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Live manual balance/equity/margin updater for Fusion Markets
router.post('/sync/live-stats', async (req, res) => {
  try {
    const { balance, equity, margin, free_margin } = req.body;
    if (balance === undefined || equity === undefined) {
      return res.status(400).json({ error: 'Balance and equity are required' });
    }
    const currentMargin = margin !== undefined ? Number(margin) : 0;
    const currentFreeMargin = free_margin !== undefined ? Number(free_margin) : Number(balance);
    
    await db.updateAccountStateReal(Number(balance), Number(equity), currentMargin, currentFreeMargin);
    await mt5.syncAccountState(); // Recalculate metrics based on rules
    
    res.json({ success: true, message: 'Real-time account balance & equity snapshot updated successfully!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook for real-time MT5 EA/Python script push
router.post('/webhook/mt5', async (req, res) => {
  try {
    const { account_login, account_server, balance, equity, margin, free_margin, open_positions, closed_trades } = req.body;

    // 0. Detect account switch: if the EA reports a different login than what's stored,
    //    automatically update the broker label and reset to a fresh baseline using the
    //    account's current real balance.
    if (account_login) {
      const currentBroker = await db.get<any>('SELECT login, server, updated_at FROM broker_settings ORDER BY id DESC LIMIT 1');
      const isNewAccount = !currentBroker || String(currentBroker.login) !== String(account_login);

      if (isNewAccount) {
        const freshBalance = balance !== undefined ? Number(balance) : 5000;
        await db.run(
          'INSERT INTO broker_settings (login, password, server, updated_at) VALUES (?, ?, ?, ?)',
          [String(account_login), null, String(account_server || 'Unknown'), new Date().toISOString()]
        );
        await db.clearAllAccountData(freshBalance);
        await db.setSandboxSimulationEnabled(false);
        console.log(`🔄 Detected account switch to ${account_login} (${account_server}). Auto-reset to fresh baseline at $${freshBalance}.`);
      }
    }

    // 1. Update primary parameters
    const targetBalance = balance !== undefined ? Number(balance) : undefined;
    const targetEquity = equity !== undefined ? Number(equity) : targetBalance;
    const targetMargin = margin !== undefined ? Number(margin) : 0;
    const targetFreeMargin = free_margin !== undefined ? Number(free_margin) : (targetBalance || 5000);
    
    if (targetBalance !== undefined && targetEquity !== undefined) {
      await db.updateAccountStateReal(targetBalance, targetEquity, targetMargin, targetFreeMargin);
    }
    
    // 2. Sync active open positions
    if (open_positions && Array.isArray(open_positions)) {
      await db.syncRealOpenPositions(open_positions);
    } else if (open_positions === null || (open_positions && open_positions.length === 0)) {
      // If empty array explicitly pushed, clear open positions
      await db.syncRealOpenPositions([]);
    }
    
    // 3. Sync historical closed trades
    if (closed_trades && Array.isArray(closed_trades)) {
      await db.syncRealClosedTrades(closed_trades);
    }
    
    // 4. Force calculate drawdown benchmarks
    await mt5.syncAccountState();
    
    res.json({ success: true, message: 'Successfully synchronized real MT5 terminal data' });
  } catch (error: any) {
    console.error('Webhook payload parsing error:', error);
    res.status(500).json({ error: 'Failed to process webhook payloads: ' + error.message });
  }
});

// Journal: save a note/tag on a closed trade
router.post('/trades/journal', async (req, res) => {
  try {
    const { id, note, tag } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Trade id is required' });
    }
    const success = await db.updateJournalNote(String(id), note || '', tag || '');
    if (success) {
      res.json({ success: true, message: 'Journal entry saved' });
    } else {
      res.status(404).json({ error: 'Trade not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
