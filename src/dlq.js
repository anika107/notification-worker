const { Queue } = require('bullmq');
const connection = require('./connection');

const dlq = new Queue('notifications-dlq', { connection });

module.exports = dlq;
