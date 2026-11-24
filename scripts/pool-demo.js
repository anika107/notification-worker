const { hashInPool, pool } = require('../src/hash-pool');

let last = Date.now();
const timer = setInterval(() => {
  const now = Date.now();
  console.log(`heartbeat (gap: ${now - last}ms)`);
  last = now;
}, 200);

(async () => {
  console.log(`threads: ${pool.threads.length}, max: ${pool.options.maxThreads}`);
  const start = Date.now();

  const jobs = [];
  for (let i = 1; i <= 8; i++) {
    jobs.push(
      hashInPool(`password-${i}`).then(() =>
        console.log(`job ${i} done at ${Date.now() - start}ms (queue: ${pool.queueSize})`)
      )
    );
  }

  await Promise.all(jobs);
  console.log(`all 8 done in ${Date.now() - start}ms`);
  clearInterval(timer);
  await pool.destroy(); // close the threads so the script can exit
})();
