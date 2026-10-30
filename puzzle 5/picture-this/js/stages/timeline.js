// Stage 4 — Rebuild the timeline. Drag rows or use the up/down buttons; feedback is
// only "N of 8 in the correct position". Success releases D4.
import { scoring } from '../scoring.js';
import { sound } from '../sound.js';
import { ui } from '../ui.js';
import { evidence } from '../evidence.js';
import { gates } from '../gates.js';

const { h } = ui;
const GATE = 's4';

function render(root, G) {
  const st = G.state.timeline;
  const scenes = G.data.scenes.scenes;
  const real = new Set(scenes.filter((sc) => G.state.sort.choices[sc.id] === 'part').map((sc) => sc.id));
  if (st.order.length !== real.size || st.order.some((id) => !real.has(id))) {
    st.order = [...st.order.filter((id) => real.has(id)), ...[...real].filter((id) => !st.order.includes(id))];
  }

  const list = h('ol', { class: 'timeline-list', 'aria-label': 'Timeline slots, earliest at the top' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const check = h('button', { class: 'btn primary big', onclick: onCheck }, 'Check order');
  const side = h('div', { class: 'timeline-side' });
  let dragFrom = null;

  function move(from, to, focusSel) {
    if (st.solved || G.isFrozen() || to < 0 || to >= st.order.length || from === to) return;
    const [id] = st.order.splice(from, 1);
    st.order.splice(to, 0, id);
    G.save();
    drawList();
    if (focusSel) {
      const target = list.children[to] && list.children[to].querySelector(focusSel);
      if (target && !target.disabled) target.focus();
      else if (list.children[to]) list.children[to].querySelector('button:not([disabled])')?.focus();
    }
  }

  function drawList() {
    const n = st.order.length;
    list.replaceChildren(...st.order.map((id, i) => {
      const sc = scenes.find((x) => x.id === id);
      const row = h('li', { class: 'timeline-row panel' + (st.solved ? ' solved' : ''), draggable: st.solved ? 'false' : 'true' },
        h('span', { class: 'drag-handle', 'aria-hidden': 'true' }, '⋮⋮'),
        h('span', { class: 'slot-num mono' }, String(i + 1)),
        h('span', { class: 'slot-tag muted' }, i === 0 ? 'Earliest' : i === n - 1 ? 'Latest' : ''),
        h('div', { class: 'timeline-thumb' }, ui.sceneVisual(sc, { thumb: true })),
        h('strong', { class: 'timeline-title', text: sc.title }),
        h('button', { class: 'btn ghost small', onclick: () => viewer.show(id) }, '🔎 Evidence'),
        h('button', { class: 'btn ghost small move-up', 'aria-label': `Move ${sc.title} up`, disabled: st.solved || i === 0, onclick: () => move(i, i - 1, '.move-up') }, '▲'),
        h('button', { class: 'btn ghost small move-down', 'aria-label': `Move ${sc.title} down`, disabled: st.solved || i === n - 1, onclick: () => move(i, i + 1, '.move-down') }, '▼'));
      row.addEventListener('dragstart', (e) => {
        dragFrom = i;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
      });
      row.addEventListener('dragend', () => { row.classList.remove('dragging'); list.querySelectorAll('.drop-target').forEach((r) => r.classList.remove('drop-target')); });
      row.addEventListener('dragover', (e) => { if (dragFrom !== null) { e.preventDefault(); row.classList.add('drop-target'); } });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = dragFrom;
        dragFrom = null;
        if (from !== null) move(from, i);
      });
      return row;
    }));
  }

  function drawSide() {
    if (st.solved) {
      const d = G.digitForGate(GATE);
      side.replaceChildren(h('div', { class: 'banner good column' },
        h('span', {}, '✓ Timeline confirmed.'),
        d && h('span', { class: 'digit-line' }, `🔑 ${d.message} — Digit ${d.label} recovered: ${d.value}`),
        h('button', { class: 'btn primary', onclick: () => G.completeStage(4) }, 'Continue to Stage 5 ▶')));
    } else {
      side.replaceChildren(h('p', { class: 'muted' }, 'Drag a card, or use ▲ ▼. Then check the order.'), check, feedback);
    }
  }

  function setCheck() {
    const locked = G.lockRemaining(GATE);
    check.disabled = st.solved || locked > 0 || G.isFrozen();
    if (locked) { feedback.className = 'feedback bad'; feedback.textContent = G.lockText(locked); }
  }

  async function onCheck() {
    if (st.solved || G.lockRemaining(GATE) > 0 || G.isFrozen()) return;
    const r = await gates.timeline(G.data.answers, st.order);
    if (r.correct) {
      st.solved = true;
      G.right(GATE);
      G.addDigit(r.digit, GATE);
      G.award('s4', scoring.POINTS.s4);
      sound.play('solve');
      drawList();
      drawSide();
    } else {
      const lock = G.wrong(GATE, 's4');
      feedback.className = 'feedback bad';
      feedback.textContent = lock ? G.lockText(lock) : `✗ ${r.matches} of ${r.total} in the correct position. −${scoring.PENALTY.s4} points.`;
      setCheck();
    }
  }

  const viewerHost = h('div', { class: 'timeline-viewer panel' });
  root.append(G.stageHeader(4), h('div', { class: 'timeline-body' }, h('div', { class: 'timeline-left' }, list, side), viewerHost));
  G.viewer.scene = st.order[0];
  G.viewer.lens = 'physical';
  const viewer = evidence.mount(viewerHost, G, { compact: true });
  drawList();
  drawSide();
  setCheck();
  G.onTick(() => {
    if (st.solved) return;
    const wasLocked = check.dataset.locked === '1';
    setCheck();
    const locked = G.lockRemaining(GATE) > 0;
    check.dataset.locked = locked ? '1' : '0';
    if (wasLocked && !locked) { feedback.textContent = ''; feedback.className = 'feedback'; }
  });
}

export { render };
