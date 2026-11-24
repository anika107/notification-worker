const Piscina = require('piscina');
const path = require('path');
const os = require('os');

const pool = new Piscina({
  filename: path.join(__dirname, 'tasks', 'hash-task.js'),
  minThreads: 2,
  maxThreads: Number(process.env.HASH_MAX_THREADS) || Math.max(2, os.availableParallelism() - 1),
});

function hashInPool(password, iterations = 2_000_000) {
  return pool.run({ password, iterations });
}

module.exports = { hashInPool, pool };
