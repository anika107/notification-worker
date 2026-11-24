const notificationQueue = require('../src/queue');

async function setupSchedules() {
  await notificationQueue.upsertJobScheduler(
    'daily-digest',                       // unique scheduler ID
    { pattern: '0 9 * * *', tz: 'UTC' },  // cron: every day at 09:00
    {
      name: 'send-push',
      data: { userId: 1, title: 'Good morning', body: 'Your daily digest' },
    }
  );
  console.log('Schedules ready');
}

module.exports = { setupSchedules };