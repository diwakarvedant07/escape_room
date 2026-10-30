/*
 * Headless browser tests for dist/game.html.
 * Needs SET_A_PASSWORD and SET_B_PASSWORD (environment or .env) and a fresh build.
 * Uses the installed Microsoft Edge or Google Chrome through playwright-core.
 *
 *   node build.js && node --test tests/
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright-core');
const { leakCheck, readPrivate, normalise } = require('../build.js');

const ROOT = path.join(__dirname, '..');
const GAME = path.join(ROOT, 'dist', 'game.html');
const GAME_URL = pathToFileURL(GAME).href;

// Same tiny .env reader as build.js so tests and build agree.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const PASSWORDS = { A: normalise(process.env.SET_A_PASSWORD || ''), B: normalise(process.env.SET_B_PASSWORD || '') };
const PRIV = readPrivate();
const VERDICTS = id => PRIV[id].emails.map(e => e.verdict.toLowerCase());

let browser;
before(async () => {
  assert.ok(PASSWORDS.A && PASSWORDS.B, 'Set SET_A_PASSWORD and SET_B_PASSWORD before running the tests');
  assert.ok(fs.existsSync(GAME), 'dist/game.html is missing: run node build.js first');
  for (const channel of ['msedge', 'chrome']) {
    try { browser = await chromium.launch({ channel, headless: true }); break; } catch (e) { /* try next */ }
  }
  assert.ok(browser, 'Could not launch Edge or Chrome');
});
after(async () => { if (browser) await browser.close(); });

async function newPage(opts = {}) {
  // The game's CSP forbids eval, which Playwright's waitForFunction needs.
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, bypassCSP: true });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
  page.requests = requests;
  if (opts.clock) await page.clock.install();
  await page.goto(GAME_URL);
  return page;
}

async function startGame(page, id, team = 'Blue Team') {
  await page.check(`#set-${id}`);
  await page.fill('#team', team);
  await page.click('#btn-start');
  await page.waitForSelector('#screen-briefing:not([hidden])');
  await page.click('#btn-open-inbox');
  await page.waitForSelector('#screen-game:not([hidden])');
}

async function markAll(page, verdicts) {
  for (let i = 0; i < verdicts.length; i++) {
    await page.click(`#inbox-list button[data-i="${i}"]`);
    await page.click(`.vbtn[data-v="${verdicts[i]}"]`);
  }
}

// The letter tray is a side-panel tab (a drawer on narrower screens).
async function openTray(page) {
  if (await page.isVisible('#pw')) return;
  if (await page.isVisible('#bar-tray')) await page.click('#bar-tray');
  else await page.click('#tab-tray');
  await page.waitForSelector('#pw', { state: 'visible' });
}

async function openLookup(page) {
  if (await page.isVisible('#lk-type')) return;
  if (await page.isVisible('#bar-lookup')) await page.click('#bar-lookup');
  else await page.click('#tab-lookup');
  await page.waitForSelector('#lk-type', { state: 'visible' });
}

async function lookup(page, type, a, b) {
  await openLookup(page);
  await page.selectOption('#lk-type', type);
  await page.fill('#lk-a', a);
  if (b !== undefined) await page.fill('#lk-b', b);
  await page.click('#lk-go');
  return page.textContent('#lk-out');
}

async function submit(page, word) {
  await openTray(page);
  await page.fill('#pw', word);
  await page.click('#btn-submit');
  // Wait until the check finishes (button label goes back to Submit).
  await page.waitForFunction(() => document.querySelector('#btn-submit').textContent.trim() === 'Submit', null, { timeout: 30000 });
}

const trayText = page => page.$$eval('#tiles .tile', ts => ts.map(t => t.textContent).join(''));
const statusText = page => page.waitForFunction(() => document.querySelector('#status').textContent.trim(), null, { timeout: 5000 }).then(h => h.jsonValue());

