import 'dotenv/config';
import express from 'express';
import Steel from 'steel-sdk';
import puppeteer from 'puppeteer-core';

const app = express();
const steel = new Steel({ steelAPIKey: process.env.STEEL_API_KEY });

app.use(express.static('public'));

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

async function navigateSession(session, destination) {
  let browser;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: session.websocketUrl,
    });
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());
    await page.goto(destination, { waitUntil: 'domcontentloaded' });
  } catch (err) {
    console.error('Unable to navigate session:', err);
  } finally {
    await browser?.disconnect();
  }
}

// Creates a fresh cloud browser session and points it at the requested URL
app.get('/api/session', async (req, res) => {
  try {
    if (typeof req.query.url !== 'string' || !req.query.url.trim()) {
      return res.status(400).json({ error: 'A URL is required.' });
    }

    const destination = new URL(req.query.url);
    if (!['http:', 'https:'].includes(destination.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS links are supported.' });
    }

    // 1. Spin up a real Chrome instance in Steel's cloud
    const session = await steel.sessions.create();

    // Start navigation in the background so the viewer can load immediately.
    void navigateSession(session, destination.href);

    res.json({
      id: session.id,
      viewerUrl: session.debugUrl, // this is the iframe-embeddable live view URL
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
