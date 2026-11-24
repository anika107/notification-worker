async function sendSms({ phone, message }) {
  console.log(`[SMS] to=${phone} | ${message}`);
}

module.exports = { sendSms };