#!/usr/bin/env node
// Escape Hub: team login, puzzle launcher and results store.
// Zero dependencies. Node 18+. Run: node hub/server.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = __dirname;

// ---------- config (.env) ----------
function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
const env = Object.assign(loadEnv(path.join(ROOT, '.env')), process.env);

const TEAM_PASSWORD = env.TEAM_PASSWORD || '';
if (!TEAM_PASSWORD) {
  console.error('TEAM_PASSWORD is not set. Copy hub/.env.example to hub/.env and set it.');
  process.exit(1);
}
const PORT = Number(env.PORT) || 3000;
const HOST = env.HOST || '0.0.0.0';
const BASE_PATH = ('/' + (env.BASE_PATH || '').replace(/^\/+|\/+$/g, '')).replace(/^\/$/, '');
const SESSION_SECRET = env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_SECURE = /^(1|true|yes)$/i.test(env.COOKIE_SECURE || '');
const DATA_FILE = path.resolve(ROOT, env.DATA_FILE || 'data/results.json');
const COOKIE = 'hub_session';
const SESSION_DAYS = 7;
const DEPLOY_SCRIPT = path.resolve(ROOT, env.DEPLOY_SCRIPT || '../deploy.sh');
const DEPLOY_LOG = path.join(path.dirname(DATA_FILE), 'deploy.log');
const BOOTED_AT = new Date().toISOString();

// A puzzle is either one file ("file") or a folder ("dir" + entry "file" + "allow"ed sub-folders).
const PUZZLES = JSON.parse(fs.readFileSync(path.join(ROOT, 'puzzles.json'), 'utf8')).map((p) => ({
  ...p,
  playable: !!p.file,
  absDir: p.dir ? path.resolve(ROOT, p.dir) : null,
  absFile: p.file ? path.resolve(ROOT, p.dir || '', p.file) : null,
  allow: Array.isArray(p.allow) ? p.allow : [],
}));
for (const p of PUZZLES) {
  if (p.absFile && !fs.existsSync(p.absFile)) console.warn(`Warning: puzzle ${p.id} file not found: ${p.absFile}`);
}
const puzzleById = new Map(PUZZLES.map((p) => [String(p.id), p]));
const PLAYABLE = PUZZLES.filter((p) => p.playable).map((p) => String(p.id));

// ---------- storage ----------
let db = { teams: {} };
try {
  db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!db || typeof db.teams !== 'object') db = { teams: {} };
} catch (e) {
  if (e.code !== 'ENOENT') { console.error('Could not read ' + DATA_FILE + ': ' + e.message); process.exit(1); }
}
let writeQueue = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(db, null, 2);
  writeQueue = writeQueue.then(async () => {
    await fs.promises.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + '.' + process.pid + '.tmp';
    await fs.promises.writeFile(tmp, snapshot);
    await fs.promises.rename(tmp, DATA_FILE);
  }).catch((e) => console.error('Failed to save results: ' + e.message));
  return writeQueue;
}

// ---------- sessions ----------
const sign = (v) => crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url');
function makeToken(key) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const body = Buffer.from(JSON.stringify({ t: key, e: exp })).toString('base64url');
  return body + '.' + sign(body);
}
function readToken(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const want = sign(body);
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const { t, e } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return e > Date.now() && db.teams[t] ? t : null;
  } catch (_) { return null; }
}
function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=${BASE_PATH || '/'}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (COOKIE_SECURE ? '; Secure' : '');
}

function passwordOk(given) {
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(TEAM_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// Simple login throttle: 10 failures per IP per 10 minutes.
const failures = new Map();
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}
function throttled(ip) {
  const f = failures.get(ip);
  if (!f) return false;
  if (Date.now() - f.since > 10 * 60e3) { failures.delete(ip); return false; }
  return f.count >= 10;
}
function noteFailure(ip) {
  const f = failures.get(ip);
  if (!f || Date.now() - f.since > 10 * 60e3) failures.set(ip, { count: 1, since: Date.now() });
  else f.count++;
}

// ---------- helpers ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, Object.assign({ 'X-Content-Type-Options': 'nosniff' }, headers));
  res.end(body);
}
function json(res, status, obj, headers = {}) {
  send(res, status, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers));
}
function readBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Body too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_) { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
const now = () => new Date().toISOString();
const num = (v, max = 1e9) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : null);

function cleanDetails(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
  const s = JSON.stringify(d);
  return s.length > 8000 ? {} : JSON.parse(s);
}

function teamView(key) {
  const t = db.teams[key];
  return {
    team: t.name,
    finishedAt: t.finishedAt,
    puzzles: PUZZLES.map((p) => ({
      id: p.id, title: p.title, blurb: p.blurb, playable: p.playable,
      result: t.puzzles[p.id] || null,
    })),
  };
}

