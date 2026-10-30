// App shell: scaling, intro, top bar, timer, persistence, hints, interstitials, freeze and reset.
import { scoring } from './scoring.js';
import { store } from './state.js';
import { sound } from './sound.js';
import { ui } from './ui.js';
import { evidence } from './evidence.js';
import { author } from './author.js';
import * as sweep from './stages/sweep.js';
import * as logs from './stages/logs.js';
import * as sort from './stages/sort.js';
import * as timeline from './stages/timeline.js';
import * as chain from './stages/chain.js';
import * as vault from './stages/vault.js';
import * as debrief from './stages/debrief.js';

const { h, fmtTime } = ui;
const S = scoring;
const DATA_FILES = ['scenes', 'evidence', 'hotspots', 'graph', 'stages', 'answers'];
const data = {}; // filled from data/*.json at boot
const params = new URLSearchParams(location.search);
const storage = (() => {
  try {
    localStorage.setItem('orbit-probe', '1');
    localStorage.removeItem('orbit-probe');
    return localStorage;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  }
})();

const STAGE_MODULES = { 1: 'sweep', 2: 'logs', 3: 'sort', 4: 'timeline', 5: 'chain', 6: 'vault', 7: 'debrief' };
const STAGES = { sweep, logs, sort, timeline, chain, vault, debrief };
const WARNINGS = [[600000, '10 minutes left'], [300000, '5 minutes left'], [60000, '1 minute left']];

const G = {
  data,
  state: null,
  viewer: { scene: 1, lens: 'physical' },
  sweepView: { mode: 'gallery', scene: 1 },
  tickers: new Set(),
  cleanup: null,
  now: () => Date.now(),

  save() {
    store.save(storage, G.state);
  },
  remaining() {
    return store.remainingMs(G.state, G.now());
  },
  total() {
    return S.total(G.state.score);
  },
  award(component, points) {
    G.state.score[component] += points;
    G.save();
    renderTopbar();
  },
  penalize(kind) {
    G.state.score.penalties += S.PENALTY[kind];
    G.save();
    renderTopbar();
  },
  lockRemaining(gateId) {
    return S.lockRemaining(G.state.gates[gateId], G.now());
  },
  wrong(gateId, penaltyKind) {
    G.state.gates[gateId] = S.recordWrong(G.state.gates[gateId], G.now());
    G.state.score.penalties += S.PENALTY[penaltyKind];
    G.save();
    renderTopbar();
    sound.play('error');
    return G.lockRemaining(gateId);
  },
  right(gateId) {
    G.state.gates[gateId] = S.recordCorrect(G.state.gates[gateId]);
    G.save();
  },
  addDigit(digit, gateId) {
    if (!G.state.digits[digit.label]) G.state.digitOrder.push(digit.label);
    G.state.digits[digit.label] = { ...digit, gate: gateId };
    G.save();
  },
  digitForGate(gateId) {
    return Object.values(G.state.digits).find((d) => d.gate === gateId) || null;
  },
  onTick(fn) {
    G.tickers.add(fn);
  },
  completeStage(n) {
    if (G.state.stage !== n) return;
    G.state.stage = n + 1;
    G.save();
    ui.closeAllModals();
    renderStage();
    showPassTheMouse(n);
  },
  finishVault() {
    const now = G.now();
    G.state.score.timeBonus = S.timeBonus(store.remainingMs(G.state, now));
    G.state.finished = 'opened';
    G.state.finishedAt = now;
    G.save();
    renderTopbar();
    reportToHub('pass');
  },
  goDebrief() {
    G.state.stage = 7;
    G.save();
    ui.closeAllModals();
    renderStage();
  },
  isFrozen() {
    return G.state && G.state.finished === 'frozen';
  },
  lockText(ms) {
    return `🔒 Locked for ${Math.ceil(ms / 1000)} s after 3 wrong answers in a row.`;
  }
};

// ---------------------------------------------------------------- Escape Hub bridge
// Sends the final result to the Escape Hub when the game runs inside it (no-op standalone).
function reportToHub(status) {
  if (window.parent === window) return;
  const st = G.state;
  const total = S.total(st.score);
  try {
    window.parent.postMessage({
      type: 'escape-hub:result',
      puzzle: 5,
      status,
      score: total,
      maxScore: S.maxScore(),
      durationSec: Math.round(Math.min(st.finishedAt - st.startedAt, st.durationMs) / 1000),
      hints: Object.values(st.hints).reduce((n, v) => n + v, 0),
      attempts: Object.values(st.gates).reduce((n, g) => n + (g.wrong || 0), 0),
      details: { rank: S.rank(total), reason: status === 'fail' ? 'Case frozen (time up)' : undefined }
    }, '*');
  } catch {
    /* parent unreachable: nothing to report to */
  }
}

