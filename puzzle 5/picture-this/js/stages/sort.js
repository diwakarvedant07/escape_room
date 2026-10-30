// Stage 3 — Sort real from noise. Feedback is only "N of 10 correct". Success releases D3.
(function (OF) {
  'use strict';

  const { h } = OF.ui;
  const GATE = 's3';

  function render(root, G) {
    const scenes = G.data.scenes.scenes;
    const ids = scenes.map((sc) => sc.id);
    const st = G.state.sort;
    const OPTIONS = [['part', '✓ Part of this attack'], ['unrelated', '✗ Unrelated']];

    const feedback = h('p', { class: 'feedback', role: 'status' });
    const submit = h('button', { class: 'btn primary big', onclick: onSubmit }, 'Submit sort');
    const foot = h('div', { class: 'stage-foot' });

    function setCount() {
      const n = ids.filter((id) => st.choices[id]).length;
      const locked = G.lockRemaining(GATE);
      submit.disabled = st.solved || n < ids.length || locked > 0 || G.isFrozen();
      submit.textContent = n < ids.length ? `Submit sort (${n}/10 set)` : 'Submit sort';
      if (locked) { feedback.className = 'feedback bad'; feedback.textContent = G.lockText(locked); }
    }

    const grid = h('div', { class: 'sort-grid' }, scenes.map((sc) => {
      const rec = G.data.evidence.scenes[sc.id].record;
      const btns = OPTIONS.map(([value, label]) => h('button', {
        class: 'toggle ' + value + (st.choices[sc.id] === value ? ' active' : ''),
        'aria-pressed': String(st.choices[sc.id] === value),
        disabled: st.solved,
        onclick: () => {
          if (st.solved || G.isFrozen()) return;
          st.choices[sc.id] = value;
          G.save();
          btns.forEach((b, i) => {
            const on = OPTIONS[i][0] === value;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
          });
          setCount();
        }
      }, label));
      return h('article', { class: 'sort-card panel' },
        h('div', { class: 'sort-card-head' },
          h('span', { class: 'mono muted' }, `Scene ${sc.id}`),
          h('button', { class: 'btn ghost small', 'aria-label': `View evidence for ${sc.title}`, onclick: () => OF.evidence.open(G, sc.id) }, '🔎')),
        h('h3', { text: sc.title }),
        h('dl', { class: 'record tight' },
          h('dt', {}, 'User'), h('dd', { class: 'mono', text: rec.user_id }),
          h('dt', {}, 'Dept'), h('dd', { class: 'mono', text: rec.department }),
          h('dt', {}, 'Where'), h('dd', { class: 'mono', text: rec.location_or_system }),
          h('dt', {}, 'Observed'), h('dd', { class: 'mono', text: rec.observed_at })),
        h('div', { class: 'toggle-pair', role: 'group', 'aria-label': sc.title }, btns));
    }));

    function drawFoot() {
      if (st.solved) {
        const d = G.digitForGate(GATE);
        foot.replaceChildren(h('div', { class: 'banner good' },
          h('span', {}, '✓ Sort accepted. ', d && h('span', { class: 'digit-line' }, `🔑 ${d.message} — Digit ${d.label} recovered: ${d.value}`)),
          h('button', { class: 'btn primary', onclick: () => G.completeStage(3) }, 'Continue to Stage 4 ▶')));
      } else {
        foot.replaceChildren(feedback, submit);
      }
    }

    async function onSubmit() {
      if (st.solved || G.lockRemaining(GATE) > 0 || G.isFrozen()) return;
      const r = await OF.gates.sort(G.data.answers, st.choices, ids);
      if (r.correct) {
        st.solved = true;
        G.right(GATE);
        G.addDigit(r.digit, GATE);
        G.award('s3', OF.scoring.POINTS.s3);
        OF.sound.play('solve');
        grid.querySelectorAll('button.toggle').forEach((b) => { b.disabled = true; });
        drawFoot();
      } else {
        const lock = G.wrong(GATE, 's3');
        feedback.className = 'feedback bad';
        feedback.textContent = lock ? G.lockText(lock) : `✗ ${r.matches} of ${r.total} correct. −${OF.scoring.PENALTY.s3} points.`;
        setCount();
      }
    }

    root.append(
      G.stageHeader(3),
      h('div', { class: 'rule' }, h('strong', {}, '⚖ Relevance rule '), G.data.stages.relevanceRule),
      grid, foot);
    drawFoot();
    setCount();
    G.onTick(() => {
      if (st.solved) return;
      const wasLocked = submit.dataset.locked === '1';
      setCount();
      const locked = G.lockRemaining(GATE) > 0;
      submit.dataset.locked = locked ? '1' : '0';
      if (wasLocked && !locked) { feedback.textContent = ''; feedback.className = 'feedback'; }
    });
  }

  (OF.stages = OF.stages || {}).sort = { render };
})(globalThis.OF = globalThis.OF || {});
