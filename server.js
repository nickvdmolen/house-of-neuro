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

// Log the SMTP configuration (without password) for easier debugging
console.debug('SMTP configuration', {
  host: transportConfig.host,
  port: transportConfig.port,
  secure: transportConfig.secure,
  service: transportConfig.service,
  user: transportConfig.auth && transportConfig.auth.user,
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
});

// Verify the connection to the SMTP server so issues are surfaced early
transporter
  .verify()
  .then(() => console.log('SMTP connection verified'))
  .catch((err) => console.error('SMTP verify failed', err));

if (
  process.env.SMTP_FROM &&
  process.env.SMTP_USER &&
  process.env.SMTP_FROM !== process.env.SMTP_USER
) {
  console.warn(
    'SMTP_FROM differs from SMTP_USER; some providers may reject the message'
  );
}

app.post('/api/send-reset', async (req, res) => {
  const { email, link } = req.body || {};
  console.debug('Incoming reset request', { email, link });
  if (!email || !link) {
    console.warn('Missing email or link in reset request');
    return res.status(400).json({ error: 'missing email or link' });
  }
  try {
    console.debug('Sending reset email', { to: email });
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Wachtwoord resetten',
      text: `Gebruik de volgende link om je wachtwoord te resetten: ${link}`,
      html: `<p>Gebruik de volgende link om je wachtwoord te resetten:</p><p><a href="${link}">${link}</a></p>`,
    });
    console.debug('Mail send result', {
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      messageId: info.messageId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to send email', err);
    res.status(500).json({ error: 'failed to send email' });
  }
});

const port = process.env.SERVER_PORT || 3001;
app.listen(port, () => {
  console.log(`Email server listening on port ${port}`);
});
