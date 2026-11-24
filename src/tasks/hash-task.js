const crypto = require('crypto');

// Piscina calls this function inside a pooled thread
module.exports = ({ password, iterations }) => {
  return crypto
    .pbkdf2Sync(password, 'salt', iterations, 64, 'sha512')
    .toString('hex');
};