// ---------------------------------------------------------------- scaling
function fit() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  document.documentElement.style.setProperty('--scale', String(scale));
}
window.addEventListener('resize', fit);
fit();

// ---------------------------------------------------------------- logo + reset
const LOGO_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="4"/><ellipse cx="24" cy="24" rx="21" ry="8" fill="none" stroke="currentColor" stroke-width="2.5" transform="rotate(-25 24 24)"/><circle cx="42" cy="15" r="3.2" fill="currentColor"/></svg>';
let resetClicks = [];

function logo() {
  return h('button', {
    class: 'logo', 'aria-label': 'Orbit Financial', title: 'Orbit Financial',
    onclick: (e) => {
      if (!e.shiftKey) { resetClicks = []; return; }
      const now = Date.now();
      resetClicks = resetClicks.filter((t) => now - t < 4000).concat(now);
      if (resetClicks.length >= 5) {
        resetClicks = [];
        facilitatorReset();
      }
    }
  }, h('span', { class: 'logo-mark', html: LOGO_SVG }), h('span', { class: 'logo-word' }, 'ORBIT', h('small', {}, 'FINANCIAL')));
}

async function facilitatorReset() {
  const ok = await ui.confirm('Facilitator reset: erase this team\'s progress and return to the intro screen for the next team?', 'Erase and reset', 'Keep playing');
  if (!ok) return;
  store.clear(storage);
  location.reload();
}

// ---------------------------------------------------------------- top bar
function renderTopbar() {
  const bar = document.getElementById('topbar');
  const st = G.state;
  const left = h('div', { class: 'tb-left' }, logo(),
    h('div', { class: 'tb-title' },
      h('strong', {}, 'Case File: Orbit Financial'),
      h('span', { class: 'muted' }, 'Incident #OF-2026-1023' + (st ? ' · Team ' + st.team.name : ''))));
  if (!st) {
    bar.replaceChildren(left, h('div', { class: 'tb-right' }, muteButton()));
    return;
  }
  const stepper = h('ol', { class: 'stepper', 'aria-label': 'Stages' }, data.stages.stages.map((sg) => {
    const done = st.stage > sg.n;
    const current = st.stage === sg.n;
    const status = done ? 'done' : current ? 'current' : 'locked';
    const icon = done ? '✓' : current ? '▶' : '🔒';
    return h('li', { class: 'step ' + status, 'aria-current': current ? 'step' : null },
      h('span', { class: 'step-icon', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'step-label' }, `${sg.n} ${sg.short}`),
      h('span', { class: 'sr-only' }, ` (${status})`));
  }));
  const right = h('div', { class: 'tb-right' },
    h('div', { class: 'score-chip', 'aria-label': 'Score' }, h('span', { class: 'muted' }, 'Score'), h('strong', { id: 'score-value' }, String(G.total()))),
    st.stage >= 2 && st.stage <= 6 && h('button', { class: 'btn ghost', onclick: () => evidence.open(G) }, '🔎 Evidence'),
    st.stage <= 5 && h('button', { class: 'btn ghost', onclick: openHints }, `💡 Hints ${2 - (st.hints[st.stage] || 0)}/2`),
    muteButton(),
    h('div', { class: 'timer', id: 'timer', role: 'timer', 'aria-label': 'Time remaining' },
      h('span', { class: 'timer-icon', 'aria-hidden': 'true' }, '⏱'), h('span', { id: 'timer-value' }, fmtTime(G.remaining()))));
  bar.replaceChildren(left, stepper, right);
  updateTimer();
}

function muteButton() {
  const muted = sound.isMuted();
  return h('button', {
    class: 'btn ghost', 'aria-pressed': String(muted),
    onclick: () => { sound.setMuted(!sound.isMuted()); renderTopbar(); }
  }, muted ? '🔇 Sound off' : '🔊 Sound on');
}

