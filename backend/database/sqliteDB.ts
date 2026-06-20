import { MongoClient, Db } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'mt5tracker';
const COLLECTION_NAME = 'tracker_state';
const DOC_ID = 'singleton';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let mongoConnected = false;

interface BrokerSettings {
  id: number;
  login: string;
  password?: string;
  server: string;
  updated_at: string;
}

interface EvaluationRules {
  id: number;
  phase: number;
  initial_balance: number;
  profit_target: number;
  daily_drawdown_limit: number;
  max_drawdown_limit: number;
  min_trading_days: number;
  max_profit_limit: number;
  daily_cutoff_hour: number;
}

interface AccountState {
  id: number;
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  peak_balance: number;
  start_of_day_balance: number;
  last_sync_time: string;
}

interface OpenPosition {
  id: string;
  symbol: string;
  type: string;
  entry_price: number;
  current_price: number;
  lot_size: number;
  unrealized_pnl: number;
  pct_gain: number;
  open_time: string;
}

interface ClosedTrade {
  id: string;
  symbol: string;
  type: string;
  entry_price: number;
  exit_price: number;
  lot_size: number;
  pnl: number;
  open_time: string;
  close_time: string;
  journal_note?: string;
  journal_tag?: string;
}

interface DailyStats {
  date: string;
  start_balance: number;
  end_balance: number;
  has_traded: number;
}

interface BreachEvent {
  id: number;
  rule_name: string;
  info: string;
  limit_value: number;
  current_value: number;
  timestamp: string;
  acknowledged: number;
}

interface DataStore {
  broker_settings: BrokerSettings[];
  evaluation_rules: EvaluationRules[];
  account_state: AccountState[];
  open_positions: OpenPosition[];
  closed_trades: ClosedTrade[];
  daily_stats: DailyStats[];
  breach_events: BreachEvent[];
  sandbox_simulation_enabled?: boolean;
}

let dbData: DataStore = {
  broker_settings: [],
  evaluation_rules: [],
  account_state: [],
  open_positions: [],
  closed_trades: [],
  daily_stats: [],
  breach_events: [],
  sandbox_simulation_enabled: true
};

// Seed db function
function initializeDefaults() {
  dbData = {
    broker_settings: [
      {
        id: 1,
        login: "389456",
        password: "DemoPassword@123",
        server: "FusionMarkets-Demo",
        updated_at: new Date().toISOString()
      }
    ],
    evaluation_rules: [
      {
        id: 1,
        phase: 1,
        initial_balance: 5000.0,
        profit_target: 400.0,
        daily_drawdown_limit: 5.0,
        max_drawdown_limit: 10.0,
        min_trading_days: 3,
        max_profit_limit: 3.0,
        daily_cutoff_hour: 0
      }
    ],
    account_state: [
      {
        id: 1,
        balance: 5000.0,
        equity: 5000.0,
        margin: 0.0,
        free_margin: 5000.0,
        peak_balance: 5000.0,
        start_of_day_balance: 5000.0,
        last_sync_time: new Date().toISOString()
      }
    ],
    open_positions: [
      {
        id: '34928311',
        symbol: 'EURUSD',
        type: 'BUY',
        entry_price: 1.08542,
        current_price: 1.08620,
        lot_size: 0.50,
        unrealized_pnl: 39.00,
        pct_gain: 0.07,
        open_time: new Date(Date.now() - 45 * 60 * 1000).toISOString()
      }
    ],
    closed_trades: [
      {
        id: '34891120',
        symbol: 'XAUUSD',
        type: 'BUY',
        entry_price: 2342.10,
        exit_price: 2351.40,
        lot_size: 0.20,
        pnl: 186.00,
        open_time: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        close_time: new Date(Date.now() - 23.5 * 3600 * 1000).toISOString()
      },
      {
        id: '34821104',
        symbol: 'GBPUSD',
        type: 'SELL',
        entry_price: 1.26840,
        exit_price: 1.26520,
        lot_size: 0.50,
        pnl: 160.00,
        open_time: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        close_time: new Date(Date.now() - 47.1 * 3600 * 1000).toISOString()
      },
      {
        id: '34810291',
        symbol: 'EURUSD',
        type: 'BUY',
        entry_price: 1.08420,
        exit_price: 1.08180,
        lot_size: 0.40,
        pnl: -96.00,
        open_time: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        close_time: new Date(Date.now() - 11 * 3600 * 1000).toISOString()
      }
    ],
    daily_stats: [
      {
        date: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
        start_balance: 4850.0,
        end_balance: 5010.0,
        has_traded: 1
      },
      {
        date: new Date().toISOString().split('T')[0],
        start_balance: 5010.0,
        end_balance: 5000.0,
        has_traded: 1
      }
    ],
    breach_events: []
  };
  saveDatabase();
}

