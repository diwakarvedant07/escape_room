// Game state and persistence (spec §8). Storage and clock are passed in so the
// same code runs against localStorage in the browser and a fake store in tests.
(function (OF) {
  'use strict';

  const KEY = 'orbit-casefile-v1';

  function createInitial({ teamName, teamSize, durationMs, now, timelineStart }) {
    return {
      v: 1,
      team: { name: teamName, size: teamSize },
      startedAt: now,
      durationMs,
      stage: 1, // 1..6 play, 7 debrief
      finished: null, // null | 'opened' | 'frozen'
      finishedAt: null,
      sweep: { found: {}, closed: false },
      logs: { solved: {}, picks: {} },
      sort: { choices: {}, solved: false },
      timeline: { order: [...timelineStart], solved: false },
      chain: { rack: [], solved: false, lastResult: null },
      vault: { entry: '00000' },
      digits: {}, // label -> { value, message, source }
      digitOrder: [], // labels in the order they were recovered
      gates: {}, // gate id -> lockout record
      hints: {}, // stage -> count used
      score: OF.scoring.emptyScore(),
      warned: {}
    };
  }

  function load(storage) {
    try {
      const raw = storage.getItem(KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      return state && state.v === 1 ? state : null;
    } catch {
      return null;
    }
  }

  function save(storage, state) {
    try {
      storage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function clear(storage) {
    try {
      storage.removeItem(KEY);
    } catch {
      /* storage unavailable: nothing to clear */
    }
  }

  // Remaining time always comes from the stored start time, never a running counter.
  function remainingMs(state, now) {
    const end = state.finishedAt ?? now;
    return Math.max(0, state.durationMs - (end - state.startedAt));
  }

  function isExpired(state, now) {
    return !state.finished && remainingMs(state, now) <= 0;
  }

  OF.state = { KEY, createInitial, load, save, clear, remainingMs, isExpired };
})(globalThis.OF = globalThis.OF || {});
