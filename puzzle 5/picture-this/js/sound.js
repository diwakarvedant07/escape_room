// Short synthesized cues (no audio files): solve, find, error, warn. Mute persists per machine.
(function (OF) {
  'use strict';

  const KEY = 'orbit-casefile-muted';
  let ctx = null;
  let muted = false;
  try {
    muted = localStorage.getItem(KEY) === '1';
  } catch {
    /* storage blocked: default to sound on */
  }

  const PATTERNS = {
    solve: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.28]],
    find: [[880, 0, 0.08], [1175, 0.07, 0.12]],
    error: [[196, 0, 0.16, 'square', 0.05], [147, 0.15, 0.24, 'square', 0.05]],
    warn: [[988, 0, 0.14, 'triangle'], [988, 0.22, 0.14, 'triangle'], [988, 0.44, 0.2, 'triangle']],
    open: [[392, 0, 0.18], [523, 0.15, 0.18], [659, 0.3, 0.18], [1047, 0.45, 0.4]]
  };

  function ensure() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function play(name) {
    if (muted || !PATTERNS[name]) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + 0.02;
    for (const [freq, start, dur, type = 'sine', gain = 0.09] of PATTERNS[name]) {
      const osc = c.createOscillator();
      const amp = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0.0001, t0 + start);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + start + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(amp).connect(c.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.05);
    }
  }

  function setMuted(value) {
    muted = value;
    try {
      localStorage.setItem(KEY, value ? '1' : '0');
    } catch {
      /* not persisted */
    }
  }

  // Browsers only start audio after a user gesture.
  document.addEventListener('pointerdown', ensure, { once: true });
  document.addEventListener('keydown', ensure, { once: true });

  OF.sound = { play, setMuted, isMuted: () => muted };
})(globalThis.OF = globalThis.OF || {});
