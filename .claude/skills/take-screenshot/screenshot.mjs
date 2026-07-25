import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.argv[2] || 'http://localhost:5173';
const filename = process.argv[3] || 'screenshot.png';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outputDir = path.join(repoRoot, 'screenshots');
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, filename);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: output, fullPage: true });
await browser.close();
console.log(`Saved ${output}`);
