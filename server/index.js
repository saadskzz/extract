import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

const app = express();
const port = 3003;

app.use(cors());
app.use(express.json());

// Utility function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to extract streaming URLs from HTML or text content
function extractStreamURLs(content) {
  const urls = new Set();
  const $ = cheerio.load(content);

  // Stream-related extensions and patterns
  const streamPatterns = [
    /\.m3u8(\?.*)?$/i, // HLS
    /\.mpd(\?.*)?$/i, // MPEG-DASH
    /\.ts(\?.*)?$/i, // Transport Stream segments
    /\.aac(\?.*)?$/i, // Audio segments
    /blob:http(s)?:\/\/[^\s"'`]+/i, // Blob URLs
    /(wss?|ws):\/\/[^\s"'`]+/i, // WebSocket URLs (potential WebRTC signaling)
    /https?:\/\/[^\s"'`]+\.(m3u8|mpd|ts|aac)[^\s"'`]*(?:\?[^"'`]+)?/i, // Streams with query params
    /https?:\/\/[^\s"'`]+(?:\?token=|key=|auth=)[^\s"'`]+/i, // Tokenized URLs
  ];

  // Extract from scripts
  $('script').each((i, elem) => {
    const scriptContent = $(elem).html();
    if (scriptContent) {
      streamPatterns.forEach(pattern => {
        const matches = scriptContent.match(new RegExp(pattern, 'gi'));
        if (matches) matches.forEach(url => urls.add(url));
      });
      // Handle quoted URLs
      const quotedMatches = scriptContent.match(/["'`](https?:\/\/[^"'`]*\.(m3u8|mpd|ts|aac)[^"'`]*|blob:http(s)?:\/\/[^"'`]+|wss?:\/\/[^"'`]+)["'`]/gi);
      if (quotedMatches) quotedMatches.forEach(match => urls.add(match.replace(/["'`]/g, '')));
    }
  });

  // Extract from attributes (e.g., data-*, src, href)
  $('*').each((i, elem) => {
    const attributes = elem.attribs;
    if (attributes) {
      Object.values(attributes).forEach(value => {
        if (typeof value === 'string') {
          streamPatterns.forEach(pattern => {
            const matches = value.match(new RegExp(pattern, 'gi'));
            if (matches) matches.forEach(url => urls.add(url));
          });
        }
      });
    }
  });

  // Extract from media elements
  $('source, video, audio').each((i, elem) => {
    const src = $(elem).attr('src');
    if (src) streamPatterns.forEach(pattern => {
      if (pattern.test(src)) urls.add(src);
    });
  });

  // Global regex matches
  streamPatterns.forEach(pattern => {
    const matches = content.match(new RegExp(pattern, 'gi'));
    if (matches) matches.forEach(url => urls.add(url));
  });

  return Array.from(urls);
}

// Function to hook WebRTC and Blob URLs
async function injectStreamHooks(page) {
  await page.evaluateOnNewDocument(() => {
    // Hook RTCPeerConnection for WebRTC
    const OriginalRTCPeerConnection = window.RTCPeerConnection;
    window.RTCPeerConnection = function (...args) {
      const pc = new OriginalRTCPeerConnection(...args);
      pc.addEventListener('track', e => {
        if (e.streams && e.streams[0]) {
          console.log('WebRTC stream detected:', e.streams[0].id);
          window.__streamURLs = window.__streamURLs || [];
          window.__streamURLs.push(`webrtc-stream:${e.streams[0].id}`);
        }
      });
      return pc;
    };

    // Hook WebSocket for signaling
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function (url, ...args) {
      console.log('WebSocket connection:', url);
      window.__streamURLs = window.__streamURLs || [];
      window.__streamURLs.push(url);
      return new OriginalWebSocket(url, ...args);
    };

    // Hook URL.createObjectURL for Blob URLs
    const OriginalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function (obj) {
      const url = OriginalCreateObjectURL(obj);
      console.log('Blob URL created:', url);
      window.__streamURLs = window.__streamURLs || [];
      window.__streamURLs.push(url);
      return url;
    };
  });
}

app.post('/api/extract-streams', async (req, res) => {
  let browser;
  try {
    const { url, cookies } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log(`Fetching URL with Puppeteer: ${url}`);
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--disable-features=IsolateOrigins,site-per-process',
        '--ignore-certificate-errors',
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://www.google.com/',
    });

    // Set cookies if provided
    if (cookies && Array.isArray(cookies)) {
      await page.setCookie(...cookies);
      console.log('Applied provided cookies:', cookies.length);
    }

    // Inject WebRTC and Blob URL hooks
    await injectStreamHooks(page);

    // Enable request interception
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Monitor network responses
    const streamUrls = new Set();
    const networkLogs = [];
    await page.on('response', async response => {
      const respUrl = response.url();
      const headers = response.headers();
      const contentType = headers['content-type'] || '';
      networkLogs.push({ url: respUrl, type: response.request().resourceType(), headers, contentType });

      // Check for streaming content types
      if (
        contentType.includes('application/x-mpegURL') ||
        contentType.includes('application/dash+xml') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        respUrl.match(/\.(m3u8|mpd|ts|aac)(\?.*)?$/i)
      ) {
        console.log('Found stream response:', respUrl, contentType);
        streamUrls.add(respUrl);
      }

      // Parse response body for URLs
      if (['xhr', 'fetch'].includes(response.request().resourceType())) {
        try {
          const text = await response.text();
          extractStreamURLs(text).forEach(url => streamUrls.add(url));
        } catch (e) {
          console.log('Non-text response:', e.message);
        }
      }
    });

    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for media elements
    try {
      await page.waitForSelector('video, audio, source, [data-hls-url], [data-dash-url], iframe, [class*="player"], [id*="player"]', { timeout: 15000 });
    } catch (e) {
      console.log('No media elements found within timeout:', e.message);
    }

    // Simulate user interactions
    try {
      await page.evaluate(() => {
        const selectors = [
          'button',
          '[id*="play"]',
          '[class*="play"]',
          '[class*="player"]',
          'video',
          'audio',
          '.vjs-big-play-button',
          '[id*="stream"]',
          '[class*="stream"]',
          '[class*="btn"]',
          '[data-stream]',
          '.jwplayer',
          '[class*="live"]',
          '[class*="control"]',
          '[data-player]',
        ];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            el.click();
            console.log(`Clicked element: ${selector}`);
          });
        }
      });
      await delay(10000);
    } catch (e) {
      console.log('Interaction failed:', e.message);
    }

    // Process iframes recursively
    const iframeSources = [];
    async function processIframes(page, depth = 0, maxDepth = 5) {
      if (depth >= maxDepth) return;
      const iframes = await page.$$('iframe');
      for (const iframe of iframes) {
        try {
          const src = await iframe.evaluate(el => el.src);
          if (src) iframeSources.push({ depth: depth + 1, src });
          const frame = await iframe.contentFrame();
          if (frame) {
            const frameHtml = await frame.content();
            extractStreamURLs(frameHtml).forEach(url => streamUrls.add(url));
            console.log(`Processed iframe at depth ${depth + 1}, HTML length: ${frameHtml.length}, src: ${src || 'none'}`);
            if (src && (src.includes('stream') || src.includes('player'))) {
              try {
                const framePage = await browser.newPage();
                await framePage.goto(src, { waitUntil: 'networkidle2', timeout: 30000 });
                extractStreamURLs(await framePage.content()).forEach(url => streamUrls.add(url));
                await processIframes(framePage, depth + 1, maxDepth);
                await framePage.close();
              } catch (e) {
                console.log('Iframe src navigation failed:', e.message);
              }
            }
            await processIframes(frame, depth + 1, maxDepth);
          }
        } catch (e) {
          console.log('Iframe processing failed:', e.message);
        }
      }
    }
    await processIframes(page);

    // Collect hooked URLs (WebRTC, WebSocket, Blob)
    const hookedUrls = await page.evaluate(() => window.__streamURLs || []);
    hookedUrls.forEach(url => streamUrls.add(url));

    // Wait for pending network requests
    await delay(5000);

    // Get rendered HTML
    const html = await page.content();
    console.log(`HTML content length: ${html.length}`);
    fs.writeFileSync('debug.html', html);
    fs.writeFileSync('network.json', JSON.stringify(networkLogs, null, 2));
    fs.writeFileSync('iframes.json', JSON.stringify(iframeSources, null, 2));

    // Verify URLs
    const pageCookies = await page.cookies();
    const cookieHeader = pageCookies.map(c => `${c.name}=${c.value}`).join('; ');
    const verifiedUrls = [];
    for (const url of streamUrls) {
      if (!url || typeof url !== 'string' || url.startsWith('webrtc-stream:')) {
        console.log('Skipping verification for:', url);
        verifiedUrls.push(url);
        continue;
      }
      try {
        const response = await axios.head(url, {
          headers: {
            Cookie: cookieHeader,
            Referer: page.url(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 5000,
        });
        if (response.status < 400) verifiedUrls.push(url);
      } catch (e) {
        console.log(`Failed to verify ${url}:`, e.message);
      }
    }

    // Merge URLs
    const allStreamURLs = [...new Set([...streamUrls, ...extractStreamURLs(html), ...verifiedUrls])]
      .filter(url => url && typeof url === 'string');

    if (allStreamURLs.length === 0) {
      console.log('HTML preview (first 500 chars):', html.substring(0, 500));
      return res.status(404).json({
        error: 'No streaming links found on this page',
        suggestion: 'The page might use protected streams, require specific interactions, or load streams in uncaptured iframes. Check debug.html, network.json, and iframes.json.',
        details: `Analyzed ${html.length} characters of rendered HTML content.`,
        htmlPreview: html.substring(0, 200),
        networkLogCount: networkLogs.length,
        iframeSources: iframeSources,
      });
    }

    console.log('Found stream URLs:', allStreamURLs);
    res.json({
      success: true,
      primaryUrl: allStreamURLs[0],
      allUrls: allStreamURLs,
      count: allStreamURLs.length,
      contentLength: html.length,
    });
  } catch (error) {
    console.error('Error:', error.message, error.stack);
    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      return res.status(400).json({ error: 'Domain not found', details: 'Check the URL.', errorCode: 'ENOTFOUND' });
    }
    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      return res.status(400).json({ error: 'Connection refused', details: 'Server may be down.', errorCode: 'ECONNREFUSED' });
    }
    if (error.name === 'TimeoutError') {
      return res.status(408).json({ error: 'Request timeout', details: 'Page took too long to load.', errorCode: 'ETIMEDOUT' });
    }
    return res.status(500).json({
      error: 'Request failed',
      details: `Error: ${error.message}`,
      errorCode: error.code || 'UNKNOWN',
    });
  } finally {
    if (browser) await browser.close();
    console.log('Browser closed.');
  }
});

app.listen(port, () => {
  console.log(`Stream Extractor server running on http://localhost:${port}`);
});