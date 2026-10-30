#!/usr/bin/env node
// Builds cyber-timeline-game.html from the Puzzle 4 markdown export and game-template.html.
// Usage: node build/build-game.js [path/to/puzzle.md]
// Fails loudly (non-zero exit) if the source data does not match the expected structure.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MD_CANDIDATES = [
  process.argv[2],
  path.join(ROOT, 'puzzle4.md'),
  path.join(ROOT, 'docs', 'Puzzle 4 Cyber Timeline.md'),
].filter(Boolean);
const TEMPLATE = path.join(__dirname, 'game-template.html');
const OUT = path.join(ROOT, 'cyber-timeline-game.html');

const EXPECTED = {
  1: { title: 'Canvas hack', count: 12 },
  2: { title: 'Pager attack', count: 9 },
  3: { title: 'AIIMS Delhi', count: 10 },
  4: { title: 'Bybit heist', count: 10 },
  5: { title: 'Stryker', count: 10 },
  6: { title: "Japan's attack wave", count: 12 },
};

function fail(msg) {
  console.error('BUILD FAILED: ' + msg);
  process.exit(1);
}
function assert(cond, msg) {
  if (!cond) fail(msg);
}

const mdPath = MD_CANDIDATES.find((p) => fs.existsSync(p));
assert(mdPath, 'source markdown not found; tried:\n  ' + MD_CANDIDATES.join('\n  '));
const lines = fs.readFileSync(mdPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/);

// Split into "## " sections.
const sections = [];
let cur = null;
for (const line of lines) {
  if (line.startsWith('## ')) {
    cur = { heading: line.slice(3).trim(), body: [] };
    sections.push(cur);
  } else if (cur) {
    cur.body.push(line);
  }
}

function findSection(re, label) {
  const hits = sections.filter((s) => re.test(s.heading));
  assert(hits.length === 1, `expected exactly one section for ${label}, found ${hits.length}`);
  return hits[0];
}

function splitRow(line, cols, where) {
  const t = line.trim();
  assert(t.startsWith('|') && t.endsWith('|'), `bad table row in ${where}: ${line}`);
  const cells = t.slice(1, -1).split('|').map((c) => c.trim());
  assert(cells.length === cols, `expected ${cols} columns in ${where}, got ${cells.length}: ${line}`);
  return cells;
}

// Returns data rows of the first table whose header row matches `header`.
function readTable(body, header, cols, where) {
  const start = body.findIndex((l) => l.trim().replace(/\s+/g, ' ') === header);
  assert(start >= 0, `table "${header}" not found in ${where}`);
  assert(/^\|(\s*-+\s*\|)+$/.test(body[start + 1].trim()), `missing separator row after header in ${where}`);
  const rows = [];
  for (let i = start + 2; i < body.length && body[i].trim().startsWith('|'); i++) {
    rows.push(splitRow(body[i], cols, where));
  }
  assert(rows.length > 0, `table in ${where} has no rows`);
  return rows;
}

function toId(s, where) {
  assert(/^\d+$/.test(s), `non-numeric card id "${s}" in ${where}`);
  return Number(s);
}

const rounds = [];
for (let n = 1; n <= 6; n++) {
  const exp = EXPECTED[n];

  // ---- Player cards
  const pRe = n === 1 ? /^Part 1: Player cards\. Round 1\b/ : new RegExp(`^Player cards, Round ${n}\\b`);
  const pSec = findSection(pRe, `player cards round ${n}`);
  const pWhere = `"${pSec.heading}"`;
  const intro = pSec.body.find((l) => l.trim() !== '');
  assert(intro && !intro.trim().startsWith('|'), `intro paragraph missing in ${pWhere}`);
  const cardRows = readTable(pSec.body, '| Card | What happened |', 2, pWhere);
  const cards = cardRows.map(([id, text]) => {
    assert(text.length > 0, `empty card text in ${pWhere}`);
    return { id: toId(id, pWhere), text };
  });
  assert(cards.length === exp.count, `round ${n}: expected ${exp.count} cards, found ${cards.length}`);
  const ids = cards.map((c) => c.id);
  assert(new Set(ids).size === ids.length, `round ${n}: duplicate card ids ${ids.join(',')}`);

  // ---- Host key
  const kRe = n === 1 ? /^Part 2: Host keys\b.*\bRound 1\b/ : new RegExp(`^Host key, Round ${n}\\b`);
  const kSec = findSection(kRe, `host key round ${n}`);
  const kWhere = `"${kSec.heading}"`;
  const orderLine = kSec.body.find((l) => l.startsWith('Correct order:'));
  assert(orderLine, `"Correct order:" line missing in ${kWhere}`);
  const order = orderLine.slice('Correct order:'.length).split(',').map((s) => toId(s.trim(), kWhere));

  const keyRows = readTable(kSec.body, '| Position | Card | Date | What happened |', 4, kWhere);
  const rows = keyRows.map(([pos, card, date, text], i) => {
    assert(toId(pos, kWhere) === i + 1, `round ${n}: key table position ${pos} out of sequence (row ${i + 1})`);
    assert(date && text, `round ${n}: empty date/text in key row ${i + 1}`);
    return { card: toId(card, kWhere), date, text };
  });

  assert(order.length === cards.length, `round ${n}: Correct order has ${order.length} ids, deck has ${cards.length}`);
  assert(new Set(order).size === order.length, `round ${n}: Correct order repeats an id`);
  assert(rows.length === cards.length, `round ${n}: key table has ${rows.length} rows, deck has ${cards.length}`);
  rows.forEach((r, i) => {
    assert(r.card === order[i], `round ${n}: Correct order says position ${i + 1} is card ${order[i]}, key table says ${r.card}`);
  });
  const idSet = new Set(ids);
  order.forEach((id) => assert(idSet.has(id), `round ${n}: Correct order card ${id} is not a player card`));

  const trickyStart = kSec.body.findIndex((l) => l.trim() === '**Why it is tricky**');
  assert(trickyStart >= 0, `"Why it is tricky" missing in ${kWhere}`);
  const tricky = [];
  for (let i = trickyStart + 1; i < kSec.body.length; i++) {
    const l = kSec.body[i];
    if (l.trim() === '') { if (tricky.length) break; continue; }
    if (!/^[-*] /.test(l)) break;
    tricky.push(l.slice(2).trim());
  }
  assert(tricky.length > 0, `round ${n}: no "Why it is tricky" bullets`);

  rounds.push({
    n,
    title: exp.title,
    intro: intro.trim(),
    cards,
    key: Buffer.from(JSON.stringify({ order, rows, tricky }), 'utf8').toString('base64'),
    _order: order,
  });
}

// Safe JS literal: escape everything that could close the script tag or break parsing.
function jsLiteral(v) {
  return JSON.stringify(v)
    .replace(/[\u007f-￿<>&]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

const data = rounds.map(({ _order, ...r }) => r);
const tpl = fs.readFileSync(TEMPLATE, 'utf8');
const marker = '/*__GAME_DATA__*/null';
assert(tpl.split(marker).length === 2, 'template must contain the data marker exactly once');
const html = tpl.replace(marker, () => jsLiteral(data));
fs.writeFileSync(OUT, html, 'utf8');

for (const r of rounds) console.log(`Round ${r.n} ${r.title}: ${r.cards.length} cards, order ${r._order.join(',')} OK`);
console.log(`Wrote ${OUT} (${fs.statSync(OUT).size} bytes) from ${mdPath}`);
