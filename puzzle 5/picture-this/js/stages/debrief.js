// Debrief (spec §7): headline, reveal line, the true chain, per-scene takeaways, lesson, stats.
(function (OF) {
  'use strict';

  const { h } = OF.ui;
  const S = OF.scoring;

  function render(root, G) {
    const st = G.state;
    const data = G.data;
    const scenes = data.scenes.scenes;
    const msgs = data.stages.messages;
    const opened = st.finished === 'opened';
    const total = S.total(st.score);
    const used = (st.finishedAt ?? G.now()) - st.startedAt;
    const wrong = Object.values(st.gates).reduce((n, g) => n + (g.wrong || 0), 0);
    const hints = Object.values(st.hints).reduce((n, v) => n + v, 0);
    const stagesSolved = solvedStages(st, data);

    const chainHost = h('div', { class: 'chain-timeline' }, h('p', { class: 'muted' }, 'Decrypting the case file…'));
    const unrelatedHost = h('div', { class: 'unrelated' });

    const headline = h('section', { class: 'debrief-head panel ' + (opened ? 'good' : 'bad') },
      h('div', {},
        h('p', { class: 'eyebrow' }, opened ? '🔓 Vault opened' : '❄ Case frozen'),
        h('h1', {}, `Team ${st.team.name}`),
        h('p', { class: 'reveal-line' }, 'The attacker\'s note: ', h('em', {}, `"${msgs.revealLine}"`))),
      h('dl', { class: 'headline-stats' },
        stat('Final score', `${total} / ${S.maxScore()}`),
        stat('Rank', S.rank(total)),
        stat('Time used', OF.ui.fmtTime(Math.min(used, st.durationMs))),
        stat('Wrong attempts', String(wrong)),
        stat('Hints used', String(hints))));

    const takeaways = h('section', { class: 'takeaways panel' },
      h('h2', {}, 'Per-scene takeaways'),
      h('ol', { class: 'takeaway-list' }, scenes.map((sc) => h('li', {},
        h('div', { class: 'tk-head' }, h('span', { class: 'mono muted' }, `Scene ${sc.id}`), h('strong', { text: sc.title }), h('span', { class: 'concept' }, sc.concept)),
        h('p', {}, h('span', { class: 'bad-text' }, '✗ ' + sc.badPractice + '. '), h('span', { class: 'good-text' }, '✓ ' + sc.rightBehavior))))));

    const breakdown = h('table', { class: 'breakdown' },
      h('tbody', {},
        S.COMPONENTS.map((c) => h('tr', {}, h('td', { text: c.label }), h('td', { class: 'mono num', text: String(st.score[c.key]) }))),
        h('tr', { class: 'penalty' }, h('td', {}, 'Penalties (wrong answers, hints)'), h('td', { class: 'mono num', text: '−' + st.score.penalties })),
        h('tr', { class: 'total' }, h('td', {}, 'Total'), h('td', { class: 'mono num', text: String(total) }))));

    const side = h('section', { class: 'debrief-side' },
      h('div', { class: 'panel lesson' }, h('h2', {}, 'The lesson'), h('p', { text: msgs.lesson })),
      h('div', { class: 'panel stats' }, h('h2', {}, 'Replay stats'),
        h('p', {}, 'Stages solved: ', h('strong', {}, `${stagesSolved} / 6`)), breakdown));

    root.append(
      headline,
      h('section', { class: 'panel chain-panel' }, h('h2', {}, 'The true chain'), chainHost, unrelatedHost),
      h('div', { class: 'debrief-cols' }, takeaways, side));

    OF.gates.reveal(data.answers).then((reveal) => {
      const edgeFor = (id) => data.graph.edges.find((e) => e.scene === id);
      const timeFor = (id) => data.evidence.scenes[id].record.observed_at;
      chainHost.replaceChildren(h('ol', { class: 'chain-steps' }, reveal.chain.map((id, i) => {
        const sc = scenes.find((x) => x.id === id);
        const edge = edgeFor(id);
        return h('li', { class: 'chain-step' },
          h('span', { class: 'step-n mono' }, String(i + 1)),
          h('strong', { text: sc.title }),
          h('span', { class: 'mono muted', text: timeFor(id) }),
          edge && h('span', { class: 'route mono' }, `▶ ${edge.id} ${edge.from}→${edge.to}`),
          edge && h('span', { class: 'muted small', text: edge.route }));
      })));
      unrelatedHost.replaceChildren(
        h('h3', {}, '◇ ' + msgs.unrelatedLabel),
        h('ul', {}, reveal.unrelated.map((id) => {
          const sc = scenes.find((x) => x.id === id);
          return h('li', {}, h('strong', { text: sc.title }), ' · ', h('span', { class: 'mono muted', text: timeFor(id) }), ' · ', sc.concept);
        })));
    });
  }

  function solvedStages(st, data) {
    const mains = data.scenes.scenes.filter((sc) => (st.sweep.found[sc.id] || []).includes('main')).length;
    const logs = data.stages.questions.every((q) => st.logs.solved[q.id]);
    return [mains === 10, logs, st.sort.solved, st.timeline.solved, st.chain.solved, st.finished === 'opened'].filter(Boolean).length;
  }

  function stat(label, value) {
    return h('div', { class: 'stat' }, h('dt', { text: label }), h('dd', { text: value }));
  }

  (OF.stages = OF.stages || {}).debrief = { render };
})(globalThis.OF = globalThis.OF || {});
