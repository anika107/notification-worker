require('dotenv').config();

const nodemailer = require('nodemailer');
console.log('USER set?', !!process.env.SMTP_USER);
console.log('PASS set?', !!process.env.SMTP_PASS);
console.log('CWD:', process.cwd());
const transporter = nodemailer.createTransport({
  host: 'sandbox.smtp.mailtrap.io',
  port: 2525,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
});

async function sendEmail({ to, subject, text }) {
  const info = await transporter.sendMail({
    from: '"My App" <no-reply@myapp.com>',
    to,
    subject,
    text,
  });
  console.log('Email sent:', info.messageId, info.response);
}

module.exports = { sendEmail };