function allDone(t) {
  return PLAYABLE.every((id) => t.puzzles[id] && t.puzzles[id].status && t.puzzles[id].status !== 'in_progress');
}
function finishTeam(t) {
  if (t.finishedAt) return;
  t.finishedAt = now();
  for (const id of PLAYABLE) {
    const r = t.puzzles[id];
    if (!r || r.status === 'in_progress') t.puzzles[id] = Object.assign(r || {}, { status: 'not_attempted' });
  }
}

// ---------- deploy ----------
// Runs deploy.sh (git pull + pm2 restart). If pm2 restarts this app, the server dies
// mid-request and the browser waits for it to come back via api/health.
let deploying = false;
function runDeploy() {
  return new Promise((resolve) => {
    let out = '';
    const log = (s) => {
      out += s;
      fs.promises.mkdir(path.dirname(DEPLOY_LOG), { recursive: true })
        .then(() => fs.promises.appendFile(DEPLOY_LOG, s))
        .catch(() => {});
    };
    let child;
    try {
      const childEnv = Object.assign({}, process.env);
      for (const k of ['DEPLOY_BRANCH', 'PM2_APP']) if (env[k]) childEnv[k] = env[k];
      child = spawn('bash', [DEPLOY_SCRIPT], { cwd: path.dirname(DEPLOY_SCRIPT), env: childEnv, detached: true });
    } catch (e) {
      return resolve({ code: -1, output: 'Could not start the deploy script: ' + e.message });
    }
    child.stdout.on('data', (d) => log(d.toString()));
    child.stderr.on('data', (d) => log(d.toString()));
    child.on('error', (e) => resolve({ code: -1, output: out + '\nCould not start the deploy script: ' + e.message }));
    child.on('close', (code) => resolve({ code, output: out }));
  });
}

