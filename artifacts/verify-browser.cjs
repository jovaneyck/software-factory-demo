const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const appRequire = createRequire(path.resolve(__dirname, '../app/package.json'));
const { chromium } = appRequire('playwright');
const Papa = appRequire('papaparse');

async function main() {
  const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5847';
  const dataRoot = path.resolve(__dirname, '../app/backend/data');
  const screenshots = path.join(__dirname, 'screenshots');
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let emptyDogId;
  try {
    const dogs = await (await page.request.get(`${baseUrl}/api/dogs`)).json();
    const dog = dogs.find((candidate) => candidate.name === 'Django');
    assert.ok(dog, 'Seeded Django must exist');
    const records = fs.readdirSync(path.join(dataRoot, 'sessions'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(fs.readFileSync(path.join(dataRoot, 'sessions', file), 'utf8')))
      .filter((session) => session.dogId === dog.id && ['completed', 'skipped'].includes(session.status))
      .sort((first, second) => first.date.localeCompare(second.date) || first.id.localeCompare(second.id));
    assert.ok(records.length > 0, 'Proof requires recorded sessions');
    await page.goto(`${baseUrl}/progress?dog=${dog.id}`);
    await page.getByRole('button', { name: 'Leash training', exact: true }).waitFor();
    await page.screenshot({ path: path.join(screenshots, 'report-trainings-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Leash training', exact: true }).click();
    await page.getByTestId('progress-graph').locator('svg').waitFor();
    await page.screenshot({ path: path.join(screenshots, 'report-graph-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export all sessions (CSV)', exact: true }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), `training-sessions-${dog.id}.csv`);
    const downloadPath = path.join(__dirname, 'training-sessions-sample.csv');
    await download.saveAs(downloadPath);
    const bytes = fs.readFileSync(downloadPath);
    assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191], 'UTF-8 BOM');
    const parsed = Papa.parse(bytes.toString('utf8'), { header: true, skipEmptyLines: true });
    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(parsed.data.map((row) => row.sessionId), records.map((record) => record.id));
    assert.ok(parsed.data.every((row) => row.dogId === dog.id));
    assert.ok(new Set(parsed.data.map((row) => row.trainingId)).size > 1, 'Export must ignore the selected training');
    assert.ok(records.some((record) => new Date(record.date) < new Date(Date.now() - 7 * 86400000)), 'Export must ignore the week filter');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByTestId('progress-graph').locator('svg').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No mobile horizontal overflow');
    assert.ok(await page.getByRole('button', { name: 'Export all sessions (CSV)' }).isVisible());
    await page.screenshot({ path: path.join(screenshots, 'report-graph-mobile.png'), fullPage: true });
    const exportPattern = '**/sessions/export.csv';
    await page.route(exportPattern, (route) => route.fulfill({ status: 500, body: 'Export failed' }));
    await page.getByRole('button', { name: 'Export all sessions (CSV)' }).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /Could not export/);
    await page.screenshot({ path: path.join(screenshots, 'report-export-error-mobile.png'), fullPage: true });
    await page.unroute(exportPattern);
    const retryPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export all sessions (CSV)' }).click();
    await retryPromise;
    assert.equal(await page.getByRole('alert').count(), 0);
    const created = await page.request.post(`${baseUrl}/api/dogs`, { multipart: {
      name: 'CSV proof - no plan',
      picture: { name: 'proof.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(dataRoot, 'dogs/uploads', dog.picture)) },
    } });
    assert.equal(created.status(), 201);
    emptyDogId = (await created.json()).id;
    await page.goto(`${baseUrl}/progress?dog=${emptyDogId}`);
    await page.getByRole('button', { name: 'Export all sessions (CSV)' }).waitFor();
    const emptyPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export all sessions (CSV)' }).click();
    const emptyDownload = await emptyPromise;
    const emptyPath = await emptyDownload.path();
    const emptyCsv = fs.readFileSync(emptyPath, 'utf8');
    assert.equal(emptyCsv, '\uFEFFdate,dogName,dogId,trainingName,trainingId,planId,sessionId,status,score,notes\r\n');
    await page.screenshot({ path: path.join(screenshots, 'report-empty-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Change dog' }).click();
    assert.equal(await page.getByRole('button', { name: 'Export all sessions (CSV)' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', exportedRecords: records.length, screenshots: fs.readdirSync(screenshots), checks: ['actual browser download', 'UTF-8 BOM and parseable CSV', 'all persisted records in date order', 'dog isolation', 'training/week filters ignored', 'desktop and mobile report', 'no mobile overflow', 'HTTP error and retry', 'empty history without plan', 'no export without dog', 'no browser exceptions'] }, null, 2));
  } finally {
    if (emptyDogId) await page.request.delete(`${baseUrl}/api/dogs/${emptyDogId}`);
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });