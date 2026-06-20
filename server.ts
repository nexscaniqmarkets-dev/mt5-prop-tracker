import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import apiRouter from './backend/routes/api.js';
import { initMt5Bridge } from './backend/mt5/mt5Bridge.js';
import * as db from './backend/database/sqliteDB.js';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON middleware parser
  app.use(express.json());

  // Log payload in console to verify connectivity in development
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API ${req.method}] ${req.path}`);
    }
    next();
  });

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Connect to MongoDB and load persisted tracker state before anything else
  await db.connectAndLoad();

  // Initialize MT5 Core poller and metrics tracker
  await initMt5Bridge();

  // Vite development integration or production asset host
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serving production bundles
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Prop Trader Full Stack Server is listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('SERVER INITIALIZATION FATAL FAILURE:', err);
});
