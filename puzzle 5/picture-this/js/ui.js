// DOM helpers shared by every screen: element builder, modals, toasts, scene visuals, keypad.
(function (OF) {
  'use strict';

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // trusted static markup only
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    }
    return el;
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...children) {
    const el = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    for (const c of children.flat()) if (c != null) el.append(c.nodeType ? c : String(c));
    return el;
  }

  function fmtTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  // ---------------------------------------------------------------- modals
  const stack = [];

  function modal({ title, body, actions = [], className = '', dismissable = true, onClose }) {
    const prevFocus = document.activeElement;
    const close = () => {
      const i = stack.indexOf(entry);
      if (i === -1) return;
      stack.splice(i, 1);
      backdrop.remove();
      if (prevFocus && prevFocus.isConnected) prevFocus.focus();
      if (onClose) onClose();
    };
    const head = h('div', { class: 'modal-head' },
      h('h2', { class: 'modal-title', text: title }),
      dismissable && h('button', { class: 'btn ghost icon-btn', 'aria-label': 'Close', onclick: close }, '✕ Close'));
    const foot = actions.length
      ? h('div', { class: 'modal-actions' }, actions.map((a) =>
        h('button', { class: 'btn ' + (a.primary ? 'primary' : 'ghost'), onclick: () => a.onClick(close) }, a.label)))
      : null;
    const box = h('div', { class: 'modal ' + className, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      head, h('div', { class: 'modal-body' }, body), foot);
    const backdrop = h('div', { class: 'backdrop' }, box);
    if (dismissable) backdrop.addEventListener('pointerdown', (e) => e.target === backdrop && close());
    const entry = { close, dismissable };
    stack.push(entry);
    document.getElementById('overlay').append(backdrop);
    const first = box.querySelector('.modal-actions .primary') || box.querySelector('button');
    if (first) first.focus();
    return { close, box };
  }

  function closeAllModals() {
    while (stack.length) stack[stack.length - 1].close();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length && stack[stack.length - 1].dismissable) {
      e.preventDefault();
      stack[stack.length - 1].close();
    }
  });

  function confirm(text, okLabel = 'Confirm', cancelLabel = 'Cancel') {
    return new Promise((resolve) => {
      let answered = false;
      modal({
        title: 'Please confirm',
        className: 'small',
        body: h('p', { class: 'confirm-text', text }),
        onClose: () => !answered && resolve(false),
        actions: [
          { label: cancelLabel, onClick: (close) => { answered = true; close(); resolve(false); } },
          { label: okLabel, primary: true, onClick: (close) => { answered = true; close(); resolve(true); } }
        ]
      });
    });
  }

  function toast(text, kind = 'info') {
    const icon = { info: 'ℹ', good: '✓', bad: '✗', warn: '⚠' }[kind] || 'ℹ';
    const el = h('div', { class: 'toast ' + kind, role: 'status' }, h('span', { class: 'toast-icon', 'aria-hidden': 'true' }, icon), text);
    document.getElementById('toasts').append(el);
    setTimeout(() => el.classList.add('leaving'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  // ---------------------------------------------------------------- scene visuals
  // Final art drops in at the path in scenes.json; until then a labelled placeholder renders.
  const imageOk = {};

  function probeImages(scenes) {
    return Promise.all(scenes.map((scene) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { imageOk[scene.id] = true; resolve(); };
      img.onerror = () => { imageOk[scene.id] = false; resolve(); };
      img.src = scene.image;
    })));
  }

  function sceneVisual(scene, { thumb = false, spots = [] } = {}) {
    if (imageOk[scene.id]) {
      return h('img', { class: 'scene-img', src: scene.image, alt: thumb ? '' : `Scene ${scene.id}: ${scene.title}`, draggable: 'false' });
    }
    const label = `Scene ${scene.id} — ${scene.title}`;
    if (thumb) {
      return h('div', { class: 'placeholder thumb', 'aria-hidden': 'true' },
        h('span', { class: 'ph-num', text: String(scene.id).padStart(2, '0') }),
        h('span', { class: 'ph-title', text: scene.title }));
    }
    return h('div', { class: 'placeholder full', role: 'img', 'aria-label': label + ' (placeholder art)' },
      h('div', { class: 'ph-head' },
        h('span', { class: 'ph-title', text: label }),
        h('span', { class: 'ph-file mono', text: 'Placeholder · final art: ' + scene.image })),
      spots.map((sp) => h('div', {
        class: 'ph-object',
        style: { left: sp.x + '%', top: sp.y + '%', width: sp.w + '%', height: sp.h + '%' }
      }, h('span', { text: sp.label }))));
  }

  // ---------------------------------------------------------------- keypad
  function keypad({ onSubmit, submitLabel = 'Submit' }) {
    let value = '';
    let disabled = false;
    const display = h('output', { class: 'keypad-display mono', 'aria-live': 'polite', text: '–' });
    const setValue = (v) => {
      value = v;
      display.textContent = value === '' ? '–' : value;
      submit.disabled = disabled || value === '';
    };
    const digitBtn = (d) => h('button', { class: 'btn key', 'aria-label': 'Digit ' + d, onclick: () => !disabled && setValue(String(d)) }, String(d));
    const clear = h('button', { class: 'btn ghost key wide', onclick: () => !disabled && setValue('') }, 'Clear');
    const submit = h('button', { class: 'btn primary key wide', disabled: true, onclick: () => !disabled && value !== '' && onSubmit(value) }, submitLabel);
    const el = h('div', { class: 'keypad', tabindex: '0', role: 'group', 'aria-label': 'Numeric keypad: type a digit, Enter to submit' },
      display,
      h('div', { class: 'keys' }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(digitBtn)),
      h('div', { class: 'keypad-row' }, clear, submit));
    el.addEventListener('keydown', (e) => {
      if (disabled) return;
      if (/^[0-9]$/.test(e.key)) { setValue(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { setValue(''); e.preventDefault(); }
      else if (e.key === 'Enter' && value !== '' && e.target === el) { onSubmit(value); e.preventDefault(); }
    });
    return {
      el,
      setDisabled(v) {
        disabled = v;
        el.querySelectorAll('button').forEach((b) => { b.disabled = v; });
        submit.disabled = v || value === '';
      },
      clear: () => setValue('')
    };
  }

  OF.ui = { h, s, fmtTime, modal, closeAllModals, confirm, toast, probeImages, sceneVisual, keypad, imageOk };
})(globalThis.OF = globalThis.OF || {});
