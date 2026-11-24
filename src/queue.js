const { Queue } = require('bullmq');
const connection = require('./connection');

const notificationQueue = new Queue('notifications', { connection,
    defaultJobOptions: {
    attempts: 3,                                  // try up to 3 times total
    backoff: { type: 'exponential', delay: 2000 }, // wait 2s, then 4s, ...
    removeOnComplete: true,                       // don't pile up finished jobs in Redis
    removeOnFail: 100,                            // keep only the last 100 failed jobs
  },
 });

module.exports = notificationQueue;