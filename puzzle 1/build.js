#!/usr/bin/env node
/*
 * Builds dist/game.html from template.html + answers.private.json.
 *
 *   SET_A_PASSWORD=... SET_B_PASSWORD=... node build.js
 *   node build.js --check            (only run the plaintext leak check on dist/game.html)
 *
 * Passwords may also come from a local .env file (git-ignored). Each set's
 * debrief payload is encrypted with AES-256-GCM using a key derived from that
 * set's password with PBKDF2-SHA-256 and a fresh random salt and IV. Only
 * salt, iv, iterations and ciphertext reach the HTML.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'template.html');
const PRIVATE = path.join(ROOT, 'answers.private.json');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'game.html');
const PLACEHOLDER = '/*@@PAYLOADS@@*/null';
const MIN_ITERATIONS = 600000;
const SET_IDS = ['A', 'B'];

function fail(msg) {
  console.error('\x1b[31mBUILD FAILED:\x1b[0m ' + msg);
  process.exit(1);
}

// Minimal .env loader (KEY=value per line); real environment variables win.
function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

// Must match the browser: trim + uppercase.
const normalise = pw => String(pw).trim().toUpperCase();

function readPrivate() {
  if (!fs.existsSync(PRIVATE)) fail('answers.private.json not found next to build.js.');
  const data = JSON.parse(fs.readFileSync(PRIVATE, 'utf8'));
  for (const id of SET_IDS) {
    const s = data[id];
    if (!s || !Array.isArray(s.emails) || s.emails.length !== 10) fail(`answers.private.json: set ${id} needs exactly 10 emails.`);
    s.emails.forEach((e, i) => {
      if (!/^(Phish|Legit)$/.test(e.verdict)) fail(`answers.private.json: set ${id} email ${i + 1} has an invalid verdict.`);
      if (!/^[A-Z]$/.test(e.hint || '')) fail(`answers.private.json: set ${id} email ${i + 1} needs a one-letter hint.`);
      if (!e.giveaway || !e.whyHard) fail(`answers.private.json: set ${id} email ${i + 1} needs giveaway and whyHard text.`);
    });
  }
  return data;
}

// Pull the public hint letters out of the template so we can cross-check them.
function templateHints(template) {
  const out = {};
  for (const id of SET_IDS) {
    const start = template.indexOf(`id: '${id}',`);
    if (start < 0) fail(`template.html: could not find set ${id}.`);
    const next = SET_IDS.map(o => template.indexOf(`id: '${o}',`)).filter(p => p > start).sort((a, b) => a - b)[0];
    const chunk = template.slice(start, next === undefined ? template.indexOf('const PAYLOADS') : next);
    out[id] = [...chunk.matchAll(/hint: '([A-Z])'/g)].map(m => m[1]);
  }
  return out;
}

const sortLetters = s => s.split('').sort().join('');

async function encryptSet(id, password, payload, iterations) {
  const subtle = webcrypto.subtle;
  const enc = new TextEncoder();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const aad = `phish-or-legit/set-${id}`;
  const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const ct = new Uint8Array(await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad), tagLength: 128 }, key, enc.encode(JSON.stringify(payload))));
  // Round-trip to prove the browser will be able to decrypt it.
  const back = await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad), tagLength: 128 }, key, ct);
  if (new TextDecoder().decode(back) !== JSON.stringify(payload)) fail(`round-trip decrypt failed for set ${id}.`);
  const b64 = u8 => Buffer.from(u8).toString('base64');
  return { v: 1, kdf: 'PBKDF2-SHA-256', cipher: 'AES-256-GCM', iterations, salt: b64(salt), iv: b64(iv), aad, ct: b64(ct) };
}

