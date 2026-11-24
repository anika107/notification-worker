const { Worker } = require('worker_threads');
const path = require('path');

function hashInThread(password, iterations = 2_000_000) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'tasks', 'hash-worker.js'), {
      workerData: { password, iterations },
    });

    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

module.exports = { hashInThread };
