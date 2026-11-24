const crypto = require('crypto');

function sha(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function dashboardAuth(req, res, next) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;

  // Fail closed: no credentials configured means no dashboard
  if (!user || !pass) {
    return res.status(503).send('Dashboard not configured');
  }

  const header = req.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  const decoded = scheme === 'Basic' && encoded
    ? Buffer.from(encoded, 'base64').toString()
    : '';
  const i = decoded.indexOf(':');
  const givenUser = i >= 0 ? decoded.slice(0, i) : '';
  const givenPass = i >= 0 ? decoded.slice(i + 1) : '';

  const ok =
    crypto.timingSafeEqual(sha(givenUser), sha(user)) &&
    crypto.timingSafeEqual(sha(givenPass), sha(pass));

  if (!ok) {
    res.set('WWW-Authenticate', 'Basic realm="Queue dashboard"');
    return res.status(401).send('Authentication required');
  }
  next();
}

module.exports = { dashboardAuth };