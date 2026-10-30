// Stage 6 — Vault. Five dials; the notepad lists recovered digits in the order they were
// found (labelled D1–D5, not placed in code order). No per-digit feedback.
(function (OF) {
  'use strict';

  const { h } = OF.ui;
  const GATE = 'vault';

  function render(root, G) {
    const st = G.state.vault;
    const digits = st.entry.split('');
    const message = h('p', { class: 'feedback', role: 'status' });
    const openBtn = h('button', { class: 'btn primary big', onclick: submit }, '🔓 Open vault');
    const door = h('div', { class: 'vault-door' });
    let opening = false;

    const wheels = digits.map((_, i) => {
      const value = h('div', {
        class: 'wheel-value mono', tabindex: '0', role: 'spinbutton',
        'aria-label': `Dial ${i + 1}`, 'aria-valuemin': '0', 'aria-valuemax': '9'
      });
      const set = (d) => {
        digits[i] = String((Number(d) + 10) % 10);
        value.textContent = digits[i];
        value.setAttribute('aria-valuenow', digits[i]);
        st.entry = digits.join('');
        G.save();
      };
      set(digits[i]);
      value.addEventListener('keydown', (e) => {
        if (locked()) return;
        if (e.key === 'ArrowUp') { set(Number(digits[i]) + 1); e.preventDefault(); }
        else if (e.key === 'ArrowDown') { set(Number(digits[i]) - 1); e.preventDefault(); }
        else if (/^[0-9]$/.test(e.key)) { set(e.key); focusWheel(i + 1); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { focusWheel(i + 1); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { focusWheel(i - 1); e.preventDefault(); }
        else if (e.key === 'Enter') { submit(); e.preventDefault(); }
      });
      const up = h('button', { class: 'btn ghost wheel-btn', 'aria-label': `Dial ${i + 1} up`, onclick: () => !locked() && set(Number(digits[i]) + 1) }, '▲');
      const down = h('button', { class: 'btn ghost wheel-btn', 'aria-label': `Dial ${i + 1} down`, onclick: () => !locked() && set(Number(digits[i]) - 1) }, '▼');
      return { el: h('div', { class: 'wheel' }, up, value, down), value, up, down };
    });

    function focusWheel(i) {
      if (wheels[i]) wheels[i].value.focus();
      else if (i >= wheels.length) openBtn.focus();
    }

    function locked() {
      return opening || G.lockRemaining(GATE) > 0 || G.isFrozen();
    }

    function setLock() {
      const ms = G.lockRemaining(GATE);
      const off = locked();
      openBtn.disabled = off;
      wheels.forEach((w) => { w.up.disabled = off; w.down.disabled = off; });
      if (ms) { message.className = 'feedback bad'; message.textContent = G.lockText(ms); }
    }

    async function submit() {
      if (locked()) return;
      const r = await OF.gates.vault(G.data.answers, st.entry);
      if (r.correct) {
        opening = true;
        G.right(GATE);
        G.finishVault();
        OF.sound.play('open');
        door.classList.add('open');
        message.className = 'feedback good';
        message.textContent = '✓ Vault open. Case closed.';
        setLock();
        setTimeout(() => G.goDebrief(), 2200);
      } else {
        const lock = G.wrong(GATE, 'vault');
        message.className = 'feedback bad';
        message.textContent = lock ? G.lockText(lock) : `✗ Access denied. −${OF.scoring.PENALTY.vault} points.`;
        door.classList.remove('shake');
        void door.offsetWidth;
        door.classList.add('shake');
        setLock();
      }
    }

    const notepad = h('aside', { class: 'notepad panel', 'aria-label': 'Recovered digits' },
      h('h3', {}, '🗒 Notepad'),
      h('p', { class: 'muted' }, 'Digits recovered, in the order you found them.'),
      h('ul', {}, G.state.digitOrder.map((label) => {
        const d = G.state.digits[label];
        return h('li', {}, h('span', { class: 'note-label mono' }, d.label), h('span', { class: 'note-value mono' }, d.value), h('span', { class: 'muted', text: d.source }));
      })));

    door.append(h('div', { class: 'vault-ring' }, h('div', { class: 'wheels' }, wheels.map((w) => w.el))));
    root.append(G.stageHeader(6), h('div', { class: 'vault-body' },
      notepad,
      h('div', { class: 'vault-center' }, door, openBtn, message,
        h('p', { class: 'muted small-print' }, 'Keyboard: focus a dial, type digits or use ↑ ↓, Enter to open.'))));
    setLock();
    G.onTick(() => {
      if (opening) return;
      const wasLocked = openBtn.dataset.locked === '1';
      setLock();
      const isLocked = G.lockRemaining(GATE) > 0;
      openBtn.dataset.locked = isLocked ? '1' : '0';
      if (wasLocked && !isLocked) { message.textContent = ''; message.className = 'feedback'; }
    });
  }

  (OF.stages = OF.stages || {}).vault = { render };
})(globalThis.OF = globalThis.OF || {});