// ---------------------------------------------------------------- hints
function openHints() {
  const stage = G.state.stage;
  const texts = data.stages.hints[stage];
  if (!texts) return;
  const body = h('div', { class: 'hints' });
  let ref;
  const render = () => {
    const used = G.state.hints[stage] || 0;
    body.replaceChildren(
      h('p', { class: 'muted', text: `Stage ${stage} hints. Each costs ${S.PENALTY.hint} points. Revealed hints stay here for free.` }),
      texts.map((text, i) => i < used
        ? h('div', { class: 'hint revealed' }, h('strong', {}, `💡 Hint ${i + 1}`), h('p', { text }))
        : h('div', { class: 'hint' }, h('strong', {}, `Hint ${i + 1}`),
          i === used
            ? h('button', { class: 'btn', disabled: G.isFrozen(), onclick: () => reveal(i) }, `Reveal hint ${i + 1} (−${S.PENALTY.hint} points)`)
            : h('span', { class: 'muted' }, 'Reveal hint ' + i + ' first'))));
  };
  const reveal = async (i) => {
    ref.close();
    const ok = await ui.confirm(`Reveal hint ${i + 1}? It costs ${S.PENALTY.hint} points.`, `Reveal (−${S.PENALTY.hint})`);
    if (ok && (G.state.hints[stage] || 0) === i && !G.isFrozen()) {
      G.state.hints[stage] = i + 1;
      G.penalize('hint');
    }
    openHints();
  };
  render();
  ref = ui.modal({ title: '💡 Hints', className: 'small', body });
}

// ---------------------------------------------------------------- pass the mouse
function showPassTheMouse(n) {
  const size = G.state.team.size;
  const player = (n % size) + 1;
  let left = 5;
  const count = h('span', { class: 'mono' }, String(left));
  const bar = h('div', { class: 'pass-bar' });
  const skip = h('button', { class: 'btn primary' }, 'Skip ▶');
  const el = h('div', { class: 'pass-screen', role: 'dialog', 'aria-label': 'Pass the mouse' },
    h('div', { class: 'pass-card' },
      h('p', { class: 'pass-done' }, `✓ Stage ${n} complete.`),
      h('p', { class: 'pass-who' }, h('strong', {}, `Player ${player} of ${size}`), ' takes the mouse.'),
      bar,
      h('p', { class: 'muted' }, 'Continuing in ', count, ' s · click anywhere to skip'),
      skip));
  const done = () => { clearInterval(timer); el.remove(); };
  el.addEventListener('click', done);
  const timer = setInterval(() => {
    left -= 1;
    count.textContent = String(left);
    if (left <= 0) done();
  }, 1000);
  document.getElementById('overlay').append(el);
  requestAnimationFrame(() => bar.classList.add('run'));
  skip.focus();
}

// ---------------------------------------------------------------- timer
function updateTimer() {
  const el = document.getElementById('timer');
  if (!el || !G.state) return;
  const ms = G.remaining();
  document.getElementById('timer-value').textContent = fmtTime(ms);
  el.classList.toggle('warn', ms <= 300000 && ms > 60000);
  el.classList.toggle('alert', ms <= 60000);
  el.querySelector('.timer-icon').textContent = ms <= 60000 ? '⚠' : '⏱';
}

function tick() {
  if (!G.state) return;
  if (!G.state.finished) {
    const ms = G.remaining();
    for (const [at, text] of WARNINGS) {
      if (ms <= at && !G.state.warned[at]) {
        G.state.warned[at] = true;
        G.save();
        if (ms > at - 5000) { sound.play('warn'); ui.toast(text, 'warn'); }
      }
    }
    if (store.isExpired(G.state, G.now())) freeze();
  }
  updateTimer();
  G.tickers.forEach((fn) => fn());
}

function freeze() {
  G.state.finished = 'frozen';
  G.state.finishedAt = G.state.startedAt + G.state.durationMs;
  G.state.score.timeBonus = 0;
  G.save();
  reportToHub('fail');
  ui.closeAllModals();
  sound.play('error');
  renderTopbar();
  const go = () => { clearTimeout(auto); el.remove(); G.goDebrief(); };
  const el = h('div', { class: 'frozen-screen', role: 'alertdialog', 'aria-label': 'Case frozen' },
    h('div', { class: 'frozen-card' },
      h('p', { class: 'frozen-icon', 'aria-hidden': 'true' }, '❄'),
      h('h2', { text: data.stages.messages.frozen }),
      h('p', {}, 'Partial score: ', h('strong', {}, String(G.total()))),
      h('button', { class: 'btn primary big', onclick: go }, 'Open debrief')));
  const auto = setTimeout(go, 8000);
  document.getElementById('overlay').append(el);
  el.querySelector('button').focus();
}

