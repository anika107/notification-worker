const queue = require('../src/queue');

(async () => {
  for (let i = 1; i <= 5; i++) {
    await queue.add('send-email', { to: 'a@b.com', subject: `Test ${i}`, message: 'hi' });
  }
  console.log('Added 5 jobs');
  process.exit(0);
})();