export async function connectAndLoad() {
  if (!MONGO_URI) {
    console.error('⚠️ MONGODB_URI not set. Falling back to in-memory only (data will NOT persist between deploys).');
    initializeDefaults();
    return;
  }

  try {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db(DB_NAME);
    mongoConnected = true;
    console.log('✅ Connected to MongoDB Atlas');

    const collection = mongoDb.collection(COLLECTION_NAME);
    const existing = await collection.findOne({ _id: DOC_ID as any });

    if (existing) {
      const { _id, ...rest } = existing as any;
      dbData = rest as DataStore;
      if (!dbData.broker_settings) dbData.broker_settings = [];
      if (!dbData.evaluation_rules) dbData.evaluation_rules = [];
      if (!dbData.account_state) dbData.account_state = [];
      if (!dbData.open_positions) dbData.open_positions = [];
      if (!dbData.closed_trades) dbData.closed_trades = [];
      if (!dbData.daily_stats) dbData.daily_stats = [];
      if (!dbData.breach_events) dbData.breach_events = [];
      console.log(`✅ Loaded tracker state from MongoDB (${dbData.closed_trades.length} closed trades, ${dbData.open_positions.length} open positions)`);
    } else {
      initializeDefaults();
      saveDatabase();
      console.log('✅ No existing data found. Initialized fresh defaults and saved to MongoDB.');
    }
  } catch (err) {
    console.error('❌ MongoDB connection failed, falling back to in-memory only:', err);
    mongoConnected = false;
    initializeDefaults();
  }
}

function saveDatabase() {
  // Fire-and-forget: don't block callers, but log failures
  if (!mongoConnected || !mongoDb) {
    return;
  }
  const collection = mongoDb.collection(COLLECTION_NAME);
  collection
    .updateOne({ _id: DOC_ID as any }, { $set: dbData }, { upsert: true })
    .catch(err => console.error('❌ Error saving to MongoDB:', err));
}

// Keep serialize function to match standard layout
export const dbConnection = {
  serialize: (callback: () => void) => {
    callback();
  },
  run: (sql: string, params: any[] = [], callback?: any) => {
    if (callback) callback(null);
  },
  get: (sql: string, params: any[] = [], callback?: any) => {
    if (callback) callback(null, {});
  }
};