// ---------------------------------------------------------------- stages
function renderStage() {
  if (G.cleanup) G.cleanup();
  G.cleanup = null;
  G.tickers.clear();
  const main = document.getElementById('main');
  main.replaceChildren();
  main.className = 'stage-' + STAGE_MODULES[G.state.stage];
  renderTopbar();
  const mod = STAGES[STAGE_MODULES[G.state.stage]];
  G.cleanup = mod.render(main, G) || null;
}

function stageHeader(n, extra) {
  const sg = data.stages.stages[n - 1];
  return h('div', { class: 'stage-head' },
    h('div', {}, h('h1', {}, h('span', { class: 'stage-num' }, `Stage ${n}`), ' ', sg.title), h('p', { class: 'muted', text: sg.intro })),
    extra || null);
}
G.stageHeader = stageHeader;

// ---------------------------------------------------------------- intro
function renderIntro() {
  renderTopbar();
  const main = document.getElementById('main');
  main.className = 'stage-intro';
  const story = data.stages.story;
  let size = 4;
  const minutes = Math.max(1, Number(params.get('time')) || 45);
  const name = h('input', { id: 'team-name', class: 'input', maxlength: '24', autocomplete: 'off', placeholder: 'e.g. Blue Team', required: true });
  const sizeBtns = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Team size' }, [3, 4, 5, 6].map((n) => h('button', {
    class: 'seg-btn' + (n === size ? ' active' : ''), role: 'radio', 'aria-checked': String(n === size),
    onclick: (e) => {
      size = n;
      sizeBtns.querySelectorAll('.seg-btn').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-checked', 'true');
    }
  }, String(n))));
  const error = h('p', { class: 'form-error', role: 'alert' });
  const start = () => {
    const teamName = name.value.trim();
    if (!teamName) { error.textContent = '⚠ Enter a team name to open the case file.'; name.focus(); return; }
    G.state = store.createInitial({ teamName, teamSize: size, durationMs: minutes * 60000, now: G.now(), timelineStart: data.stages.timelineStart });
    G.save();
    renderStage();
  };
  if (params.get('team')) name.value = params.get('team').slice(0, 24);
  name.addEventListener('keydown', (e) => e.key === 'Enter' && start());
  main.replaceChildren(h('div', { class: 'intro' },
    h('section', { class: 'intro-story panel' },
      h('p', { class: 'eyebrow' }, '⚠ Incident brief'),
      h('h1', { text: story.heading }),
      story.paragraphs.map((p) => h('p', { text: p }))),
    h('section', { class: 'intro-form panel' },
      h('label', { for: 'team-name', class: 'field-label' }, 'Team name'), name,
      h('span', { class: 'field-label' }, 'Team size'), sizeBtns,
      h('p', { class: 'muted' }, `Timer: ${minutes}:00 · starts when you open the case file. No pause.`),
      error,
      h('button', { class: 'btn primary big', onclick: start }, 'Open case file ▶'))));
  name.focus();
}

// ---------------------------------------------------------------- boot
async function boot() {
  const loaded = await Promise.all(DATA_FILES.map((name) => fetch(`data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`data/${name}.json: HTTP ${r.status}`);
    return r.json();
  })));
  DATA_FILES.forEach((name, i) => { data[name] = loaded[i]; });
  await ui.probeImages(data.scenes.scenes);
  if (params.get('author') === '1') {
    author.start(G);
    return;
  }
  G.state = store.load(storage);
  // Inside the Escape Hub, a saved game from a different team on this device is discarded.
  const hubTeam = params.get('team');
  if (G.state && hubTeam && G.state.team.name.toLowerCase() !== hubTeam.toLowerCase()) {
    store.clear(storage);
    G.state = null;
  }
  setInterval(tick, 250);
  if (!G.state) { renderIntro(); return; }
  if (G.state.finished && G.state.stage < 7) G.state.stage = 7;
  renderStage();
  if (store.isExpired(G.state, G.now())) freeze();
}

boot().catch((err) => {
  document.getElementById('main').replaceChildren(h('p', { class: 'feedback bad' }, `⚠ The case file could not load: ${err.message}`));
});
