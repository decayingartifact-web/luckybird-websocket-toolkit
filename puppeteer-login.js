import puppeteer from 'puppeteer';

async function loginAndMonitor() {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();

  // Navigate to luckybird.io login page
  await page.goto('https://luckybird.io/', { waitUntil: 'networkidle2' });

  // Wait for login form elements
  await page.waitForSelector('input[name="username"]');
  await page.waitForSelector('input[name="password"]');

  // Enter credentials
  await page.type('input[name="username"]', 'humanbeing', { delay: 100 });
  await page.type('input[name="password"]', 'password123', { delay: 100 });

  // Submit login form
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);

  console.log('Logged in successfully');

  // Monitor websocket messages by intercepting WebSocket constructor
  await page.exposeFunction('onWebSocketMessage', msg => {
    console.log('WebSocket message:', msg);
  });

  await page.evaluate(() => {
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);
      ws.addEventListener('message', event => {
        if (typeof event.data === 'string') {
          window.onWebSocketMessage(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          const text = new TextDecoder('utf-8').decode(event.data);
          window.onWebSocketMessage(text);
        }
      });
      return ws;
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;
  });

  console.log('WebSocket interception set up');

  // Keep browser open for manual inspection or further automation
  // You can add more automation here as needed

  // For demo, keep open for 5 minutes then close
  await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
  await browser.close();
}

loginAndMonitor().catch(console.error);
