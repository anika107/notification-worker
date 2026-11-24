require('dotenv').config();

const express = require('express');
const notificationQueue = require('./src/queue');
const dlq = require('./src/dlq');
const { pool, init } = require('./src/db');
const { setupSchedules } = require('./src/schedules');
const { validate } = require('./src/validate');
const { notifySchema, hashSchema, resizeSchema } = require('./src/schemas');
const { requireApiKey } = require('./src/auth');
const { rateLimit } = require('express-rate-limit');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { dashboardAuth } = require('./src/dashboard-auth');

const limiter = rateLimit({
  windowMs: 60 * 1000,                              // 1 minute window
  limit: Number(process.env.RATE_LIMIT_MAX) || 100, // max requests per window
  standardHeaders: 'draft-7',                       // sends RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

const PORT = 3000

const app = express();
app.use(express.json());
app.use(limiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Dashboard: own login, registered before the API-key middleware
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(notificationQueue), new BullMQAdapter(dlq)],
  serverAdapter,
});

app.use('/admin/queues', dashboardAuth, serverAdapter.getRouter());

// Everything registered after this line requires the API key
app.use(requireApiKey);

console.log('SMTP_USER:', process.env.SMTP_USER);

app.post('/notify', validate(notifySchema), async (req, res) => {
  const { to, subject, message } = req.body;
  const key = req.get('idempotency-key') || null;

  if (key && key.length > 200) {
    return res.status(400).json({ error: 'Idempotency-Key too long' });
  }

  const inserted = await pool.query(
    `INSERT INTO notifications (type, recipient, payload, idempotency_key)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    ['email', to, { subject, message }, key]
  );

  // No row returned = this key was already used
  if (inserted.rows.length === 0) {
    const existing = await pool.query(
      'SELECT id, status FROM notifications WHERE idempotency_key = $1',
      [key]
    );
    return res.json({
      status: 'duplicate',
      id: existing.rows[0].id,
      currentStatus: existing.rows[0].status,
    });
  }

  const notificationId = inserted.rows[0].id;

  await notificationQueue.add(
    'send-email',
    { notificationId, to, subject, message },
    { jobId: `notify-${notificationId}` }
  );

  res.json({ status: 'queued', id: notificationId });
});

app.post('/notify/push', validate(notifySchema), async (req, res) => {
  const { userId, title, body } = req.body;
  await notificationQueue.add('send-push', { userId, title, body });
  res.json({ status: 'queued' });
});

app.post('/notify/sms', validate(notifySchema), async (req, res) => {
  const { phone, message } = req.body;
  await notificationQueue.add('send-sms', { phone, message });
  res.json({ status: 'queued' });
});

app.post('/notify/later', validate(notifySchema), async (req, res) => {
  const { userId, title, body, delayMs } = req.body;

  const job = await notificationQueue.add(
    'send-push',
    { userId, title, body },
    { delay: delayMs, jobId: `reminder-${userId}-${Date.now()}` }
  );

  res.json({ status: 'scheduled', jobId: job.id });
});

app.delete('/notify/later/:jobId', validate(notifySchema), async (req, res) => {
  const job = await notificationQueue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'not found' });

  await job.remove();
  res.json({ status: 'cancelled' });
});

app.get('/dlq', async (req, res) => {
  const jobs = await dlq.getJobs(['waiting'], 0, 49);
  res.json(jobs.map((j) => ({ id: j.id, ...j.data })));
});

app.post('/dlq/:id/retry', async (req, res) => {
  const job = await dlq.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });

  await notificationQueue.add(job.data.originalName, job.data.originalData);
  await job.remove();
  res.json({ status: 'requeued' });
});

app.post('/hash', validate(hashSchema), async (req, res) => {
  const { text, iterations } = req.body;
  const job = await notificationQueue.add('hash-data', { text, iterations });
  res.json({ status: 'queued', jobId: job.id });
});

app.post('/resize', validate(resizeSchema), async (req, res) => {
  const { file, width } = req.body;
  const job = await notificationQueue.add('resize-image', { file, width });
  res.json({ status: 'queued', jobId: job.id });
});

app.listen(PORT, async () => {
  console.log(`API on :${PORT}`);
  await init();
  console.log('DB ready');
  await setupSchedules();
});