for (const id of ['A', 'B']) {
  test(`(a) Set ${id}: correct markings + correct password unlock the debrief`, async () => {
    const page = await newPage();
    await startGame(page, id);
    assert.ok(await page.isDisabled('#btn-submit'), 'Submit must be disabled before all 10 are marked');
    await markAll(page, VERDICTS(id));
    assert.equal(await page.textContent('#marked-count'), '10 of 10 marked');

    const tray = await trayText(page);
    assert.equal([...tray].sort().join(''), [...PASSWORDS[id]].sort().join(''), 'tray letters are an anagram of the password');

    // Messy input proves trim + uppercase.
    await submit(page, '  ' + PASSWORDS[id].toLowerCase() + ' ');
    await page.waitForSelector('#screen-result:not([hidden])', { timeout: 30000 });
    assert.equal(await page.textContent('#unlocked-word'), PASSWORDS[id]);
    assert.equal(await page.textContent('#stat-score'), '10 / 10');
    assert.equal(await page.textContent('#stat-attempts'), '1');
    assert.equal(await page.locator('#debrief-list > li').count(), 10);
    const first = await page.textContent('#debrief-list > li:first-child');
    assert.ok(first.includes(PRIV[id].emails[0].giveaway), 'debrief shows the giveaway from the encrypted payload');
    assert.ok(first.includes(PRIV[id].emails[0].whyHard), 'debrief shows why it was hard');
    assert.equal(await page.locator('#debrief-list .mark-ok').count(), 10);
    assert.ok((await page.textContent('#debrief-note')).includes(PRIV[id].teachingPairs));

    // Nothing secret persisted, nothing fetched.
    const stored = await page.evaluate(() => JSON.stringify(sessionStorage));
    assert.ok(!stored.toUpperCase().includes(PASSWORDS[id]), 'password must not be in sessionStorage');
    assert.ok(!stored.includes(PRIV[id].emails[0].giveaway.slice(0, 40)), 'debrief must not be in sessionStorage');
    assert.deepEqual(page.requests, [], 'no network requests');
    await page.context().close();
  });
}

test('(b) wrong markings give the wrong letters and the password fails', async () => {
  const page = await newPage();
  await startGame(page, 'A');
  const verdicts = VERDICTS('A');
  // Flip the first two calls: one Phish becomes Legit, one Legit becomes Phish.
  const wrong = verdicts.slice();
  wrong[0] = wrong[0] === 'phish' ? 'legit' : 'phish';
  wrong[1] = wrong[1] === 'phish' ? 'legit' : 'phish';
  await markAll(page, wrong);
  const tray = await trayText(page);
  assert.notEqual([...tray].sort().join(''), [...PASSWORDS.A].sort().join(''), 'tray letters no longer match the password');

  await submit(page, tray);
  const msg = await statusText(page);
  assert.match(msg, /Not quite\. Re-check your Phish\/Legit calls/);
  assert.ok(!/email \d/i.test(msg), 'message must not say which emails are wrong');
  assert.ok(await page.isHidden('#screen-result'));

  // Change of mind before submitting is allowed: fix the calls and unlock.
  await markAll(page, verdicts);
  await submit(page, PASSWORDS.A);
  await page.waitForSelector('#screen-result:not([hidden])', { timeout: 30000 });
  assert.equal(await page.textContent('#stat-attempts'), '2');
  await page.context().close();
});