// ---------- static ----------
const PUBLIC = path.join(ROOT, 'public');
function serveFile(res, file, extraHeaders = {}) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, buf, Object.assign({ 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }, extraHeaders));
  });
}
function serveIndex(res) {
  fs.readFile(path.join(PUBLIC, 'index.html'), 'utf8', (err, html) => {
    if (err) return send(res, 500, 'index.html missing');
    html = html.replace('<!--BASE-->', `<base href="${BASE_PATH}/">`);
    send(res, 200, html, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY' });
  });
}

// ---------- routes ----------
async function handle(req, res) {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch (_) { return send(res, 400, 'Bad request'); }
  let p = decodeURIComponent(url.pathname);

  // Accept requests with or without the base path (nginx may or may not strip it).
  if (BASE_PATH) {
    if (p === BASE_PATH) return send(res, 301, '', { Location: BASE_PATH + '/' });
    if (p.startsWith(BASE_PATH + '/')) p = p.slice(BASE_PATH.length);
  }

  if (p.startsWith('/api/')) return api(req, res, p.slice(5));

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  if (p === '/' || p === '/index.html') return serveIndex(res);

  // Games: only whitelisted single-file entries are reachable.
  const g = p.match(/^\/games\/(\d+)\/?$/);
  if (g) {
    const puzzle = puzzleById.get(g[1]);
    if (!puzzle || !puzzle.absFile) return send(res, 404, 'Not found');
    if (!p.endsWith('/')) return send(res, 301, '', { Location: `${BASE_PATH}/games/${g[1]}/` });
    return serveFile(res, puzzle.absFile, { 'X-Frame-Options': 'SAMEORIGIN' });
  }

  // Folder games: only files under the puzzle's "allow"ed sub-folders, with a known type.
  const ga = p.match(/^\/games\/(\d+)\/(.+)$/);
  if (ga) {
    const puzzle = puzzleById.get(ga[1]);
    const rel = ga[2];
    if (!puzzle || !puzzle.absDir || rel.includes('..') || rel.includes('\\') || !puzzle.allow.some((a) => rel.startsWith(a))) {
      return send(res, 404, 'Not found');
    }
    const file = path.resolve(puzzle.absDir, rel);
    if (!file.startsWith(puzzle.absDir + path.sep) || !MIME[path.extname(file).toLowerCase()]) return send(res, 404, 'Not found');
    return serveFile(res, file);
  }

  // Hub assets: flat files inside public/ only.
  const name = p.slice(1);
  if (/^[A-Za-z0-9_-]+\.(js|css|svg|png|ico)$/.test(name)) return serveFile(res, path.join(PUBLIC, name));

  send(res, 404, 'Not found');
}

async function api(req, res, route) {
  const cookies = parseCookies(req.headers.cookie);
  const key = readToken(cookies[COOKIE]);

  if (route === 'login' && req.method === 'POST') {
    const ip = clientIp(req);
    if (throttled(ip)) return json(res, 429, { error: 'Too many wrong attempts. Wait a few minutes and try again.' });
    const body = await readBody(req);
    const name = String(body.team || '').trim();
    if (!/^[A-Za-z0-9_-]{2,24}$/.test(name)) return json(res, 400, { error: 'Team name must be one word: 2–24 letters, numbers, - or _.' });
    if (!passwordOk(body.password || '')) { noteFailure(ip); return json(res, 401, { error: 'Wrong password.' }); }
    const k = name.toLowerCase();
    if (!db.teams[k]) { db.teams[k] = { name, createdAt: now(), finishedAt: null, puzzles: {} }; await persist(); }
    return json(res, 200, teamView(k), { 'Set-Cookie': cookieHeader(makeToken(k), SESSION_DAYS * 86400) });
  }

  if (route === 'health' && req.method === 'GET') return json(res, 200, { ok: true, bootedAt: BOOTED_AT });

  if (route === 'deploy' && req.method === 'POST') {
    const ip = clientIp(req);
    if (throttled(ip)) return json(res, 429, { error: 'Too many wrong attempts. Wait a few minutes and try again.' });
    const body = await readBody(req);
    if (!passwordOk(body.password || '')) { noteFailure(ip); return json(res, 401, { error: 'Wrong password.' }); }
    if (!fs.existsSync(DEPLOY_SCRIPT)) return json(res, 500, { error: 'Deploy script not found: ' + DEPLOY_SCRIPT });
    if (deploying) return json(res, 409, { error: 'A deploy is already running.' });
    // Each click sends a one-time id. The browser may re-send the request after pm2 kills
    // this process; the id (kept on disk across the restart) stops that from deploying twice.
    const id = String(body.id || '');
    if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return json(res, 400, { error: 'Missing deploy id.' });
    const idFile = path.join(path.dirname(DATA_FILE), 'deploy.last');
    let lastId = '';
    try { lastId = fs.readFileSync(idFile, 'utf8').trim(); } catch (_) {}
    if (lastId === id) return json(res, 409, { error: 'This deploy was already run.', bootedAt: BOOTED_AT });
    fs.mkdirSync(path.dirname(idFile), { recursive: true });
    fs.writeFileSync(idFile, id);
    deploying = true;
    console.log('Deploy started from ' + ip);
    const result = await runDeploy().finally(() => { deploying = false; });
    // Reaching here means this process was not restarted (the script failed, or pm2 restarted another app).
    return json(res, result.code === 0 ? 200 : 500, {
      ok: result.code === 0,
      error: result.code === 0 ? undefined : 'Deploy failed (exit code ' + result.code + ').',
      output: result.output.slice(-6000),
      bootedAt: BOOTED_AT,
    });
  }

  if (route === 'logout' && req.method === 'POST') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', 0) });
  }

  if (!key) return json(res, 401, { error: 'Not signed in.' });
  const team = db.teams[key];

  if (route === 'state' && req.method === 'GET') return json(res, 200, teamView(key));

  if (route === 'finish' && req.method === 'POST') {
    finishTeam(team);
    await persist();
    return json(res, 200, teamView(key));
  }

  const m = route.match(/^puzzles\/(\d+)\/(start|result)$/);
  if (m && req.method === 'POST') {
    const puzzle = puzzleById.get(m[1]);
    if (!puzzle || !puzzle.playable) return json(res, 404, { error: 'No such puzzle.' });
    if (team.finishedAt) return json(res, 409, { error: 'Your team has finished. Results are locked.', state: teamView(key) });
    const cur = team.puzzles[puzzle.id];
    const locked = cur && cur.status && cur.status !== 'in_progress';

    if (m[2] === 'start') {
      if (locked) return json(res, 409, { error: 'This puzzle already has a result.', state: teamView(key) });
      if (!cur) { team.puzzles[puzzle.id] = { status: 'in_progress', startedAt: now() }; await persist(); }
      return json(res, 200, teamView(key));
    }

    // result
    if (locked) return json(res, 409, { error: 'This puzzle already has a result.', state: teamView(key) });
    const body = await readBody(req);
    if (!['pass', 'fail', 'completed'].includes(body.status)) return json(res, 400, { error: 'Invalid status.' });
    const startedAt = (cur && cur.startedAt) || now();
    const completedAt = now();
    const wallSec = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);
    team.puzzles[puzzle.id] = {
      status: body.status,
      startedAt,
      completedAt,
      durationSec: num(body.durationSec, 864000) ?? wallSec,
      wallClockSec: wallSec,
      score: num(body.score),
      maxScore: num(body.maxScore),
      hints: num(body.hints, 1000),
      attempts: num(body.attempts, 100000),
      details: cleanDetails(body.details),
    };
    if (allDone(team)) finishTeam(team);
    await persist();
    return json(res, 200, teamView(key));
  }

  json(res, 404, { error: 'Unknown endpoint.' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : 'Server error.' });
    if (!e.status) console.error(e);
  });
});
server.listen(PORT, HOST, () => {
  console.log(`Escape Hub running on http://localhost:${PORT}${BASE_PATH}/`);
  console.log(`Results file: ${DATA_FILE}`);
  if (!env.SESSION_SECRET) console.log('Note: SESSION_SECRET not set, so teams must sign in again after a restart.');
});
