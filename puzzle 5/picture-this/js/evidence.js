// Evidence Viewer (spec §3.3): record fields, the cards found in the sweep, and four lens tabs.
// Mounted inline (stages 2 and 4) or opened as a modal from anywhere after stage 1.
(function (OF) {
  'use strict';

  const { h } = OF.ui;

  function foundCards(G, scene) {
    const found = G.state.sweep.found[scene.id] || [];
    return G.data.hotspots.scenes[scene.id].filter((spot) => found.includes(spot.id)).map((spot) => ({ spot, text: scene.cards[spot.id] }));
  }

  function openScene(G, scene) {
    const spots = G.data.hotspots.scenes[scene.id];
    const found = G.state.sweep.found[scene.id] || [];
    const frame = h('div', { class: 'scene-frame' },
      OF.ui.sceneVisual(scene, { spots }),
      spots.filter((sp) => found.includes(sp.id)).map((sp) => h('div', {
        class: 'spot-mark',
        style: { left: sp.x + '%', top: sp.y + '%', width: sp.w + '%', height: sp.h + '%' }
      }, h('span', { class: 'spot-tag' }, '✓ ' + sp.label))));
    OF.ui.modal({ title: `Scene ${scene.id} — ${scene.title}`, className: 'scene-modal', body: frame });
  }

  function mount(container, G, { compact = false } = {}) {
    const ev = G.data.evidence;
    const root = h('section', { class: 'viewer' + (compact ? ' compact' : ''), 'aria-label': 'Evidence Viewer' });

    function render() {
      const scene = G.data.scenes.scenes.find((sc) => sc.id === G.viewer.scene);
      const rec = ev.scenes[scene.id];
      const lens = G.viewer.lens;

      const list = h('nav', { class: 'viewer-scenes', 'aria-label': 'Scenes' },
        G.data.scenes.scenes.map((sc) => h('button', {
          class: 'viewer-scene-btn' + (sc.id === scene.id ? ' active' : ''),
          'aria-pressed': String(sc.id === scene.id),
          onclick: () => { G.viewer.scene = sc.id; render(); }
        }, h('span', { class: 'mono num' }, String(sc.id).padStart(2, '0')), h('span', { text: sc.title }))));

      const fields = [['Scene', 'scene'], ['User', 'user_id'], ['Department', 'department'], ['Location / system', 'location_or_system'], ['Observed at', 'observed_at']];
      const record = h('dl', { class: 'record' }, fields.map(([label, key]) => [h('dt', { text: label }), h('dd', { class: 'mono', text: rec.record[key] })]));

      const cards = foundCards(G, scene);
      const cardList = h('div', { class: 'viewer-cards' },
        h('h4', { text: 'Case file cards' }),
        cards.length
          ? h('ul', {}, cards.map((c) => h('li', {}, h('span', { class: 'card-icon', 'aria-hidden': 'true' }, '▣'), c.text)))
          : h('p', { class: 'muted', text: 'No cards from this scene.' }));

      const tabs = h('div', { class: 'lens-tabs', role: 'tablist', 'aria-label': 'Lens' },
        ev.lenses.map((l) => h('button', {
          class: 'lens-tab' + (l === lens ? ' active' : ''),
          role: 'tab',
          'aria-selected': String(l === lens),
          onclick: () => { G.viewer.lens = l; render(); }
        }, (l === lens ? '◉ ' : '○ ') + ev.lensLabels[l])));
      const lines = rec[lens];
      const log = h('div', { class: 'lens-log mono', role: 'tabpanel' },
        lines.length ? h('ol', {}, lines.map((line) => h('li', { text: line }))) : h('p', { class: 'muted', text: ev.emptyText }));

      const detail = h('div', { class: 'viewer-detail' },
        h('div', { class: 'viewer-top' },
          h('div', { class: 'viewer-pic' },
            h('div', { class: 'viewer-thumb' }, OF.ui.sceneVisual(scene, { thumb: true })),
            h('button', { class: 'btn ghost small', onclick: () => openScene(G, scene) }, '⤢ View scene')),
          record),
        cardList, tabs, log);

      root.replaceChildren(h('h3', { class: 'viewer-title' }, '🔎 Evidence Viewer'), h('div', { class: 'viewer-body' }, list, detail));
    }

    render();
    container.append(root);
    return { show(sceneId) { G.viewer.scene = sceneId; render(); }, refresh: render };
  }

  function open(G, sceneId) {
    if (sceneId) G.viewer.scene = sceneId;
    const body = h('div');
    mount(body, G);
    OF.ui.modal({ title: 'Evidence Viewer', className: 'viewer-modal', body });
  }

  OF.evidence = { mount, open, openScene };
})(globalThis.OF = globalThis.OF || {});
