// Hotspot authoring mode (index.html?author=1). Drag on a scene to set the selected
// hotspot's rectangle (a plain click drops a default box), edit labels, then export
// hotspots.json and its hotspots.js mirror into data/. No code changes needed.
(function (OF) {
  'use strict';

  const { h } = OF.ui;
  const DRAFT_KEY = 'orbit-hotspots-draft';
  const DEFAULT = 12;
  const round = (v) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;

  function start(G) {
    const scenes = G.data.scenes.scenes;
    let doc;
    try {
      doc = JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
    } catch {
      doc = null;
    }
    if (!doc) doc = JSON.parse(JSON.stringify(G.data.hotspots));
    let sceneId = 1;
    let slot = 'main';

    const saveDraft = () => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(doc));
      } catch {
        /* draft not persisted */
      }
    };

    document.getElementById('topbar').replaceChildren(
      h('div', { class: 'tb-left' }, h('div', { class: 'tb-title' }, h('strong', {}, '✎ Hotspot authoring mode'), h('span', { class: 'muted' }, 'Not visible to players. Remove ?author=1 from the URL to play.'))));
    const main = document.getElementById('main');
    main.className = 'stage-author';

    function draw() {
      const scene = scenes.find((s) => s.id === sceneId);
      const spots = doc.scenes[sceneId];
      const frame = h('div', { class: 'scene-frame author-frame' }, OF.ui.sceneVisual(scene, { spots: OF.ui.imageOk[sceneId] ? [] : spots }));
      for (const sp of spots) {
        frame.append(h('div', {
          class: 'author-box' + (sp.id === slot ? ' active' : ''),
          style: { left: sp.x + '%', top: sp.y + '%', width: sp.w + '%', height: sp.h + '%' }
        }, h('span', { class: 'spot-tag' }, `${sp.id === 'main' ? '★' : '◆'} ${sp.id}: ${sp.label}`)));
      }
      const ghost = h('div', { class: 'author-box ghost', style: { display: 'none' } });
      frame.append(ghost);

      let origin = null;
      const pct = (e) => {
        const r = frame.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
      };
      frame.addEventListener('pointerdown', (e) => {
        origin = pct(e);
        frame.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      frame.addEventListener('pointermove', (e) => {
        if (!origin) return;
        const p = pct(e);
        Object.assign(ghost.style, {
          display: 'block', left: Math.min(origin.x, p.x) + '%', top: Math.min(origin.y, p.y) + '%',
          width: Math.abs(p.x - origin.x) + '%', height: Math.abs(p.y - origin.y) + '%'
        });
      });
      frame.addEventListener('pointerup', (e) => {
        if (!origin) return;
        const p = pct(e);
        const sp = spots.find((s) => s.id === slot);
        let w = Math.abs(p.x - origin.x);
        let hgt = Math.abs(p.y - origin.y);
        let x = Math.min(origin.x, p.x);
        let y = Math.min(origin.y, p.y);
        if (w < 1.5 && hgt < 1.5) {
          w = DEFAULT;
          hgt = DEFAULT;
          x = origin.x - DEFAULT / 2;
          y = origin.y - DEFAULT / 2;
        }
        Object.assign(sp, { x: round(x), y: round(y), w: round(Math.min(w, 100 - round(x))), h: round(Math.min(hgt, 100 - round(y))) });
        origin = null;
        saveDraft();
        draw();
      });

      const slotRows = spots.map((sp) => {
        const input = h('input', { class: 'input', value: sp.label, 'aria-label': `Label for ${sp.id}` });
        input.addEventListener('input', () => { sp.label = input.value; saveDraft(); });
        input.addEventListener('change', draw);
        return h('div', { class: 'author-slot' + (sp.id === slot ? ' active' : '') },
          h('button', { class: 'btn ' + (sp.id === slot ? 'primary' : 'ghost'), 'aria-pressed': String(sp.id === slot), onclick: () => { slot = sp.id; draw(); } },
            sp.id === slot ? '◉ ' : '○ ', sp.kind === 'main' ? 'Main' : `Subtle ${sp.id.toUpperCase()}`),
          input,
          h('span', { class: 'mono muted' }, `x ${sp.x} · y ${sp.y} · w ${sp.w} · h ${sp.h}`));
      });

      const side = h('aside', { class: 'panel author-side' },
        h('h2', {}, `Scene ${scene.id} — ${scene.title}`),
        h('p', { class: 'muted' }, OF.ui.imageOk[sceneId] ? `Art loaded: ${scene.image}` : `No art yet. Add ${scene.image} and reload.`),
        h('p', {}, 'Pick a hotspot, then drag over the image to set its area. A single click drops a 12% box centred on the click. Draft autosaves in this browser.'),
        slotRows,
        h('div', { class: 'author-actions' },
          h('button', { class: 'btn primary', onclick: () => download('hotspots.json', JSON.stringify(doc, null, 2) + '\n') }, '⬇ Download hotspots.json'),
          h('button', { class: 'btn', onclick: () => download('hotspots.js', mirror(doc)) }, '⬇ Download hotspots.js'),
          h('button', { class: 'btn ghost', onclick: copy }, '⧉ Copy JSON'),
          h('button', { class: 'btn ghost', onclick: discard }, '↺ Discard draft')),
        h('p', { class: 'muted small-print' }, 'Put both downloaded files in picture-this/data/, replacing the old ones.'));

      main.replaceChildren(
        h('nav', { class: 'author-scenes' }, scenes.map((s) => h('button', {
          class: 'btn ' + (s.id === sceneId ? 'primary' : 'ghost'), onclick: () => { sceneId = s.id; slot = 'main'; draw(); }
        }, `${s.id}. ${s.title}`))),
        h('div', { class: 'scene-view' }, frame, side));
    }

    // Same output as tools/sync-data.mjs, so the export is a drop-in.
    function mirror(json) {
      return '// Generated from data/hotspots.json by tools/sync-data.mjs. Edit the JSON, then re-run it.\n' +
        `(globalThis.OF_DATA = globalThis.OF_DATA || {})["hotspots"] = ${JSON.stringify(json, null, 2)};\n`;
    }

    function download(name, text) {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
      const a = h('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      OF.ui.toast(`${name} downloaded`, 'good');
    }

    async function copy() {
      try {
        await navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
        OF.ui.toast('JSON copied', 'good');
      } catch {
        OF.ui.toast('Clipboard blocked: use the download buttons', 'bad');
      }
    }

    async function discard() {
      if (!(await OF.ui.confirm('Discard the draft and reload the hotspots shipped in data/hotspots.json?', 'Discard draft'))) return;
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* nothing stored */
      }
      doc = JSON.parse(JSON.stringify(G.data.hotspots));
      draw();
    }

    draw();
  }

  OF.author = { start };
})(globalThis.OF = globalThis.OF || {});
