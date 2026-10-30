// Scoring, penalties, ranks and gate lockouts (spec §6). Pure functions, no DOM.
(function (OF) {
  'use strict';

  const POINTS = {
    mainFinding: 10,
    subtleItem: 5,
    s2Question: 20,
    s3: 150,
    s4: 150,
    s5Sufficient: 100,
    s5Minimal: 150,
    perMinute: 5,
    maxBonusMinutes: 20
  };

  const PENALTY = { s2: 5, s3: 10, s4: 10, s5: 10, vault: 5, hint: 25 };

  const COMPONENTS = [
    { key: 's1Main', label: 'Stage 1: main findings' },
    { key: 's1Subtle', label: 'Stage 1: subtle items' },
    { key: 's2', label: 'Stage 2: questions' },
    { key: 's3', label: 'Stage 3: sort' },
    { key: 's4', label: 'Stage 4: timeline' },
    { key: 's5Sufficient', label: 'Stage 5: sufficient solution' },
    { key: 's5Minimal', label: 'Stage 5: minimal solution' },
    { key: 'timeBonus', label: 'Time bonus' }
  ];

  const RANKS = [
    { min: 800, name: 'Threat Hunter' },
    { min: 600, name: 'Responder' },
    { min: 350, name: 'Analyst' },
    { min: 0, name: 'Rookie' }
  ];

  function emptyScore() {
    return { s1Main: 0, s1Subtle: 0, s2: 0, s3: 0, s4: 0, s5Sufficient: 0, s5Minimal: 0, timeBonus: 0, penalties: 0 };
  }

  function gains(score) {
    return COMPONENTS.reduce((sum, c) => sum + (score[c.key] || 0), 0);
  }

  function total(score) {
    return Math.max(0, gains(score) - (score.penalties || 0));
  }

  function timeBonus(remainingMs) {
    const minutes = Math.floor(Math.max(0, remainingMs) / 60000);
    return POINTS.perMinute * Math.min(POINTS.maxBonusMinutes, minutes);
  }

  function maxScore() {
    return 10 * POINTS.mainFinding + 20 * POINTS.subtleItem + 6 * POINTS.s2Question + POINTS.s3 + POINTS.s4 +
      POINTS.s5Sufficient + POINTS.s5Minimal + POINTS.perMinute * POINTS.maxBonusMinutes;
  }

  function rank(points) {
    return RANKS.find((r) => points >= r.min).name;
  }

  // Lockout: 3 consecutive wrong answers at one gate lock it for 15 s, then 30 s,
  // then 60 s for every further streak. A correct answer resets the schedule.
  const LOCK_SCHEDULE_S = [15, 30, 60];
  const STREAK = 3;

  function emptyGate() {
    return { streak: 0, level: 0, lockUntil: 0, wrong: 0 };
  }

  function recordWrong(gate, now) {
    const g = { ...emptyGate(), ...gate };
    g.wrong += 1;
    g.streak += 1;
    if (g.streak >= STREAK) {
      g.lockUntil = now + LOCK_SCHEDULE_S[Math.min(g.level, LOCK_SCHEDULE_S.length - 1)] * 1000;
      g.level += 1;
      g.streak = 0;
    }
    return g;
  }

  function recordCorrect(gate) {
    return { ...emptyGate(), ...gate, streak: 0, level: 0, lockUntil: 0 };
  }

  function lockRemaining(gate, now) {
    return gate ? Math.max(0, (gate.lockUntil || 0) - now) : 0;
  }

  OF.scoring = {
    POINTS, PENALTY, COMPONENTS, RANKS, LOCK_SCHEDULE_S,
    emptyScore, gains, total, timeBonus, maxScore, rank,
    emptyGate, recordWrong, recordCorrect, lockRemaining
  };
})(globalThis.OF = globalThis.OF || {});
