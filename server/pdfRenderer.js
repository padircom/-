/**
 * تولید PDF واقعی (باینری) از HTML آمادهٔ چاپ، با Headless Chromium.
 * ترتیب یافتن مرورگر: PDF_BROWSER_PATH ← مرورگر سیستمی (Chrome/Chromium/Edge)
 * ← Chromium توکار ‎@sparticuz/chromium (لینوکس، وابستگی اختیاری).
 * اگر هیچ مرورگری در دسترس نباشد خطا پرتاب می‌شود تا مسیر فراخوان به‌جای PDF،
 * HTML را به نام PDF تحویل ندهد.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
let browserPromise = null;
let fontCssPromise = null;

function systemCandidates() {
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles ?? 'C:\\Program Files';
    const pfx86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    return [
      path.join(pfx86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(pfx86, 'Google\\Chrome\\Application\\chrome.exe'),
    ];
  }
  return ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
}

/** استخراج حداقلی ustar برای کتابخانه‌های همراه Chromium توکار (فقط lib/*.so*). */
async function extractBundledLibs() {
  const target = path.join(os.tmpdir(), 'arena-pdf-libs', 'lib');
  const marker = path.join(target, 'libnss3.so');
  if (existsSync(marker)) return target;
  const archiveUrl = new URL('../node_modules/@sparticuz/chromium/bin/al2023.tar.br', import.meta.url);
  if (!existsSync(archiveUrl)) return null;
  const tar = zlib.brotliDecompressSync(await readFile(archiveUrl));
  await mkdir(target, { recursive: true });
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8);
    const type = String.fromCharCode(header[156]);
    offset += 512;
    if ((type === '0' || type === '\0') && name.startsWith('lib/') && name.includes('.so')) {
      const safeName = path.basename(name);
      await writeFile(path.join(target, safeName), tar.subarray(offset, offset + size));
    }
    offset += Math.ceil(size / 512) * 512;
  }
  return existsSync(marker) ? target : null;
}

async function launchBrowser() {
  const puppeteer = (await import('puppeteer-core')).default;
  const baseArgs = ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];
  const envPath = process.env.PDF_BROWSER_PATH;
  if (envPath && existsSync(envPath)) return puppeteer.launch({ executablePath: envPath, headless: true, args: baseArgs });
  for (const candidate of systemCandidates()) {
    if (existsSync(candidate)) return puppeteer.launch({ executablePath: candidate, headless: true, args: baseArgs });
  }
  if (process.platform !== 'win32') {
    const chromium = (await import('@sparticuz/chromium')).default;
    const executablePath = await chromium.executablePath();
    const libDir = await extractBundledLibs().catch(() => null);
    const env = libDir ? { ...process.env, LD_LIBRARY_PATH: [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter) } : process.env;
    return puppeteer.launch({ executablePath, headless: true, args: [...chromium.args, ...baseArgs], env });
  }
  throw new Error('PDF_BROWSER_NOT_FOUND');
}

async function getBrowser() {
  if (!browserPromise) browserPromise = launchBrowser().catch(err => { browserPromise = null; throw err; });
  const browser = await browserPromise;
  if (!browser.connected) { browserPromise = null; return getBrowser(); }
  return browser;
}

/** فونت Vazirmatn مخزن به‌صورت data URI تا PDF روی هر سروری همان فونت رابط را داشته باشد. */
async function fontCss() {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      const faces = [];
      for (const file of ['vazirmatn-arabic-wght-normal.woff2', 'vazirmatn-latin-wght-normal.woff2', 'vazirmatn-latin-ext-wght-normal.woff2']) {
        try {
          const data = await readFile(path.join(serverDir, '..', 'src', 'assets', 'fonts', file));
          faces.push(`@font-face{font-family:'Vazirmatn';src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');font-weight:100 900;font-style:normal;font-display:swap;}`);
        } catch { /* نبود زیرمجموعهٔ فونت نباید تولید PDF را متوقف کند */ }
      }
      return faces.join('\n');
    })().catch(() => '');
  }
  return fontCssPromise;
}

export async function htmlToPdf(html) {
  const css = await fontCss();
  const fullHtml = css && html.includes('</head>') ? html.replace('</head>', `<style>${css}</style></head>`) : html;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(fullHtml, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => null);
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