/* ------------------------------------------------------------------ */
/* Plaintext leak check                                               */
/* ------------------------------------------------------------------ */
function forbiddenFragments(priv, passwords) {
  const frags = [];
  const add = (label, text) => {
    // Every sentence of 12+ characters, plus the full string.
    const parts = [text, ...text.split(/(?<=[.!?])\s+/)];
    for (const p of parts) {
      const t = p.trim();
      if (t.length >= 12) frags.push({ label, text: t });
    }
  };
  for (const id of SET_IDS) {
    const s = priv[id];
    s.emails.forEach((e, i) => {
      add(`set ${id} email ${i + 1} giveaway`, e.giveaway);
      add(`set ${id} email ${i + 1} why-hard`, e.whyHard);
    });
    add(`set ${id} teaching pairs`, s.teachingPairs);
    add(`set ${id} hint summary`, s.hintSummary);
    const phishHints = s.emails.filter(e => e.verdict === 'Phish').map(e => e.hint);
    const legitHints = s.emails.filter(e => e.verdict === 'Legit').map(e => e.hint);
    frags.push({ label: `set ${id} phish-hint sequence`, text: phishHints.join('') });
    frags.push({ label: `set ${id} phish-hint sequence`, text: phishHints.join(', ') });
    frags.push({ label: `set ${id} decoy-hint sequence`, text: legitHints.join('') });
    frags.push({ label: `set ${id} decoy-hint sequence`, text: legitHints.join(', ') });
  }
  for (const pw of passwords) if (pw) frags.push({ label: 'a set password', text: pw });
  return frags;
}

