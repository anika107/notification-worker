async function sendPush({ userId, title, body }) {
  console.log(`[PUSH] user=${userId} | ${title} | ${body}`);
}

module.exports = { sendPush };