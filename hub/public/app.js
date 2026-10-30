'use strict';
(() => {
  const app = document.getElementById('app');
  const player = document.getElementById('player');
  const frame = document.getElementById('frame');
  const recorded = document.getElementById('recorded');
  const confirmDlg = document.getElementById('confirmFinish');
  const PENDING_KEY = 'escapeHub.pendingResults';

  let state = null;       // { team, finishedAt, puzzles: [...] }
  let playing = null;     // puzzle id currently in the iframe

  // ---------- utils ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDur = (sec) => {
    if (sec == null) return '—';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  const STATUS = {
    not_started: 'Not started', in_progress: 'In progress', pass: 'Passed', fail: 'Failed',
    completed: 'Completed', not_attempted: 'Not attempted', soon: 'Coming soon',
  };
  const statusOf = (p) => (!p.playable ? 'soon' : (p.result && p.result.status) || 'not_started');
  const isLocked = (p) => !!(p.result && p.result.status && p.result.status !== 'in_progress');
  const playable = () => state.puzzles.filter((p) => p.playable);

  async function api(path, body) {
    const res = await fetch('api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
    return data;
  }

  // Results that couldn't reach the server are kept locally and retried.
  function readPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (_) { return []; } }
  function writePending(list) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (_) {} }
  async function flushPending() {
    const list = readPending();
    if (!list.length || !state) return;
    const left = [];
    for (const item of list) {
      if (item.team !== state.team) { left.push(item); continue; }
      try { state = await api(`puzzles/${item.puzzle}/result`, item.result); }
      catch (e) { if (!e.status || e.status >= 500) left.push(item); }
    }
    writePending(left);
  }

  // ---------- routing ----------
  function go(hash) { if (location.hash !== hash) location.hash = hash; else route(); }
  window.addEventListener('hashchange', route);

  function route() {
    if (!state) return renderLogin();
    const h = location.hash;
    const m = h.match(/^#\/play\/(\d+)$/);
    if (m) return openPuzzle(Number(m[1]));
    closePlayer();
    if (h === '#/results' || state.finishedAt) return renderResults();
    renderPuzzles();
  }

  // ---------- login ----------
  function renderLogin(msg) {
    closePlayer();
    document.title = 'Escape the Breach';
    app.innerHTML = `
      <div class="login">
        <form class="login-card" id="loginForm" autocomplete="off">
          <div class="eyebrow">Escape the Breach</div>
          <h1>Sign in your team</h1>
          <p class="muted">Use the same team name on any device to see your team's results.</p>
          <label for="team">Team name</label>
          <input id="team" name="team" required maxlength="24" pattern="[A-Za-z0-9_\\-]{2,24}"
                 title="One word: letters, numbers, - or _" autocapitalize="off" spellcheck="false">
          <label for="pw">Password</label>
          <input id="pw" name="password" type="password" required>
          <p class="error" id="loginErr">${esc(msg || '')}</p>
          <button class="btn" style="width:100%">Start</button>
        </form>
      </div>`;
    const form = document.getElementById('loginForm');
    const team = document.getElementById('team');
    team.addEventListener('input', () => { team.value = team.value.replace(/\s+/g, ''); });
    team.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        state = await api('login', { team: team.value.trim(), password: form.password.value });
        await flushPending();
        go(state.finishedAt ? '#/results' : '#/');
      } catch (err) {
        document.getElementById('loginErr').textContent = err.message;
        btn.disabled = false;
      }
    });
  }

  // ---------- puzzles ----------
  function header(extra) {
    const list = playable();
    const done = list.filter((p) => p.result && ['pass', 'fail', 'completed'].includes(p.result.status)).length;
    return `
      <header class="top">
        <div>
          <div class="eyebrow">Escape the Breach · Team</div>
          <div class="team-name">${esc(state.team)}</div>
          <div class="muted" style="font-size:14px">${done} of ${list.length} puzzles done</div>
          <div class="progress"><i style="width:${list.length ? (done / list.length) * 100 : 0}%"></i></div>
        </div>
        <div class="row">${extra}<button class="btn ghost" id="logoutBtn">Log out</button></div>
      </header>`;
  }

  function wireHeader() {
    const out = document.getElementById('logoutBtn');
    if (out) out.onclick = async () => { try { await api('logout', {}); } catch (_) {} state = null; go('#/'); };
  }

  function resultLine(r) {
    if (!r || !r.status || r.status === 'in_progress' || r.status === 'not_attempted') return '';
    const bits = [];
    if (r.score != null) bits.push(`Score ${r.score}${r.maxScore != null ? '/' + r.maxScore : ''}`);
    if (r.durationSec != null) bits.push(fmtDur(r.durationSec));
    if (r.hints != null) bits.push(`${r.hints} hint${r.hints === 1 ? '' : 's'}`);
    return bits.join(' · ');
  }

  function renderPuzzles() {
    document.title = `Team ${state.team} · Escape the Breach`;
    app.innerHTML = `
      <div class="wrap">
        ${header('<button class="btn danger" id="finishBtn">Finish &amp; see results</button>')}
        <div class="grid">
          ${state.puzzles.map((p) => {
            const st = statusOf(p);
            const locked = isLocked(p);
            const label = st === 'in_progress' ? 'Continue' : locked ? 'Done' : 'Play';
            return `
              <article class="card ${p.playable ? '' : 'soon'}">
                <div class="row" style="justify-content:space-between">
                  <span class="num">PUZZLE ${p.id}</span>
                  <span class="chip ${st}">${STATUS[st]}</span>
                </div>
                <h3>${esc(p.title)}</h3>
                <p>${esc(p.playable ? p.blurb : 'This puzzle is not available yet.')}</p>
                <div class="foot">
                  <span class="stats">${esc(resultLine(p.result))}</span>
                  <button class="btn small" data-play="${p.id}" ${!p.playable || locked ? 'disabled' : ''}>${label}</button>
                </div>
              </article>`;
          }).join('')}
        </div>
      </div>`;
    wireHeader();
    app.querySelectorAll('[data-play]').forEach((b) => { b.onclick = () => go('#/play/' + b.dataset.play); });
    document.getElementById('finishBtn').onclick = askFinish;
  }

  function askFinish() {
    confirmDlg.returnValue = '';
    confirmDlg.showModal();
  }
  confirmDlg.addEventListener('close', async () => {
    if (confirmDlg.returnValue !== 'ok') return;
    try { state = await api('finish', {}); } catch (e) { return handleError(e); }
    go('#/results');
  });

  // ---------- player ----------
  async function openPuzzle(id) {
    const p = state.puzzles.find((x) => x.id === id);
    if (!p || !p.playable || isLocked(p) || state.finishedAt) return go(state.finishedAt ? '#/results' : '#/');
    try { state = await api(`puzzles/${id}/start`, {}); }
    catch (e) { return handleError(e); }
    playing = id;
    document.getElementById('playerTitle').textContent = `Puzzle ${id}: ${p.title}`;
    document.getElementById('playerTeam').textContent = `Team ${state.team}`;
    document.title = `${p.title} · Team ${state.team}`;
    recorded.hidden = true;
    frame.src = `games/${id}/?team=${encodeURIComponent(state.team)}`;
    player.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closePlayer() {
    if (player.hidden) return;
    playing = null;
    player.hidden = true;
    frame.src = 'about:blank';
    document.body.style.overflow = '';
  }

  document.getElementById('backBtn').onclick = () => go(state && state.finishedAt ? '#/results' : '#/');
  document.getElementById('recordedBack').onclick = () => go(state && state.finishedAt ? '#/results' : '#/');

  window.addEventListener('message', async (e) => {
    if (e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.type !== 'escape-hub:result' || msg.puzzle !== playing) return;
    const result = {
      status: msg.status, score: msg.score, maxScore: msg.maxScore, durationSec: msg.durationSec,
      hints: msg.hints, attempts: msg.attempts, details: msg.details,
    };
    const id = playing;
    const text = document.getElementById('recordedText');
    try {
      state = await api(`puzzles/${id}/result`, result);
      const label = { pass: 'Passed', fail: 'Failed', completed: 'Completed' }[msg.status] || 'Done';
      text.textContent = `Result recorded: ${label}.` + (state.finishedAt ? ' All puzzles done!' : '');
      document.getElementById('recordedBack').textContent = state.finishedAt ? 'See results' : 'Back to puzzles';
    } catch (err) {
      if (err.status === 409) {
        text.textContent = 'This puzzle already had a result, so this one was not counted.';
      } else if (err.status === 401) {
        return handleError(err);
      } else {
        writePending(readPending().concat({ team: state.team, puzzle: id, result }));
        text.textContent = 'Saved on this device. It will be sent when the connection is back.';
      }
    }
    recorded.hidden = false;
  });

  // ---------- results ----------
  function renderResults() {
    document.title = `Results · Team ${state.team}`;
    const list = playable();
    const rs = list.map((p) => p.result || {});
    const passed = rs.filter((r) => r.status === 'pass').length;
    const failed = rs.filter((r) => r.status === 'fail').length;
    const notAttempted = rs.filter((r) => !r.status || r.status === 'not_attempted' || r.status === 'in_progress').length;
    const totalTime = rs.reduce((a, r) => a + (r.durationSec || 0), 0);
    const totalHints = rs.reduce((a, r) => a + (r.hints || 0), 0);
    const finished = !!state.finishedAt;

    app.innerHTML = `
      <div class="wrap">
        ${header(finished ? '' : '<button class="btn ghost" id="toPuzzles">← Puzzles</button><button class="btn danger" id="finishBtn">Finish &amp; lock</button>')}
        <div class="banner">${finished
          ? `<b>Final results.</b> Your team finished on ${esc(new Date(state.finishedAt).toLocaleString())}.`
          : '<b>Results so far.</b> Your team is still playing. Finish to lock these in.'}</div>
        <div class="summary">
          <div class="stat"><b>${passed}/${list.length}</b><span>puzzles passed</span></div>
          <div class="stat"><b>${failed}</b><span>failed</span></div>
          <div class="stat"><b>${notAttempted}</b><span>${finished ? 'not attempted' : 'still to play'}</span></div>
          <div class="stat"><b>${fmtDur(totalTime)}</b><span>total time</span></div>
          <div class="stat"><b>${totalHints}</b><span>hints used</span></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Puzzle</th><th>Result</th><th class="n">Score</th><th class="n">Time</th><th class="n">Hints</th><th class="n">Attempts</th></tr></thead>
            <tbody>
              ${state.puzzles.map((p) => {
                const r = p.result || {};
                const st = statusOf(p);
                return `<tr>
                  <td class="mono">${p.id}</td>
                  <td>${esc(p.title)}${detailLine(p.id, r)}</td>
                  <td><span class="chip ${st}">${STATUS[st]}</span></td>
                  <td class="n">${r.score != null ? r.score + (r.maxScore != null ? ' / ' + r.maxScore : '') : '—'}</td>
                  <td class="n">${fmtDur(r.durationSec)}</td>
                  <td class="n">${r.hints != null ? r.hints : '—'}</td>
                  <td class="n">${r.attempts != null ? r.attempts : '—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    wireHeader();
    const back = document.getElementById('toPuzzles');
    if (back) back.onclick = () => go('#/');
    const fin = document.getElementById('finishBtn');
    if (fin) fin.onclick = askFinish;
  }

  function detailLine(id, r) {
    const d = r.details || {};
    const bits = [];
    if (d.set) bits.push('Set ' + d.set);
    if (d.rank) bits.push(d.rank);
    if (d.moves != null) bits.push(d.moves + ' moves');
    if (d.reason) bits.push(d.reason);
    if (d.board && typeof d.board === 'object') {
      const order = ['S', 'A', 'B', 'X'];
      const names = { S: 'S', A: 'A', B: 'B', X: 'Bin' };
      const byTier = {};
      Object.entries(d.board).forEach(([title, tier]) => { (byTier[tier] = byTier[tier] || []).push(title); });
      order.filter((t) => byTier[t]).forEach((t) => bits.push(`${names[t]}: ${byTier[t].join(', ')}`));
    }
    return bits.length ? `<div class="detail">${esc(bits.join(' · '))}</div>` : '';
  }

  function handleError(e) {
    if (e.status === 401) { state = null; return renderLogin('Your session ended. Please sign in again.'); }
    if (e.data && e.data.state) state = e.data.state;
    alert(e.message);
    go(state && state.finishedAt ? '#/results' : '#/');
  }

  // ---------- boot ----------
  (async () => {
    try {
      state = await api('state');
      await flushPending();
    } catch (_) { state = null; }
    route();
  })();
})();