const VERDICT_PATTERNS = [
  { label: 'verdict key next to Phish/Legit', re: /verdict["'\s]*[:=]\s*["'`]?\s*(phish|legit)\b/i },
  { label: 'list of verdict strings', re: /(["'`](phish|legit)["'`]\s*,\s*){2,}["'`](phish|legit)["'`]/i },
  { label: 'table row with verdict and hint', re: /\|\s*(phish|legit)\s*\|\s*[A-Z]\s*\|/i },
  { label: 'email number paired with verdict', re: /(email|#|no\.?)\s*\d{1,2}\s*[:=\-–|]\s*(phish|legit)\b/i },
  { label: 'hint letter paired with verdict', re: /\bhint\W{0,6}[A-Z]\W{1,6}(phish|legit)\b|\b(phish|legit)\W{1,6}hint\W{0,6}[A-Z]\b/i },
  { label: 'answer key wording', re: /answer key|correct (answer|verdict)\s*(is|:)\s*(phish|legit)/i },
  { label: 'reference to the private file', re: /answers\.private/i }
];

function leakCheck(html, priv, passwords) {
  const problems = [];
  const squash = s => s.replace(/\s+/g, ' ');
  const hayLower = squash(html).toLowerCase();
  // Also look at the text after undoing the escapes the template might use.
  const unescaped = squash(html.replace(/\\(["'\\/])/g, '$1').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')).toLowerCase();
  for (const f of forbiddenFragments(priv, passwords)) {
    const needle = squash(f.text).toLowerCase();
    // Short hint sequences are only a leak as whole tokens (base64 noise is not).
    if (needle.length < 12 && !/\s/.test(needle)) {
      const re = new RegExp('(^|[^A-Za-z0-9+/])' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^A-Za-z0-9+/])', 'i');
      if (re.test(html)) problems.push(`contains ${f.label} ("${f.text}")`);
      continue;
    }
    if (hayLower.includes(needle) || unescaped.includes(needle)) problems.push(`contains ${f.label}: "${f.text.slice(0, 70)}${f.text.length > 70 ? '…' : ''}"`);
  }
  for (const p of VERDICT_PATTERNS) {
    const m = p.re.exec(html);
    if (m) problems.push(`matches "${p.label}" near: ${JSON.stringify(html.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30))}`);
  }
  if (html.includes(PLACEHOLDER)) problems.push('payload placeholder was not replaced');
  if (/<script[^>]+src=|<link[^>]+href=["']https?:|@import|https?:\/\/fonts\./i.test(html)) problems.push('references an external script, stylesheet or font');
  return problems;
}

function passwordsFromEnv() {
  return SET_IDS.map(id => {
    const raw = process.env[`SET_${id}_PASSWORD`];
    return raw ? normalise(raw) : '';
  });
}

/* ------------------------------------------------------------------ */

async function main() {
  loadDotEnv();
  const checkOnly = process.argv.includes('--check');
  const priv = readPrivate();
  const passwords = passwordsFromEnv();

  if (checkOnly) {
    if (!fs.existsSync(OUT)) fail('dist/game.html does not exist. Build first.');
    if (passwords.some(p => !p)) console.warn('Note: SET_A_PASSWORD/SET_B_PASSWORD not set, so the password check is skipped (the hint-sequence check still runs).');
    const problems = leakCheck(fs.readFileSync(OUT, 'utf8'), priv, passwords);
    if (problems.length) fail('plaintext check on dist/game.html:\n  - ' + problems.join('\n  - '));
    console.log('Plaintext check passed for dist/game.html');
    return;
  }

  passwords.forEach((p, i) => { if (!p) fail(`environment variable SET_${SET_IDS[i]}_PASSWORD is not set.`); });
  if (!passwords.every(p => /^[A-Z]+$/.test(p))) fail('passwords must be letters only (they are built from hint letters).');

  const iterations = Number(process.env.PBKDF2_ITERATIONS || MIN_ITERATIONS);
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS) fail(`PBKDF2_ITERATIONS must be an integer of at least ${MIN_ITERATIONS}.`);

  const template = fs.readFileSync(TEMPLATE, 'utf8');
  if (!template.includes(PLACEHOLDER)) fail(`template.html is missing the ${PLACEHOLDER} placeholder.`);

  // The template itself must be clean, otherwise it would leak through git too.
  const tplProblems = leakCheck(template.replace(PLACEHOLDER, '{}'), priv, passwords);
  if (tplProblems.length) fail('template.html contains answer material:\n  - ' + tplProblems.join('\n  - '));

  // Consistency: hints in the template match the private file, and the Phish
  // hints are an anagram of the password.
  const hints = templateHints(template);
  SET_IDS.forEach((id, k) => {
    const priHints = priv[id].emails.map(e => e.hint);
    if (hints[id].join('') !== priHints.join('')) fail(`set ${id}: hint letters in template.html (${hints[id].join('')}) do not match answers.private.json (${priHints.join('')}).`);
    const phish = priv[id].emails.filter(e => e.verdict === 'Phish').map(e => e.hint).join('');
    if (sortLetters(phish) !== sortLetters(passwords[k])) fail(`set ${id}: SET_${id}_PASSWORD is not an anagram of the Phish hint letters. Update the hints or the password.`);
  });

  const payloads = {};
  for (let k = 0; k < SET_IDS.length; k++) {
    const id = SET_IDS[k];
    const s = priv[id];
    const debrief = {
      emails: s.emails.map(e => ({ verdict: e.verdict, giveaway: e.giveaway, whyHard: e.whyHard })),
      hintSummary: s.hintSummary,
      teachingPairs: s.teachingPairs
    };
    process.stdout.write(`Encrypting set ${id} (PBKDF2 ${iterations.toLocaleString('en')} iterations)… `);
    payloads[id] = await encryptSet(id, passwords[k], debrief, iterations);
    console.log('done');
  }

  const html = template.replace(PLACEHOLDER, () => JSON.stringify(payloads));
  const problems = leakCheck(html, priv, passwords);
  if (problems.length) {
    // Random base64 can, very rarely, contain a forbidden token; a rebuild draws new salts.
    fail('plaintext check on the built HTML (nothing was written):\n  - ' + problems.join('\n  - '));
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, html);
  const stray = fs.readdirSync(OUT_DIR).filter(f => f !== 'game.html');
  if (stray.length) console.warn('Warning: dist/ contains other files: ' + stray.join(', '));
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(1)} KB). Plaintext check passed.`);
}

if (require.main === module) main().catch(err => fail(err.stack || String(err)));

module.exports = { leakCheck, readPrivate, normalise };
