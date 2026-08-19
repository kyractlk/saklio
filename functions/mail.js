const nodemailer = require("nodemailer");

const SMTP_USER = "saklio@aystech.com.tr";
const SMTP_HOST = "smtp.aystech.com.tr";
const FROM = `"Saklio" <${SMTP_USER}>`;

function makeTransport(pass) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass },
  });
}

async function sendMail({ pass, to, subject, html, text, attachments }) {
  const transporter = makeTransport(pass);
  const info = await transporter.sendMail({
    from: FROM,
    to,
    subject,
    html,
    text: text || undefined,
    attachments: attachments || undefined,
    replyTo: SMTP_USER,
  });
  return { messageId: info.messageId, accepted: info.accepted || [] };
}

module.exports = { sendMail, SMTP_USER, FROM };
