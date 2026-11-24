const { pool } = require('../src/db');

(async () => {
  const { rows } = await pool.query('SELECT now() AS time');
  console.log('Connected:', rows[0].time);
  await pool.end(); // close the pool so the script can exit
})().catch((e) => {
  console.error('DB error:', e.message);
  process.exit(1);
});
