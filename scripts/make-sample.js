const sharp = require('sharp');
const fs = require('fs');

fs.mkdirSync('images', { recursive: true });
fs.mkdirSync('output', { recursive: true });

sharp({
  create: {
    width: 3000,
    height: 2000,
    channels: 3,
    noise: { type: 'gaussian', mean: 128, sigma: 40 },
  },
})
  .jpeg()
  .toFile('images/sample.jpg')
  .then((info) => console.log('Created images/sample.jpg', info.size, 'bytes'));