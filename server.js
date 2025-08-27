require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

const smtpPort = Number(process.env.SMTP_PORT);
const transportConfig = {
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

if (process.env.SMTP_SERVICE) {
  transportConfig.service = process.env.SMTP_SERVICE;
}

const transporter = nodemailer.createTransport(transportConfig);

if (
  process.env.SMTP_FROM &&
  process.env.SMTP_USER &&
  process.env.SMTP_FROM !== process.env.SMTP_USER
) {
  console.warn('SMTP_FROM differs from SMTP_USER; some providers may reject the message');
}

app.post('/api/send-reset', async (req, res) => {
  const { email, link } = req.body || {};
  if (!email || !link) {
    return res.status(400).json({ error: 'missing email or link' });
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Wachtwoord resetten',
      text: `Gebruik de volgende link om je wachtwoord te resetten: ${link}`,
      html: `<p>Gebruik de volgende link om je wachtwoord te resetten:</p><p><a href="${link}">${link}</a></p>`,
    });
    console.log('Mail send result', info.accepted, info.rejected);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to send email', err);
    res.status(500).json({ error: 'failed to send email' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Email server listening on port ${port}`);
});
