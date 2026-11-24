const { hashInThread } = require('../src/hash-in-thread');

let last = Date.now();
const timer = setInterval(() => {
  const now = Date.now();
  console.log(`heartbeat (gap: ${now - last}ms)`);
  last = now;
}, 100);

setTimeout(async () => {
  console.log('--- starting heavy work in a thread ---');
  const start = Date.now();
  const hash = await hashInThread('password');
  console.log(`--- done in ${Date.now() - start}ms, hash starts ${hash.slice(0, 16)}... ---`);
}, 500);

setTimeout(() => clearInterval(timer), 4000);
