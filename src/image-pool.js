const Piscina = require('piscina');
const path = require('path');

const imagePool = new Piscina({
  filename: path.join(__dirname, 'tasks', 'resize-task.js'),
  minThreads: 1,
  maxThreads: Number(process.env.IMAGE_MAX_THREADS) || 2,
});

module.exports = { imagePool };
