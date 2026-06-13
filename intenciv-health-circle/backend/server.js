/**
 * IntenCiv Health Circle — Backend entrypoint.
 *
 * Express 4 + Socket.io + MySQL 8.
 *
 * Deployment: Railway.app
 *   - Add a MySQL plugin
 *   - Set the env vars from .env.example
 *   - Run /database/*.sql migrations once (Railway's "Query" tab or `mysql` CLI)
 *   - `npm start`
 */
require('dotenv').config();

const http    = require('http');
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');

const { ping }              = require('./config/db');
const { generalLimiter }    = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const socketService         = require('./services/socket');

const authRouter        = require('./routes/auth');
const clientRouter      = require('./routes/client');
const agentRouter       = require('./routes/agent');
const receptionRouter   = require('./routes/reception');
const adminRouter       = require('./routes/admin');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// --- middleware -------------------------------------------------------
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: (process.env.FRONTEND_URL || '*').split(',').map(s => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '256kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(generalLimiter);

// --- routes -----------------------------------------------------------
app.get('/health', async (_req, res) => {
  try {
    await ping();
    res.json({ ok: true, service: 'intenciv-backend', db: 'up', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down', error: err.message });
  }
});

app.use('/auth',       authRouter);
app.use('/client',     clientRouter);
app.use('/agent',      agentRouter);
app.use('/reception',  receptionRouter);
app.use('/admin',      adminRouter);

app.use(notFound);
app.use(errorHandler);

// --- HTTP + socket.io -------------------------------------------------
const server = http.createServer(app);
socketService.init(server);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[intenciv-backend] listening on :${PORT}  (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
});

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[uncaughtException]', err);
});
