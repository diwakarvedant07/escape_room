// Stage 2 — Read the logs: six auto-graded questions, each its own gate. Q2 and Q6 release D2 and D1.
(function (OF) {
  'use strict';

  const { h } = OF.ui;

  function render(root, G) {
    const questions = G.data.stages.questions;
    const solved = G.state.logs.solved;
    const picks = G.state.logs.picks;
    const allSolved = () => questions.every((q) => solved[q.id]);

    const footer = h('div', { class: 'stage-foot' });
    const renderFooter = () => {
      const n = questions.filter((q) => solved[q.id]).length;
      footer.replaceChildren(allSolved()
        ? h('div', { class: 'banner good' }, h('span', {}, '✓ All six answers locked in.'),
          h('button', { class: 'btn primary', onclick: () => G.completeStage(2) }, 'Continue to Stage 3 ▶'))
        : h('p', { class: 'muted' }, `${n} of 6 answered correctly.`));
    };

    const card = (q) => {
      const el = h('section', { class: 'question panel' });
      const status = h('p', { class: 'q-status', role: 'status' });
      let pad = null;
      let submitBtn = null;
      let optionBtns = [];

      const setEnabled = () => {
        const locked = G.lockRemaining(q.gate) > 0;
        const off = solved[q.id] || locked || G.isFrozen();
        optionBtns.forEach((b) => { b.disabled = off; });
        if (submitBtn) submitBtn.disabled = off || !picks[q.id];
        if (pad) pad.setDisabled(off);
        if (locked && !solved[q.id]) {
          status.className = 'q-status bad';
          status.textContent = G.lockText(G.lockRemaining(q.gate));
        }
        return locked;
      };

      const submit = async (answer) => {
        if (solved[q.id] || G.lockRemaining(q.gate) > 0 || G.isFrozen()) return;
        const result = await OF.gates.question(G.data.answers, q.gate, answer);
        if (result.correct) {
          solved[q.id] = true;
          picks[q.id] = answer;
          G.right(q.gate);
          if (result.digit) G.addDigit(result.digit, q.gate);
          G.award('s2', OF.scoring.POINTS.s2Question);
          OF.sound.play('solve');
          draw();
          renderFooter();
        } else {
          const lock = G.wrong(q.gate, 's2');
          status.className = 'q-status bad';
          status.textContent = lock ? G.lockText(lock) : `✗ Not correct. −${OF.scoring.PENALTY.s2} points.`;
          el.classList.remove('shake');
          void el.offsetWidth;
          el.classList.add('shake');
          if (pad) pad.clear();
          setEnabled();
        }
      };

      const draw = () => {
        const done = solved[q.id];
        el.classList.toggle('solved', !!done);
        const head = h('div', { class: 'q-head' },
          h('span', { class: 'q-num mono' }, q.id.toUpperCase()),
          h('span', { class: 'lens-chip' }, '🔎 ' + q.lens + ' lens'),
          done && h('span', { class: 'status good' }, '✓ Solved'));
        let input;
        if (done) {
          const digit = G.digitForGate(q.gate);
          input = h('div', { class: 'q-answer' },
            h('p', {}, 'Answer: ', h('strong', { class: 'mono' }, picks[q.id])),
            digit && h('p', { class: 'digit-line' }, '🔑 ', digit.message));
          optionBtns = [];
          submitBtn = null;
          pad = null;
        } else if (q.type === 'keypad') {
          pad = OF.ui.keypad({ onSubmit: submit, submitLabel: 'Submit' });
          input = pad.el;
        } else {
          optionBtns = q.options.map((opt) => h('button', {
            class: 'option' + (picks[q.id] === opt ? ' active' : ''),
            role: 'radio',
            'aria-checked': String(picks[q.id] === opt),
            onclick: () => {
              picks[q.id] = opt;
              G.save();
              optionBtns.forEach((b) => {
                const on = b.dataset.value === opt;
                b.classList.toggle('active', on);
                b.setAttribute('aria-checked', String(on));
                b.firstChild.textContent = on ? '◉ ' : '○ ';
              });
              setEnabled();
            },
            dataset: { value: opt }
          }, h('span', { 'aria-hidden': 'true' }, picks[q.id] === opt ? '◉ ' : '○ '), h('span', { class: 'mono' }, opt)));
          submitBtn = h('button', { class: 'btn primary', onclick: () => submit(picks[q.id]) }, 'Submit');
          input = h('div', { class: 'q-input' }, h('div', { class: 'options', role: 'radiogroup', 'aria-label': q.text }, optionBtns), submitBtn);
        }
        status.textContent = '';
        status.className = 'q-status';
        el.replaceChildren(head, h('p', { class: 'q-text', text: q.text }), input, status);
        setEnabled();
      };

      draw();
      G.onTick(() => {
        if (solved[q.id]) return;
        const wasLocked = el.dataset.locked === '1';
        const locked = setEnabled();
        el.dataset.locked = locked ? '1' : '0';
        if (wasLocked && !locked) { status.textContent = ''; status.className = 'q-status'; }
      });
      return el;
    };

    const viewerHost = h('div', { class: 'logs-viewer panel' });
    root.append(
      G.stageHeader(2),
      h('div', { class: 'logs-body' },
        h('div', { class: 'logs-questions' }, h('div', { class: 'question-grid' }, questions.map(card)), footer),
        viewerHost));
    OF.evidence.mount(viewerHost, G, { compact: true });
    renderFooter();
  }

  (OF.stages = OF.stages || {}).logs = { render };
})(globalThis.OF = globalThis.OF || {});
