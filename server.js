const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { readData, writeData, addData } = require('./server/dataStore');

const app = express();

// Enable CORS for the React dev server (configurable for hosted UI)
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const allowedOrigins =
  corsOrigin === '*'
    ? true
    : corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

const smtpPort = Number(process.env.SMTP_PORT);
const transportConfig = {
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
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

const TEACHER_TOKEN =
  process.env.TEACHER_TOKEN || process.env.REACT_APP_TEACHER_TOKEN || '';
function requireTeacher(req, res, next) {
  if (!TEACHER_TOKEN) {
    return res.status(500).json({ error: 'missing teacher token' });
  }
  const token = req.headers['x-teacher-token'];
  if (token && token === TEACHER_TOKEN) return next();
  return res.status(403).json({ error: 'forbidden' });
}

const COLLECTIONS = [
  'awards',
  'attendance',
  'app_settings',
  'badge_defs',
  'groups',
  'meetings',
  'peer_awards',
  'peer_events',
  'peer_moments',
  'semesters',
  'students',
  'teachers',
];

app.get('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).end();
  try {
    const data = await readData(collection);
    res.json(data);
  } catch (err) {
    console.error('Failed to read data', err);
    res.status(500).json({ error: 'failed to read data' });
  }
});

app.post('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).end();
  // Alleen teachers mogen andere collections muteren, students mogen zichzelf registreren
  if (collection !== 'students') {
    requireTeacher(req, res, () => {});
    if (res.headersSent) return;
  }
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const data = await addData(collection, items);
    res.json(data);
  } catch (err) {
    console.error('Failed to add data', err);
    res.status(500).json({ error: 'failed to add data' });
  }
});

app.put('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).end();
  // Alleen teachers mogen andere collections muteren, students mogen zichzelf registreren/updaten
  if (collection !== 'students') {
    requireTeacher(req, res, () => {});
    if (res.headersSent) return;
  }
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const data = await writeData(collection, items);
    res.json(data);
  } catch (err) {
    console.error('Failed to update data', err);
    res.status(500).json({ error: 'failed to update data' });
  }
});

const port = process.env.SERVER_PORT || 3001;
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
