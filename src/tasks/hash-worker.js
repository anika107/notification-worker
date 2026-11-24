const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');

const { password, iterations } = workerData;

// This blocks THIS thread only, not the main one
const hash = crypto
  .pbkdf2Sync(password, 'salt', iterations, 64, 'sha512')
  .toString('hex');

parentPort.postMessage(hash); // send the result back