const crypto = require('crypto');

function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;

  // Fail closed: if no key is configured, refuse everything
  if (!expected) {
    return res.status(500).json({ error: 'Server auth not configured' });
  }

  const provided = req.get('x-api-key') || '';

  // Hash both sides so they have equal length, then compare in constant time
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();

  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { requireApiKey };