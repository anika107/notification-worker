require('dotenv').config();
const queue = require('../src/queue');

let lastDone = null;
let lastTime = Date.now();

setInterval(async () => {
  const c = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
  const now = Date.now();

  // 'completed' only grows if removeOnComplete is off, so track waiting+active instead
  const pending = c.waiting + c.active;
  if (lastDone !== null) {
    const drained = lastDone - pending;
    const perSec = (drained / ((now - lastTime) / 1000)).toFixed(0);
    console.log(`waiting=${c.waiting} active=${c.active} failed=${c.failed} | net drain ≈ ${perSec}/s`);
  } else {
    console.log(`waiting=${c.waiting} active=${c.active} failed=${c.failed}`);
  }
  lastDone = pending;
  lastTime = now;
}, 1000);
