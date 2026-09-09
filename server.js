import 'dotenv/config';
import express from 'express';
import Steel from 'steel-sdk';
import puppeteer from 'puppeteer-core';

const app = express();
const steel = new Steel({ steelAPIKey: process.env.STEEL_API_KEY });

app.use(express.static('public'));

// Creates a fresh cloud browser session and points it at Marketplace
app.get('/api/session', async (req, res) => {
  try {
    // 1. Spin up a real Chrome instance in Steel's cloud
    const session = await steel.sessions.create();

    // 2. Connect to it over the Chrome DevTools Protocol and navigate
    const browser = await puppeteer.connect({
      browserWSEndpoint: session.websocketUrl,
    });
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());
    await page.goto('https://www.facebook.com/marketplace', {
      waitUntil: 'domcontentloaded',
    });
    // We disconnect (not close) so the remote session keeps running
    // and you take over driving it yourself via the live view.
    await browser.disconnect();

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
