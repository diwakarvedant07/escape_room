// Stage 1 — Evidence sweep: find the main finding in all 10 scenes; subtle items are bonus.
import { scoring } from '../scoring.js';
import { sound } from '../sound.js';
import { ui } from '../ui.js';

const { h } = ui;
const P = scoring.POINTS;

function render(root, G) {
  const scenes = G.data.scenes.scenes;
  const found = G.state.sweep.found;
  const mainCount = () => scenes.filter((sc) => (found[sc.id] || []).includes('main')).length;
  const view = G.sweepView;

  const counter = h('div', { class: 'counter', role: 'status' });
  const updateCounter = () => {
    const n = mainCount();
    counter.replaceChildren(h('span', { 'aria-hidden': 'true' }, n === 10 ? '✓ ' : '◎ '), `Main findings: ${n}/10`);
    counter.classList.toggle('solved', n === 10);
  };

  const body = h('div', { class: 'sweep-body' });
  root.append(G.stageHeader(1, counter), body);

  function closeBanner() {
    if (mainCount() < 10) return null;
    return h('div', { class: 'banner good' },
      h('span', {}, '✓ All 10 main findings logged. Keep searching for bonus details, or close the sweep.'),
      h('button', { class: 'btn primary', onclick: () => G.completeStage(1) }, 'Close sweep and continue ▶'));
  }

  function gallery() {
    view.mode = 'gallery';
    body.replaceChildren(
      h('div', { class: 'gallery' }, scenes.map((sc) => {
        const done = (found[sc.id] || []).includes('main');
        return h('button', { class: 'gallery-item' + (done ? ' done' : ''), onclick: () => openScene(sc.id) },
          h('div', { class: 'gallery-thumb' }, ui.sceneVisual(sc, { thumb: true })),
          h('div', { class: 'gallery-caption' },
            h('span', { class: 'mono' }, `Scene ${sc.id}`), h('strong', { text: sc.title }),
            h('span', { class: 'status ' + (done ? 'good' : '') }, done ? '✓ Main finding logged' : '○ Not yet found')));
      })),
      closeBanner());
    updateCounter();
  }

  function openScene(id) {
    view.mode = 'scene';
    view.scene = id;
    const scene = scenes.find((sc) => sc.id === id);
    const spots = G.data.hotspots.scenes[id];
    const list = found[id] || (found[id] = []);

    const frame = h('div', { class: 'scene-frame' }, ui.sceneVisual(scene, { spots }));
    const cards = h('ul', { class: 'case-cards' });
    const renderCards = () => {
      const mine = spots.filter((sp) => list.includes(sp.id));
      cards.replaceChildren(...(mine.length
        ? mine.map((sp) => h('li', { class: 'case-card' + (sp.kind === 'main' ? ' main' : '') },
          h('span', { class: 'tag' }, sp.kind === 'main' ? '★ Main finding' : '◆ Detail'),
          h('p', { text: scene.cards[sp.id] })))
        : [h('li', { class: 'muted empty' }, 'Click anything in the scene that looks wrong.')]));
    };

    for (const sp of spots) {
      const btn = h('button', {
        class: 'hotspot' + (list.includes(sp.id) ? ' found' : ''),
        tabindex: '-1',
        'aria-hidden': 'true',
        style: { left: sp.x + sp.w / 2 + '%', top: sp.y + sp.h / 2 + '%', width: sp.w + '%', height: sp.h + '%' },
        onclick: (e) => {
          e.stopPropagation();
          if (G.isFrozen() || list.includes(sp.id)) return;
          list.push(sp.id);
          btn.classList.add('found');
          btn.append(h('span', { class: 'spot-tag' }, '✓ ' + sp.label));
          G.award(sp.kind === 'main' ? 's1Main' : 's1Subtle', sp.kind === 'main' ? P.mainFinding : P.subtleItem);
          sound.play('find');
          renderCards();
          updateCounter();
          if (sp.kind === 'main' && mainCount() === 10) {
            sound.play('solve');
            ui.toast('All 10 main findings logged.', 'good');
            side.replaceChildren(...sideParts());
          }
        }
      }, list.includes(sp.id) ? h('span', { class: 'spot-tag' }, '✓ ' + sp.label) : null);
      frame.append(btn);
    }

    const idx = scenes.indexOf(scene);
    const prev = scenes[(idx + scenes.length - 1) % scenes.length];
    const next = scenes[(idx + 1) % scenes.length];
    const sideParts = () => [
      h('div', { class: 'scene-nav' },
        h('button', { class: 'btn ghost', onclick: gallery }, '▦ All scenes'),
        h('button', { class: 'btn ghost', 'aria-label': 'Previous scene', onclick: () => openScene(prev.id) }, '◀ Prev'),
        h('button', { class: 'btn ghost', 'aria-label': 'Next scene', onclick: () => openScene(next.id) }, 'Next ▶')),
      h('h2', {}, h('span', { class: 'mono muted' }, `Scene ${scene.id} · `), scene.title),
      h('h3', { class: 'side-label' }, 'Case file'),
      cards,
      closeBanner()
    ];
    const side = h('aside', { class: 'scene-side panel' }, ...sideParts());
    renderCards();
    body.replaceChildren(h('div', { class: 'scene-view' }, frame, side));
    updateCounter();
  }

  if (view.mode === 'scene') openScene(view.scene);
  else gallery();
}

export { render };
