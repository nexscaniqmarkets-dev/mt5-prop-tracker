# MT5 Prop Tracker Telegram Mini App

A full-stack proprietary-firm-style performance evaluation dashboard deployed as a Telegram Mini App. Perfect for tracking single-user accounts, calculating precise peak drawdown levels (modeled after *Funding Pips' standard 2-step evaluation rules*), simulating real-time market ticket events, and hot-swapping MT5 brokers dynamically without restarting deployments.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, TSX, SQLite (persistent file-based repository).
- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, Recharts (premium fintech visuals and statistics growth plots).
- **Telegram Native SDK**: Autonome theme syncing, layout expansion, standard click alerts.

---

## ⚡ Core Operational Features

1. **Drawdown Logic Calculations (Funding Pips Standard)**
   - **Peak Balance Tracking**: Lock highest closed balance achieved. Includes relative drawdown checks.
   - **Total Drawdown %**: `(Peak Balance - Lowest(Balance, Equity)) ÷ Initial Balance × 100`. Limits warning is at `10%`.
   - **Daily Drawdown %**: `(Start of Day Balance - Lowest(Balance, Equity)) ÷ Start of Day Balance × 105`. Reset automatically resets at customizable GMT cycles. Limits warning at `5%`.
   - **Max Profit/Transaction Warning**: Display warning logs if a single completed trade exceeds `3%` of starting balance.

2. **MT5 Live Platform Synchronization**
   - Active ticks poller simulates market spread movements for running EURUSD, GBPUSD, USDJPY, and XAUUSD orders.
   - Connect or simulation gateways check credentials stored securely inside SQLite and map floating balances dynamically.

3. **Telegram Mini App Shell**
   - Built to run seamlessly inside custom webview clients or Telegram desktop layouts. Includes full dark theme integration.

---

## 🚀 Local Development Setup

To boot the full-stack system locally in development mode:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Parameters**
   Copy `.env.example` to `.env` and fill out your demo details:
   ```env
   MT5_LOGIN=389456
   MT5_PASSWORD=YOUR_PASSWORD
   MT5_SERVER=FusionMarkets-Demo
   ```

3. **Run Express + Vite Dev Server**
   ```bash
   npm run dev
   ```
   This launches the background MT5 synchronization simulator on port `3000` with hot-reload enabled. Open [http://localhost:3000](http://localhost:3000) to view the client.

4. **Production Build bundle**
   ```bash
   npm run build
   npm run start
   ```

---

## 🤖 Telegram BotFather Mini App Setup

Use Telegram BotFather to wrap this application into a native Mini App interface:

1. Open Telegram and search for the verified account **@BotFather**.
2. Run `/newbot` to create your custom tracker bot. Set a name and username.
3. Run `/newapp` to initialize a new Mini App wrapper code:
   - Select your newly created bot.
   - Enter a title and description.
   - **Important**: When BotFather asks for the URL, paste your production hosted domain (e.g., `https://ais-dev-...run.app` or your Render/Railway url).
   - Assign a unique short name.
4. Launch your Telegram Bot, tap the menu/button link or run `/start` to pop open your premium prop-firm dashboard directly inside Telegram.

---

## 🌐 Deploying to Free-Tier Hosting (Render / Railway / equivalent)

### Deploying on Render (Web Service)
1. Sign up/log in to [Render](https://render.com).
2. Connect your GitHub repository.
3. Choose **Web Service** with Node as runtime.
4. Set execution parameters:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
5. Head to Render's **Environment** tab, click "Add Environment Variable", and append:
   - `NODE_ENV` = `production`
6. Click Deploy. Since the database is SQLite, persist the `database/` directory using an attached Disk for state permanence, or run stateless for demo sessions.

---

## 🔧 Troubleshooting Guide

- **Vite WebSockets failed to connect**: This is standard and expected in sandboxed proxy frames. All dev server logic relies on regular polling, so this does not impact app functions.
- **Drawdown limit warning has triggered**: Rules breaches trigger warning alerts immediately. Simply acknowledge the error in the dashboard or click "Trigger Daily Reset" in Settings to start a brand new sandbox day.
- **SQLite Database Locked**: Make sure there is only one Node.js instance running. Run `killall node` or stop stale processes to release active DB handles.
