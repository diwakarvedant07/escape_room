// Stage 5 — Break the chain. Players rack up to 3 controls and run the attacker simulation
// (a real graph search in sim.js). Only a minimum-size cut releases D5.
import { sim } from '../sim.js';
import { scoring } from '../scoring.js';
import { sound } from '../sound.js';
import { ui } from '../ui.js';
import { gates } from '../gates.js';

const { h, s } = ui;
const GATE = 's5';
const NODE_W = 200;
const NODE_H = 72;

function curve(graph, edge) {
  const a = graph.nodes.find((n) => n.id === edge.from);
  const b = graph.nodes.find((n) => n.id === edge.to);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const px = -(b.y - a.y) / len;
  const py = (b.x - a.x) / len;
  const cx = mx + px * edge.bend;
  const cy = my + py * edge.bend;
  const at = (t) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y
  });
  return { d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, at };
}

function render(root, G) {
  const graph = G.data.graph;
  const st = G.state.chain;
  const msgs = G.data.stages.messages;
  let anim = null;

  const svg = s('svg', { class: 'graph', viewBox: '0 0 1120 560', role: 'img', 'aria-label': 'Attack graph from OUT to PAY' });
  const legend = h('ul', { class: 'edge-legend' });
  const result = h('div', { class: 'sim-result', role: 'status' });
  const rackEl = h('div', { class: 'rack' });
  const controlsEl = h('div', { class: 'controls-list' });
  const runBtn = h('button', { class: 'btn primary big run', onclick: run }, '▶ Run attacker simulation');
  const foot = h('div', { class: 'chain-foot' });

  function edgeState(id) {
    const r = st.lastResult;
    if (!r) return 'idle';
    if (r.cut.includes(id)) return 'cut';
    if (r.open.includes(id)) return 'open';
    return 'idle';
  }

  function drawGraph() {
    if (anim) cancelAnimationFrame(anim);
    anim = null;
    svg.replaceChildren();
    const paths = {};
    for (const e of graph.edges) {
      const c = curve(graph, e);
      const state = edgeState(e.id);
      const p = s('path', { d: c.d, class: 'edge ' + state, id: 'edge-' + e.id });
      paths[e.id] = p;
      const mid = c.at(0.5);
      const ahead = c.at(0.58);
      const ang = Math.atan2(ahead.y - mid.y, ahead.x - mid.x) * 180 / Math.PI;
      const tip = c.at(0.7);
      svg.append(p,
        s('polygon', { points: '-9,-7 9,0 -9,7', class: 'edge-arrow ' + state, transform: `translate(${tip.x},${tip.y}) rotate(${ang})` }));
      const label = state === 'cut' ? `${e.id} ✕` : state === 'open' ? `${e.id} ▶` : e.id;
      svg.append(s('g', { class: 'edge-pill ' + state, transform: `translate(${mid.x},${mid.y})` },
        s('rect', { x: -34, y: -17, width: 68, height: 34, rx: 17 }),
        s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, label)));
    }
    for (const n of graph.nodes) {
      svg.append(s('g', { class: 'node node-' + n.id.toLowerCase(), transform: `translate(${n.x},${n.y})` },
        s('rect', { x: -NODE_W / 2, y: -NODE_H / 2, width: NODE_W, height: NODE_H, rx: 12 }),
        s('text', { class: 'node-label', 'text-anchor': 'middle', y: -8 }, n.label),
        s('text', { class: 'node-desc', 'text-anchor': 'middle', y: 18 }, n.desc)));
    }
    const r = st.lastResult;
    if (r && r.reached && r.path) animate(r.path.map((id) => paths[id]));
  }

  function animate(segments) {
    const marker = s('g', { class: 'attacker' }, s('circle', { r: 16 }), s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'A'));
    svg.append(marker);
    const lengths = segments.map((p) => p.getTotalLength());
    const total = lengths.reduce((a, b) => a + b, 0);
    const speed = 0.32; // px per ms
    let start = null;
    const step = (t) => {
      if (start === null) start = t;
      let dist = ((t - start) * speed) % (total + 200);
      if (dist > total) dist = total;
      let i = 0;
      while (i < lengths.length - 1 && dist > lengths[i]) { dist -= lengths[i]; i++; }
      const pt = segments[i].getPointAtLength(Math.min(dist, lengths[i]));
      marker.setAttribute('transform', `translate(${pt.x},${pt.y})`);
      anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function drawLegend() {
    legend.replaceChildren(...graph.edges.map((e) => {
      const state = edgeState(e.id);
      const icon = state === 'cut' ? '✕ CUT' : state === 'open' ? '▶ OPEN' : '· ';
      return h('li', { class: 'legend-row ' + state },
        h('span', { class: 'legend-state mono' }, icon),
        h('strong', { class: 'mono' }, e.id),
        h('span', { class: 'mono muted' }, `${e.from}→${e.to}`),
        h('span', {}, `${e.route} (scene ${e.scene})`));
    }));
  }

  function drawRack() {
    const max = graph.maxControls;
    const off = st.solved || G.isFrozen();
    rackEl.replaceChildren(
      h('h3', { class: 'side-label' }, `Control rack (${st.rack.length}/${max})`),
      h('div', { class: 'rack-slots' }, Array.from({ length: max }, (_, i) => {
        const id = st.rack[i];
        const c = id && graph.controls.find((x) => x.id === id);
        return c
          ? h('div', { class: 'rack-slot filled' }, h('strong', { class: 'mono' }, c.id), h('span', { text: c.name }),
            h('button', { class: 'btn ghost small', 'aria-label': `Remove ${c.name}`, disabled: off, onclick: () => toggle(c.id) }, '✕ Remove'))
          : h('div', { class: 'rack-slot empty' }, h('span', { class: 'muted' }, `Slot ${i + 1} — empty`));
      })));
    controlsEl.replaceChildren(
      h('h3', { class: 'side-label' }, 'Controls'),
      ...graph.controls.map((c) => {
        const on = st.rack.includes(c.id);
        return h('button', {
          class: 'control-btn' + (on ? ' active' : ''),
          'aria-pressed': String(on),
          disabled: off || (!on && st.rack.length >= max),
          onclick: () => toggle(c.id)
        }, h('span', { class: 'control-state', 'aria-hidden': 'true' }, on ? '✓' : '＋'), h('strong', { class: 'mono' }, c.id), h('span', { text: c.name }));
      }));
    setRun();
  }

  function setRun() {
    const locked = G.lockRemaining(GATE);
    runBtn.disabled = st.solved || st.rack.length === 0 || locked > 0 || G.isFrozen();
    if (locked) {
      result.className = 'sim-result bad';
      result.textContent = G.lockText(locked);
    }
  }

  function toggle(id) {
    if (st.solved || G.isFrozen()) return;
    st.rack = st.rack.includes(id) ? st.rack.filter((x) => x !== id) : st.rack.length < graph.maxControls ? [...st.rack, id] : st.rack;
    st.lastResult = null;
    st.message = null;
    G.save();
    drawRack();
    drawGraph();
    drawLegend();
    drawResult();
  }

  function drawResult() {
    const m = st.message;
    result.className = 'sim-result' + (m ? ' ' + m.kind : '');
    result.replaceChildren(...(m ? m.lines.map((line) => h('p', { text: line })) : [h('p', { class: 'muted', text: 'Place controls, then run the simulation. Cut edges turn red; open routes glow amber.' })]));
    if (st.solved) {
      const d = G.digitForGate(GATE);
      foot.replaceChildren(h('div', { class: 'banner good column' },
        d && h('span', { class: 'digit-line' }, `🔑 ${d.message} — Digit ${d.label} recovered: ${d.value}`),
        h('button', { class: 'btn primary', onclick: () => G.completeStage(5) }, 'Continue to the vault ▶')));
    } else {
      foot.replaceChildren(runBtn);
    }
    setRun();
  }

  async function run() {
    if (st.solved || !st.rack.length || G.lockRemaining(GATE) > 0 || G.isFrozen()) return;
    const r = await gates.chain(G.data.answers, graph, st.rack);
    st.lastResult = { cut: r.cut, open: r.open, path: r.path, reached: r.reached };
    const P = scoring.POINTS;
    if (r.verdict === 'fail') {
      const lock = G.wrong(GATE, 's5');
      const via = r.path.join(' → ');
      st.message = { kind: 'bad', lines: [`✗ Attacker still reaches PAY via: e.g. ${via}.`, lock ? G.lockText(lock) : `−${scoring.PENALTY.s5} points.`] };
    } else {
      if (!G.state.score.s5Sufficient) G.award('s5Sufficient', P.s5Sufficient);
      if (r.verdict === 'minimal' && r.digit) {
        st.solved = true;
        G.right(GATE);
        G.addDigit(r.digit, GATE);
        G.award('s5Minimal', P.s5Minimal);
        sound.play('solve');
        st.message = { kind: 'good', lines: [`✓ ${msgs.allCut}`, 'Minimal solution: the lowest-cost set of controls.'] };
      } else {
        sound.play('find');
        st.message = { kind: 'warn', lines: [`✓ ${msgs.allCut}`, `⚠ ${msgs.sufficient}`] };
      }
    }
    G.save();
    drawGraph();
    drawLegend();
    drawRack();
    drawResult();
  }

  root.append(
    G.stageHeader(5),
    h('div', { class: 'chain-body' },
      h('div', { class: 'chain-left panel' }, svg, legend, result),
      h('div', { class: 'chain-right panel' }, rackEl, controlsEl, foot)));
  drawGraph();
  drawLegend();
  drawRack();
  drawResult();
  G.onTick(() => {
    if (st.solved) return;
    const wasLocked = runBtn.dataset.locked === '1';
    setRun();
    const locked = G.lockRemaining(GATE) > 0;
    runBtn.dataset.locked = locked ? '1' : '0';
    if (wasLocked && !locked) drawResult();
  });
  return () => { if (anim) cancelAnimationFrame(anim); };
}

export { render };
