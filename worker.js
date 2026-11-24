const { Worker, UnrecoverableError } = require('bullmq');
const connection = require('./src/connection');
const { sendEmail } = require('./src/email');
const { sendPush } = require('./src/push');
const { sendSms } = require('./src/sms');
const dlq = require('./src/dlq');
const { hashInPool, pool: hashPool } = require('./src/hash-pool');
const path = require('path');
const { imagePool } = require('./src/image-pool');
const { setStatus, pool } = require('./src/db');


const worker = new Worker(
  'notifications',
  async (job) => {
    switch (job.name) {
      case 'send-email':
        if (!job.data.to) {
          throw new UnrecoverableError('Missing "to" field');
        }
        // Skip if this notification was already sent (e.g. a retry after a crash)
        if (job.data.notificationId) {
          const { rows } = await pool.query(
            'SELECT status FROM notifications WHERE id = $1',
            [job.data.notificationId]
          );
          if (rows[0]?.status === 'sent') {
            console.log(`Skipping job ${job.id}: already sent`);
            return;
          }
        }
        if (process.env.FAKE_SEND) {
          await new Promise((r) => setTimeout(r, 50)); // pretend sending takes 0.5s
          return;
        }
        return sendEmail({
          to: job.data.to,
          subject: job.data.subject,
          text: job.data.message,
        });
      case 'send-push':
        return sendPush(job.data);
      case 'send-sms':
        return sendSms(job.data);
      case 'hash-data': {
        const { text, iterations } = job.data;
        if (!text) {
          throw new UnrecoverableError('Missing "text" field');
        }
        const safeIterations = Math.min(Number(iterations) || 2_000_000, 5_000_000);
        const hash = await hashInPool(text, safeIterations);
        return { hash }; // BullMQ stores the return value on the job
      }
      case 'resize-image': {
        const { file, width } = job.data;
        if (!file) throw new UnrecoverableError('Missing "file" field');

        // Only allow files inside ./images (blocks path traversal like "../../.env")
        const imagesDir = path.resolve('images');
        const input = path.resolve(imagesDir, file);
        if (!input.startsWith(imagesDir + path.sep)) {
          throw new UnrecoverableError('Invalid file path');
        }

        const safeWidth = Math.min(Math.max(Number(width) || 400, 16), 2000);
        const output = path.resolve('output', `${job.id}-${safeWidth}.jpg`);

        return imagePool.run({ input, output, width: safeWidth });
      }
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  { connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY) || 5,
    limiter: { max: 100000, duration: 1000 }
  }
);

worker.on('completed', async (job, result) => {
  console.log(`✅ Job ${job.id} (${job.name}) done`, result ? `→ ${String(result.hash).slice(0, 16)}...` : '');
  if (job.data.notificationId) {
    try {
      await setStatus(job.data.notificationId, 'sent');
    } catch (e) {
      console.error('DB update failed:', e.message);
    }
  }
});

worker.on('failed', async (job, err) => {
  if (!job) return;

  const exhausted = job.attemptsMade >= (job.opts.attempts || 1);
  const permanent = err instanceof UnrecoverableError;
  const id = job.data.notificationId;

  try {
    if (!exhausted && !permanent) {
      console.log(`⚠️ Job ${job.id} failed, will retry: ${err.message}`);
      if (id) await setStatus(id, 'retrying', err.message);
      return;
    }

    await dlq.add(
      'dead',
      {
        originalName: job.name,
        originalData: job.data,
        error: err.message,
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      },
      { jobId: `dead-${job.id}` }
    );
    console.log(`☠️ Job ${job.id} moved to DLQ: ${err.message}`);
    if (id) await setStatus(id, 'dead', err.message);
  } catch (e) {
    console.error('failed-handler error:', e.message);
  }
});


worker.on('error', (err) => {
  console.error('Worker error:', err.message); // e.g. Redis connection problems
});

async function shutdown(signal) {
  console.log(`${signal} received, closing worker...`);
  await worker.close();
  await hashPool.destroy();
  await imagePool.destroy();
  await connection.quit();
  console.log('Worker closed cleanly');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')); 

setInterval(() => {
  console.log(`pool: total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`);
}, 500);