test('(c) five wrong tries trigger a 30-second cooldown, then it repeats', async () => {
  const page = await newPage({ clock: true });
  await startGame(page, 'B');
  await markAll(page, VERDICTS('B'));
  for (let n = 1; n <= 5; n++) {
    await submit(page, 'WRONG' + n);
    assert.match(await statusText(page), /Not quite/);
  }
  assert.ok(await page.isDisabled('#btn-submit'), 'submit disabled during cooldown');
  assert.match(await page.textContent('#cooldown'), /Try again in \d+ s/);

  // A refresh does not clear the cooldown.
  await page.reload();
  await page.waitForSelector('#screen-game:not([hidden])');
  assert.ok(await page.isDisabled('#btn-submit'), 'cooldown survives a refresh');
  assert.equal(await page.inputValue('#pw'), '', 'password is not restored after refresh');

  await page.clock.fastForward(20000);
  assert.ok(await page.isDisabled('#btn-submit'), 'still locked at 20 s');
  await page.clock.fastForward(11000);
  await page.waitForFunction(() => !document.querySelector('#btn-submit').disabled, null, { timeout: 5000 });

  // The cycle repeats: another 5 wrong tries lock it again.
  for (let n = 1; n <= 5; n++) await submit(page, 'AGAIN' + n);
  assert.ok(await page.isDisabled('#btn-submit'), 'second cooldown after 5 more wrong tries');
  await page.clock.fastForward(31000);
  await page.waitForFunction(() => !document.querySelector('#btn-submit').disabled, null, { timeout: 5000 });
  await submit(page, PASSWORDS.B);
  await page.waitForSelector('#screen-result:not([hidden])', { timeout: 30000 });
  assert.equal(await page.textContent('#stat-attempts'), '11');
  await page.context().close();
});

test('progress survives a refresh, links are inert, reset clears everything', async () => {
  const page = await newPage();
  await startGame(page, 'A', 'Red');
  await markAll(page, VERDICTS('A').slice(0, 4));
  await page.click('#inbox-list button[data-i="7"]');
  assert.equal(await page.locator('#mail a, #mail [href]').count(), 0, 'no anchors inside an email');
  const before = page.url();
  await page.click('#mail .ilink');
  assert.match(await page.textContent('#toast'), /account-verify\.example/, 'clicking a link only reveals its destination');
  await page.click('#toast-close');
  await page.click('#inbox-list button[data-i="0"]');
  await page.click('#mail .ibtn');
  assert.equal(page.url(), before, 'clicking a link does not navigate');

  await page.reload();
  await page.waitForSelector('#screen-game:not([hidden])');
  assert.equal(await page.textContent('#marked-count'), '4 of 10 marked');
  assert.match(await page.textContent('#bar-sub'), /Team Red/);

  await page.click('#btn-briefing');
  assert.ok(await page.isVisible('#dlg-briefing'));
  assert.equal(await page.locator('#dlg-briefing table').count(), 0, 'no case file table');
  await page.keyboard.press('Escape');

  await page.click('#btn-reset');
  await page.click('#dlg-reset [data-close]');
  assert.equal(await page.textContent('#marked-count'), '4 of 10 marked', 'cancel keeps progress');
  await page.click('#btn-reset');
  await page.click('#btn-reset-confirm');
  await page.waitForSelector('#screen-landing:not([hidden])');
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  await page.context().close();
});

