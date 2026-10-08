'use strict';
/* GERARAI Visual Direction A+ — static pixel-world placement (v0.7.0-dev).
 * Decoration only. Never edits renderers or app state; it only adds/removes aria-hidden, inert, pointer-events:none
 * nodes that are absolutely/fixed positioned, so document flow is never changed. If this file fails, nothing else does.
 * Each sprite carries data-anim="…" as a hook for an optional future motion layer; no animation runs in this round. */
(function () {
  const main = document.getElementById('main');
  if (!main) return;
  const deco = (cls, anim) => { const el = document.createElement('div'); el.className = cls; el.setAttribute('aria-hidden', 'true'); el.setAttribute('inert', ''); el.dataset.vd = cls.split(' ')[0]; if (anim) el.dataset.anim = anim; return el; };
  const visible = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;

  /* D4 gutters: one fixed pair for the whole session (CSS decides when it shows) */
  const gutters = deco('vd-gutters');
  gutters.append(Object.assign(document.createElement('i'), { className: 'vd-gl' }), Object.assign(document.createElement('i'), { className: 'vd-gr' }));
  document.body.appendChild(gutters);

  /* D2 rail companion: needs free space under the rail; removed when the rail or viewport is too small */
  const RAIL_MIN_FREE = 200;
  function placeRail() {
    const layout = main.querySelector('.feed-page .feed-layout');
    const rail = layout && layout.querySelector('.right-rail');
    let track = layout && layout.querySelector(':scope > .vd-rail-track');
    if (!layout || !visible(rail) || innerHeight < 640) { track?.remove(); return; }
    const L = layout.getBoundingClientRect(), R = rail.getBoundingClientRect();
    const last = rail.lastElementChild && rail.lastElementChild.getBoundingClientRect();
    const top = (last ? last.bottom : R.bottom) - L.top + 32;
    const sceneH = R.width * 40 / 64;
    const free = L.height - top;
    if (free < sceneH + RAIL_MIN_FREE) { track?.remove(); return; }
    if (!track) { track = deco('vd-rail-track vd-deco'); const scene = deco('vd-rail-scene', 'walk'); track.appendChild(scene); layout.appendChild(track); }
    const bar = document.querySelector('.topbar');
    track.style.cssText = `left:${R.left - L.left}px;top:${top}px;width:${R.width}px;height:${free}px`;
    track.firstChild.style.setProperty('--vd-sticky-top', `${(bar ? bar.getBoundingClientRect().height : 90) + 16}px`);
  }

  /* D3 sidebar flowers: only when the gap above the sidebar footer is real */
  const sidebar = window.GerarAIGate?.shellQuery('.sidebar') || document.querySelector('.sidebar');   // detached while the Open Beta gate is shown
  const flowers = sidebar ? deco('vd-sidebar-scene vd-deco', 'sway') : null;
  if (flowers) sidebar.appendChild(flowers);
  function placeSidebar() {
    if (!flowers) return;
    const foot = sidebar.querySelector('.sidebar-bottom'), before = foot && foot.previousElementSibling;
    if (!visible(sidebar) || !foot || !before) { flowers.classList.remove('vd-on'); return; }
    const S = sidebar.getBoundingClientRect(), gap = foot.getBoundingClientRect().top - before.getBoundingClientRect().bottom;
    if (gap < 48 + 32) { flowers.classList.remove('vd-on'); return; }
    flowers.style.top = `${foot.getBoundingClientRect().top - S.top - 48 - 8}px`;
    flowers.classList.add('vd-on');
  }

  let queued = false;
  const update = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { placeRail(); placeSidebar(); } catch { /* decoration must never break the page */ } }); };
  new MutationObserver(update).observe(main, { childList: true, subtree: true });
  addEventListener('resize', update, { passive: true });
  addEventListener('load', update);
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(update); ro.observe(main); if (sidebar) ro.observe(sidebar); }
  window.GerarAIVisualWorld = Object.freeze({ update });
  update();
})();
