/**
 * IntenCiv Health Circle — backend entrypoint (revision 2).
 * Routes:
 *   /auth/*         public  (admin password, salesperson PIN, customer phone)
 *   /salesperson/*  authn'd salesperson
 *   /customer/*     authn'd customer
 *   /admin/*        authn'd admin (reception sub-routes require x-admin-password)
 */
require('dotenv').config();

const http    = require('http');
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');

const { ping } = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const socket = require('./services/socket');

const authRouter        = require('./routes/auth');
const salespersonRouter = require('./routes/salesperson');
const customerRouter    = require('./routes/customer');
const adminRouter       = require('./routes/admin');
const receptionRouter   = require('./routes/reception');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: (process.env.FRONTEND_URL || '*').split(',').map(s => s.trim()),
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json({ limit: '256kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(generalLimiter);

app.get('/health', async (_req, res) => {
  try { await ping(); res.json({ ok: true, service: 'intenciv-backend', db: 'up' }); }
  catch (e) { res.status(503).json({ ok: false, db: 'down', error: e.message }); }
});

app.use('/auth',        authRouter);
app.use('/salesperson', salespersonRouter);
app.use('/customer',    customerRouter);
app.use('/admin',       adminRouter);
app.use('/reception',   receptionRouter);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
socket.init(server);

server.listen(PORT, () => {
  console.log(`[intenciv-backend] listening on :${PORT}  (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
});

process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException',  (e) => console.error('[uncaughtException]', e));