test('investigation: headers and lookups expose the evidence, with no Email details box', async () => {
  const page = await newPage();
  await startGame(page, 'A');
  assert.equal(await page.getByText('Email details', { exact: false }).count(), 0, 'the old Email details box is gone');

  // Email 7 is a spoof: Show original reveals the outside IP and no DKIM signature.
  await page.click('#inbox-list button[data-i="6"]');
  await page.click('#btn-more');
  await page.click('#mi-original');
  const raw = await page.textContent('#raw');
  assert.match(raw, /\[198\.51\.100\.200\]/);
  assert.match(raw, /Return-Path: <servicedesk@northwind\.example>/);
  assert.ok(!raw.includes('DKIM-Signature'), 'spoof has no DKIM signature');
  assert.ok(!/Authentication-Results|spf=pass|dkim=pass/i.test(raw), 'no ready-made auth results');
  assert.match(await lookup(page, 'spftest', 'northwind.example', '198.51.100.200'), /FAIL: 198\.51\.100\.200 is NOT authorised/);
  assert.match(await lookup(page, 'dkim', 'northwind.example', 'nw2026'), /no DKIM-Signature header/);
  assert.match(await lookup(page, 'dmarc', 'northwind.example'), /p=none/);
  await page.click('#btn-orig-back');

  // Email 1 genuinely passes for Microsoft, and its button URL scan shows the consent screen.
  await page.click('#inbox-list button[data-i="0"]');
  assert.match(await lookup(page, 'spftest', 'sharepoint.microsoft.example', '203.0.113.71'), /PASS/);
  assert.match(await lookup(page, 'dkim', 'microsoft.example', 'selector1'), /DKIM PASS for microsoft\.example/);
  await page.click('#mail .ibtn');
  await page.click('#toast-scan');
  assert.match(await page.textContent('#lk-out'), /unverified publisher/);

  // Email 5's Cc lookalike is brand new.
  assert.match(await lookup(page, 'whois', 'karan.bhatia@northwlnd.example'), /2 days before today/);
  assert.match(await lookup(page, 'ip', '198.51.100.200'), /CheapHost/);
  await page.context().close();

  // Set B: the CHRO invite passes SPF/DKIM for the relay only.
  const pb = await newPage();
  await startGame(pb, 'B');
  await pb.click('#inbox-list button[data-i="7"]');
  assert.match(await pb.textContent('#mail .msg-from'), /chro\.office@corvus\.example/);
  await pb.click('#btn-more');
  await pb.click('#mi-original');
  const rawB = await pb.textContent('#raw');
  assert.match(rawB, /Return-Path: <bounce-4471@mailer-calendar\.example>/);
  assert.match(rawB, /d=mailer-calendar\.example; s=mc1/);
  assert.match(await lookup(pb, 'spftest', 'corvus.example', '198.51.100.100'), /FAIL/);
  assert.match(await lookup(pb, 'spftest', 'mailer-calendar.example', '198.51.100.100'), /PASS/);
  await pb.context().close();
});

test('phone layout: inbox, viewer and tray are usable at 390px wide', async () => {
  const page = await newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page, 'B');
  const verdicts = VERDICTS('B');
  for (let i = 0; i < 10; i++) {
    await page.click(`#inbox-list button[data-i="${i}"]`);
    assert.ok(await page.isHidden('#inbox-list'), 'viewer replaces the inbox on a phone');
    await page.click(`.vbtn[data-v="${verdicts[i]}"]`);
    await page.click('#btn-back');
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, 'no horizontal scroll');
  await submit(page, PASSWORDS.B);
  await page.waitForSelector('#screen-result:not([hidden])', { timeout: 30000 });
  await page.context().close();
});

test('(d) plaintext check passes on dist/game.html and catches real leaks', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'build.js'), '--check'], { cwd: ROOT, env: process.env, stdio: 'pipe' });

  const html = fs.readFileSync(GAME, 'utf8');
  const pw = [PASSWORDS.A, PASSWORDS.B];
  assert.deepEqual(leakCheck(html, PRIV, pw), []);
  for (const id of ['A', 'B']) {
    assert.ok(!html.toUpperCase().includes(PASSWORDS[id]), `set ${id} password absent`);
    for (const e of PRIV[id].emails) assert.ok(!html.includes(e.giveaway.slice(0, 50)), 'giveaway text absent');
  }
  // The checker must actually fail on leaks.
  assert.ok(leakCheck(html + '<!-- ' + PASSWORDS.A.toLowerCase() + ' -->', PRIV, pw).length > 0, 'catches a password');
  assert.ok(leakCheck(html + PRIV.B.emails[4].giveaway, PRIV, pw).length > 0, 'catches giveaway text');
  assert.ok(leakCheck(html + '{"verdict":"Phish"}', PRIV, pw).length > 0, 'catches a verdict');
  assert.ok(leakCheck(html + "['Phish','Legit','Phish']", PRIV, pw).length > 0, 'catches a verdict list');
  assert.ok(!fs.readdirSync(path.join(ROOT, 'dist')).some(f => /private|\.env/i.test(f)), 'no private files in dist');
});
