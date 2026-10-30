// Gate grading shared by the UI and the tests. Each call returns what the player may
// learn: right/wrong, a count of matches where the spec allows it, and the digit on success.
(function (OF) {
  'use strict';

  const C = OF.crypto;

  async function question(answers, gateId, answer) {
    const gate = answers.gates[gateId];
    const correct = await C.checkAnswer(gate, answer);
    return { correct, digit: correct ? await C.unlockDigit(gate, answer) : null };
  }

  async function sort(answers, choices, sceneIds) {
    const gate = answers.gates.s3;
    const key = C.keys.sort(choices, sceneIds);
    const correct = await C.checkAnswer(gate, key);
    const matches = await C.countMatches(gate, C.keys.sortValues(choices, sceneIds));
    return { correct, matches, total: gate.parts.length, digit: correct ? await C.unlockDigit(gate, key) : null };
  }

  async function timeline(answers, order) {
    const gate = answers.gates.s4;
    const key = C.keys.timeline(order);
    const correct = await C.checkAnswer(gate, key);
    const matches = await C.countMatches(gate, order.map(String));
    return { correct, matches, total: gate.parts.length, digit: correct ? await C.unlockDigit(gate, key) : null };
  }

  // The simulation decides the verdict; the digit box only opens for a minimal set.
  async function chain(answers, graph, rack) {
    const result = OF.sim.evaluate(graph, rack);
    result.digit = result.verdict === 'minimal' ? await C.unlockDigit(answers.gates.s5, C.keys.controls(rack)) : null;
    return result;
  }

  async function vault(answers, code) {
    return { correct: await C.checkAnswer(answers.gates.vault, code) };
  }

  async function reveal(answers) {
    return JSON.parse(await C.decryptText(C.REVEAL_PASSPHRASE, answers.reveal));
  }

  OF.gates = { question, sort, timeline, chain, vault, reveal };
})(globalThis.OF = globalThis.OF || {});
