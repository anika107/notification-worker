const crypto = require('crypto');

// Heartbeat: should print every 100ms if the event loop is healthy
let last = Date.now();
const timer = setInterval(() => {
  const now = Date.now();
  console.log(`heartbeat (gap: ${now - last}ms)`);
  last = now;
}, 100);

// CPU-heavy work: hashing with many iterations (blocks the thread)
function heavyHash() {
  return crypto.pbkdf2Sync('password', 'salt', 2_000_000, 64, 'sha512');
}

setTimeout(() => {
  console.log('--- starting heavy work ---');
  const start = Date.now();
  heavyHash();
  console.log(`--- heavy work done in ${Date.now() - start}ms ---`);
}, 500);

setTimeout(() => clearInterval(timer), 4000);