export async function run(sql: string, params: any[] = []): Promise<any> {
  const normSql = sql.replace(/\s+/g, ' ').trim();

  // 1. INSERT INTO broker_settings
  if (/insert\s+into\s+broker_settings/i.test(normSql)) {
    const nextId = dbData.broker_settings.reduce((max, b) => Math.max(max, b.id || 0), 0) + 1;
    const newRow = {
      id: nextId,
      login: params[0],
      password: params[1],
      server: params[2],
      updated_at: params[3]
    };
    dbData.broker_settings.push(newRow);
    saveDatabase();
    return { lastID: nextId, changes: 1 };
  }

  // 2. INSERT INTO evaluation_rules
  if (/insert\s+into\s+evaluation_rules/i.test(normSql)) {
    const nextId = dbData.evaluation_rules.reduce((max, b) => Math.max(max, b.id || 0), 0) + 1;
    const newRow = {
      id: nextId,
      phase: params[0],
      initial_balance: params[1],
      profit_target: params[2],
      daily_drawdown_limit: params[3],
      max_drawdown_limit: params[4],
      min_trading_days: params[5],
      max_profit_limit: params[6],
      daily_cutoff_hour: params[7]
    };
    dbData.evaluation_rules.push(newRow);
    saveDatabase();
    return { lastID: nextId, changes: 1 };
  }

  // 3. INSERT INTO account_state
  if (/insert\s+into\s+account_state/i.test(normSql)) {
    const nextId = dbData.account_state.reduce((max, b) => Math.max(max, b.id || 0), 0) + 1;
    const newRow = {
      id: nextId,
      balance: params[0],
      equity: params[1],
      margin: params[2],
      free_margin: params[3],
      peak_balance: params[4],
      start_of_day_balance: params[5],
      last_sync_time: params[6]
    };
    dbData.account_state.push(newRow);
    saveDatabase();
    return { lastID: nextId, changes: 1 };
  }

  // 4. INSERT INTO open_positions
  if (/insert\s+into\s+open_positions/i.test(normSql)) {
    const newRow = {
      id: String(params[0]),
      symbol: params[1],
      type: params[2],
      entry_price: params[3],
      current_price: params[4],
      lot_size: params[5],
      unrealized_pnl: params[6],
      pct_gain: params[7],
      open_time: params[8]
    };
    dbData.open_positions.push(newRow);
    saveDatabase();
    return { lastID: params[0], changes: 1 };
  }

  // 5. INSERT INTO closed_trades
  if (/insert\s+into\s+closed_trades/i.test(normSql)) {
    const newRow = {
      id: String(params[0]),
      symbol: params[1],
      type: params[2],
      entry_price: params[3],
      exit_price: params[4],
      lot_size: params[5],
      pnl: params[6],
      open_time: params[7],
      close_time: params[8]
    };
    dbData.closed_trades.push(newRow);
    saveDatabase();
    return { lastID: params[0], changes: 1 };
  }

  // 6. INSERT INTO daily_stats (including ON CONFLICT)
  if (/insert\s+into\s+daily_stats/i.test(normSql)) {
    const date = params[0];
    const existingIndex = dbData.daily_stats.findIndex(d => d.date === date);
    if (existingIndex !== -1) {
      if (normSql.includes('ON CONFLICT') && normSql.includes('start_balance = ?')) {
        dbData.daily_stats[existingIndex].start_balance = params[3];
      } else {
        dbData.daily_stats[existingIndex].end_balance = params[4];
        dbData.daily_stats[existingIndex].has_traded = params[5];
      }
    } else {
      dbData.daily_stats.push({
        date: params[0],
        start_balance: params[1],
        end_balance: params[2],
        has_traded: params[3]
      });
    }
    saveDatabase();
    return { lastID: date, changes: 1 };
  }

  // 7. INSERT INTO breach_events
  if (/insert\s+into\s+breach_events/i.test(normSql)) {
    const nextId = dbData.breach_events.reduce((max, b) => Math.max(max, b.id || 0), 0) + 1;
    const newRow = {
      id: nextId,
      rule_name: params[0],
      info: params[1],
      limit_value: params[2],
      current_value: params[3],
      timestamp: params[4],
      acknowledged: params[5] || 0
    };
    dbData.breach_events.push(newRow);
    saveDatabase();
    return { lastID: nextId, changes: 1 };
  }

  // 8. DELETE FROM open_positions
  if (/delete\s+from\s+open_positions/i.test(normSql)) {
    const id = String(params[0]);
    const initLen = dbData.open_positions.length;
    dbData.open_positions = dbData.open_positions.filter(p => p.id !== id);
    saveDatabase();
    return { changes: initLen - dbData.open_positions.length };
  }

  // 9. UPDATE open_positions
  if (/update\s+open_positions/i.test(normSql)) {
    const id = String(params[3]);
    const pos = dbData.open_positions.find(p => p.id === id);
    if (pos) {
      pos.current_price = params[0];
      pos.unrealized_pnl = params[1];
      pos.pct_gain = params[2];
      saveDatabase();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  // 10. UPDATE account_state (equity, peak_balance)
  if (/update\s+account_state\s+set\s+equity/i.test(normSql)) {
    const row = dbData.account_state[0];
    if (row) {
      row.equity = params[0];
      row.peak_balance = params[1];
      row.last_sync_time = params[2];
      saveDatabase();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  // 11. UPDATE account_state SET balance = ?
  if (/update\s+account_state\s+set\s+balance\s*=\s*\?/i.test(normSql)) {
    const row = dbData.account_state[0];
    if (row) {
      row.balance = params[0];
      saveDatabase();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  // 12. UPDATE account_state (start_of_day_balance)
  if (/update\s+account_state\s+set\s+start_of_day_balance/i.test(normSql)) {
    const row = dbData.account_state[0];
    if (row) {
      row.start_of_day_balance = params[0];
      row.last_sync_time = params[1];
      saveDatabase();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  // 13. UPDATE account_state (full balance, equity, peak_balance, start_of_day_balance, free_margin)
  if (/update\s+account_state\s+set\s+balance\s*=\s*\?,\s*equity\s*=\s*\?/i.test(normSql)) {
    const row = dbData.account_state[0];
    if (row) {
      row.balance = params[0];
      row.equity = params[1];
      row.peak_balance = params[2];
      row.start_of_day_balance = params[3];
      row.free_margin = params[4];
      saveDatabase();
      return { changes: 1 };
    }
    return { ...processUpdateCols(dbData.account_state[0], normSql, params) };
  }

  // 14. UPDATE breach_events SET acknowledged = 1 WHERE id = ?
  if (/update\s+breach_events.*set.*acknowledged\s*=\s*1.*where.*id/i.test(normSql)) {
    const id = Number(params[0]);
    const breach = dbData.breach_events.find(b => b.id === id);
    if (breach) {
      breach.acknowledged = 1;
      saveDatabase();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  // 15. UPDATE breach_events SET acknowledged = 1 (all)
  if (/update\s+breach_events.*set\s+acknowledged\s*=\s*1/i.test(normSql)) {
    let count = 0;
    dbData.breach_events.forEach(b => {
      if (b.acknowledged !== 1) {
        b.acknowledged = 1;
        count++;
      }
    });
    if (count > 0) saveDatabase();
    return { changes: count };
  }

  // General fallback parsing columns
  const updateMatch = normSql.match(/update\s+(\w+)/i);
  if (updateMatch) {
    const tableName = updateMatch[1].toLowerCase();
    const table = (dbData as any)[tableName] || [];
    if (table.length > 0) {
      const row = table[0]; // operate on first for state
      const result = processUpdateCols(row, normSql, params);
      saveDatabase();
      return result;
    }
  }

  console.warn('Unhandled simulation update query:', sql);
  return { lastID: null, changes: 0 };
}

function processUpdateCols(row: any, normSql: string, params: any[]): { changes: number } {
  if (!row) return { changes: 0 };
  const setPart = normSql.match(/set\s+(.+?)(?:\s+where|$)/i);
  if (!setPart) return { changes: 0 };
  
  const assignments = setPart[1].split(',');
  assignments.forEach((assignment, idx) => {
    const colName = assignment.split('=')[0].trim().toLowerCase();
    if (row[colName] !== undefined && idx < params.length) {
      row[colName] = params[idx];
    } else if (idx < params.length) {
      // try CamelCase transformation if it's start_of_day_balance -> startOfDayBalance
      const camel = colName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (row[camel] !== undefined) {
        row[camel] = params[idx];
      }
    }
  });
  return { changes: 1 };
}

export async function get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  const normSql = sql.replace(/\s+/g, ' ').trim();

  // 1. SELECT COUNT
  if (/select\s+count\(\*\)\s+as\s+count\s+from\s+(\w+)/i.test(normSql)) {
    const match = normSql.match(/select\s+count\(\*\)\s+as\s+count\s+from\s+(\w+)/i);
    const tableName = match ? match[1].toLowerCase() : '';
    const table = (dbData as any)[tableName] || [];
    return { count: table.length } as any as T;
  }

  // 2. SELECT * FROM account_state
  if (/select\s+\*\s+from\s+account_state/i.test(normSql)) {
    return JSON.parse(JSON.stringify(dbData.account_state[0] || null)) as T;
  }

  // 3. SELECT * FROM evaluation_rules
  if (/select\s+\*\s+from\s+evaluation_rules/i.test(normSql)) {
    const len = dbData.evaluation_rules.length;
    return JSON.parse(JSON.stringify(dbData.evaluation_rules[len - 1] || null)) as T;
  }

  // 4. SELECT SUM(unrealized_pnl)
  if (/sum\(unrealized_pnl\)/i.test(normSql)) {
    const sum = dbData.open_positions.reduce((acc, p) => acc + (p.unrealized_pnl || 0), 0);
    return { total_unrealized: sum } as any as T;
  }

  // 5. SELECT broker_settings
  if (/select\s+(id,)?\s*login,\s*server,\s*updated_at\s+from\s+broker_settings/i.test(normSql)) {
    const b = dbData.broker_settings[dbData.broker_settings.length - 1];
    if (!b) return undefined;
    return {
      id: b.id,
      login: b.login,
      server: b.server,
      updated_at: b.updated_at
    } as any as T;
  }

  // 6. SELECT * FROM open_positions WHERE id = ?
  if (/select\s+\*\s+from\s+open_positions\s+where\s+id\s*=\s*\?/i.test(normSql)) {
    const targetId = String(params[0]);
    const pos = dbData.open_positions.find(p => p.id === targetId);
    return pos ? JSON.parse(JSON.stringify(pos)) : undefined;
  }

  // 7. SELECT id FROM breach_events
  if (/select\s+id\s+from\s+breach_events/i.test(normSql)) {
    const ruleName = params[0];
    const item = dbData.breach_events.find(b => b.rule_name === ruleName && b.acknowledged === 0);
    return item ? { id: item.id } as any as T : undefined;
  }

  console.warn('Unhandled simulation value query:', sql);
  return undefined;
}

export async function all<T>(sql: string, params: any[] = []): Promise<T[]> {
  const normSql = sql.replace(/\s+/g, ' ').trim();

  // 1. SELECT * FROM open_positions
  if (/select\s+\*\s+from\s+open_positions/i.test(normSql)) {
    return JSON.parse(JSON.stringify(dbData.open_positions)) as T[];
  }

  // 2. SELECT * FROM closed_trades
  if (/select\s+\*\s+from\s+closed_trades/i.test(normSql)) {
    const sorted = [...dbData.closed_trades].sort((a, b) => b.close_time.localeCompare(a.close_time));
    return JSON.parse(JSON.stringify(sorted)) as T[];
  }

  // 3. SELECT * FROM breach_events WHERE acknowledged = 0
  if (/select\s+\*\s+from\s+breach_events/i.test(normSql)) {
    const filtered = dbData.breach_events.filter(b => b.acknowledged === 0);
    return JSON.parse(JSON.stringify(filtered)) as T[];
  }

  console.warn('Unhandled simulation array query:', sql);
  return [] as T[];
}

export async function clearAllAccountData(initialBalance: number = 5000.0) {
  dbData.open_positions = [];
  dbData.closed_trades = [];
  dbData.daily_stats = [
    {
      date: new Date().toISOString().split('T')[0],
      start_balance: initialBalance,
      end_balance: initialBalance,
      has_traded: 0
    }
  ];
  dbData.breach_events = [];

  if (dbData.account_state[0]) {
    dbData.account_state[0].balance = initialBalance;
    dbData.account_state[0].equity = initialBalance;
    dbData.account_state[0].margin = 0.0;
    dbData.account_state[0].free_margin = initialBalance;
    dbData.account_state[0].peak_balance = initialBalance;
    dbData.account_state[0].start_of_day_balance = initialBalance;
    dbData.account_state[0].last_sync_time = new Date().toISOString();
  }

  saveDatabase();
}

export async function isSandboxSimulationEnabled(): Promise<boolean> {
  return dbData.sandbox_simulation_enabled !== false;
}

export async function setSandboxSimulationEnabled(enabled: boolean): Promise<void> {
  dbData.sandbox_simulation_enabled = enabled;
  saveDatabase();
}

export async function updateAccountStateReal(balance: number, equity: number, margin: number, freeMargin: number) {
  if (dbData.account_state[0]) {
    dbData.account_state[0].balance = balance;
    dbData.account_state[0].equity = equity;
    dbData.account_state[0].margin = margin;
    dbData.account_state[0].free_margin = freeMargin;
    dbData.account_state[0].last_sync_time = new Date().toISOString();
    if (balance > dbData.account_state[0].peak_balance) {
      dbData.account_state[0].peak_balance = balance;
    }
  }
  saveDatabase();
}

export async function syncRealOpenPositions(positions: any[]) {
  dbData.open_positions = positions.map(pos => ({
    id: String(pos.id || Math.floor(10000000 + Math.random() * 90000000)),
    symbol: String(pos.symbol),
    type: String(pos.type || 'BUY'),
    entry_price: Number(pos.entry_price || pos.entryPrice || 0),
    current_price: Number(pos.current_price || pos.currentPrice || pos.entryPrice || 0),
    lot_size: Number(pos.lot_size || pos.lotSize || 0.01),
    unrealized_pnl: Number(pos.unrealized_pnl || pos.unrealizedPnl || 0),
    pct_gain: Number(pos.pct_gain || pos.pctGain || 0),
    open_time: String(pos.open_time || pos.openTime || new Date().toISOString())
  }));
  saveDatabase();
}

export async function syncRealClosedTrades(trades: any[]) {
  // Preserve existing journal notes/tags when EA re-syncs trade data
  const existingNotes = new Map<string, { note?: string; tag?: string }>();
  dbData.closed_trades.forEach(t => {
    if (t.journal_note || t.journal_tag) {
      existingNotes.set(t.id, { note: t.journal_note, tag: t.journal_tag });
    }
  });

  dbData.closed_trades = trades.map(trade => {
    const id = String(trade.id || Math.floor(1000000 + Math.random() * 9000000));
    const preserved = existingNotes.get(id);
    return {
      id,
      symbol: String(trade.symbol),
      type: String(trade.type || 'BUY'),
      entry_price: Number(trade.entry_price || trade.entryPrice),
      exit_price: Number(trade.exit_price || trade.exitPrice),
      lot_size: Number(trade.lot_size || trade.lotSize),
      pnl: Number(trade.pnl),
      open_time: String(trade.open_time || trade.openTime || new Date().toISOString()),
      close_time: String(trade.close_time || trade.closeTime || new Date().toISOString()),
      journal_note: preserved?.note,
      journal_tag: preserved?.tag
    };
  });
  saveDatabase();
}

export async function updateJournalNote(tradeId: string, note: string, tag: string) {
  const trade = dbData.closed_trades.find(t => t.id === tradeId);
  if (trade) {
    trade.journal_note = note;
    trade.journal_tag = tag;
    saveDatabase();
    return true;
  }
  return false;
}
