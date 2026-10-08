'use strict';
/* GERARAI — Profile Gamification (display only)
 * XP, levels, titles, badges and Life Class unlocks are computed on the server
 * (supabase/migrations/20260930090000_progression_foundation.sql). This file only renders them.
 * Nothing here can grant XP or badges: the browser has no write access to progression tables.
 * Badge art is original 12×12 pixel art keyed by badge_catalog.pixel_asset_key.
 */
(function () {
  const LEVEL_FACTOR = 25, LEVEL_MAX = 99;   // mirrors ruleset v1 (server is authoritative)
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const TITLES = Object.freeze({
    novice:   { th: 'มือใหม่',       en: 'Novice',   from: 1 },
    seasoned: { th: 'ผู้ชำนาญทาง',  en: 'Seasoned', from: 5 },
    veteran:  { th: 'ผู้ช่ำชอง',     en: 'Veteran',  from: 10 },
    legend:   { th: 'ตำนาน',        en: 'Legend',   from: 20 }
  });

  // Fallback catalog (used before the migration runs and in prototype mode). DB rows override it.
  const BADGES = Object.freeze([
    { code: 'first_trip', name_th: 'ก้าวแรก', name_en: 'First Trip', description_th: 'บันทึก Discovery แรกที่มีตำแหน่ง', pixel_asset_key: 'badge.first_trip', rarity: 'common', available: true },
    { code: 'night_owl', name_th: 'นกฮูกราตรี', name_en: 'Night Owl', description_th: 'Discovery ช่วง 20:00–04:59 (เวลาไทย) ใน 3 วันที่ต่างกัน', pixel_asset_key: 'badge.night_owl', rarity: 'rare', available: true },
    { code: 'food_lover', name_th: 'สายกิน', name_en: 'Food Lover', description_th: 'Discovery หมวดอาหารใน 5 พื้นที่ที่ต่างกัน', pixel_asset_key: 'badge.food_lover', rarity: 'common', available: true },
    { code: 'nature_fan', name_th: 'คนรักธรรมชาติ', name_en: 'Nature Fan', description_th: 'Discovery หมวดธรรมชาติหรือสัตว์ใน 5 พื้นที่ที่ต่างกัน', pixel_asset_key: 'badge.nature_fan', rarity: 'common', available: true },
    { code: 'ten_countries', name_th: '10 ประเทศ', name_en: '10 Countries', description_th: 'เร็ว ๆ นี้ — ต้องมีข้อมูลประเทศที่ตรวจสอบได้ก่อน', pixel_asset_key: 'badge.ten_countries', rarity: 'legendary', available: false },
    { code: 'coffee_hunter', name_th: 'นักล่ากาแฟ', name_en: 'Coffee Hunter', description_th: 'Discovery หมวดคาเฟ่ใน 5 พื้นที่ที่ต่างกัน', pixel_asset_key: 'badge.coffee_hunter', rarity: 'common', available: true },
    { code: 'hidden_spot_hunter', name_th: 'นักล่าจุดลับ', name_en: 'Hidden Spot Hunter', description_th: 'Discovery หมวดแปลก/น่าสนใจ ตำแหน่งแม่นยำ ไม่ผูกสถานที่ภายนอก ใน 3 พื้นที่', pixel_asset_key: 'badge.hidden_spot_hunter', rarity: 'epic', available: true },
    { code: 'local_hero', name_th: 'ฮีโร่ท้องถิ่น', name_en: 'Local Hero', description_th: 'ปักหมุดห้องน้ำหรือที่อาบน้ำใน 5 พื้นที่ที่ต่างกัน', pixel_asset_key: 'badge.local_hero', rarity: 'rare', available: true }
  ]);
  const RARITY_TH = { common: 'ทั่วไป', rare: 'หายาก', epic: 'หายากมาก', legendary: 'ตำนาน' };

  /* ---------- pixel art (12×12, original) ---------- */
  const ART = {
    'badge.first_trip': { pal: { p: '#6b4f3a', r: '#e2553f', g: '#5aa05a' }, rows: [
      '............', '..prrrrr....', '..prrrrrr...', '..prrrrr....', '..prrrr.....', '..p.........',
      '..p.........', '..p.........', '..p.........', '..p.........', '.gggg.......', 'gggggggggggg'] },
    'badge.night_owl': { pal: { y: '#f4c542', s: '#fff2a8' }, rows: [
      '.....yyyy...', '...yyyy.....', '..yyy.....s.', '.yyy........', '.yyy....s...', '.yyy........',
      '.yyy........', '.yyyy.......', '..yyyy....yy', '...yyyyyyyy.', '.....yyyy...', '............'] },
    'badge.food_lover': { pal: { k: '#6b4f3a', n: '#f7d57a', b: '#d9534f' }, rows: [
      '.........k..', '........k...', '.......k....', '..nnnnnnn...', '.nnnnnnnnn..', 'bbbbbbbbbbbb',
      'bbbbbbbbbbbb', '.bbbbbbbbbb.', '..bbbbbbbb..', '...bbbbbb...', '....bbbb....', '............'] },
    'badge.nature_fan': { pal: { g: '#3f8f4f', d: '#2e6b3a', t: '#7a5230' }, rows: [
      '.....gg.....', '....gggg....', '...gggggg...', '....gggg....', '...gggggg...', '..gggddggg..',
      '...gggggg...', '..gggggggg..', '.gggddddggg.', '.....tt.....', '.....tt.....', '....tttt....'] },
    'badge.ten_countries': { pal: { o: '#3b82c4', l: '#5aa05a' }, rows: [
      '....oooo....', '..oollooo...', '.oollllooo..', '.olllloooll.', 'oollloooolll', 'ooolloooolll',
      'oooooooollll', 'ooooollooool', '.oooolllooo.', '.ooooolloo..', '..oooooooo..', '....oooo....'] },
    'badge.coffee_hunter': { pal: { s: '#b9c2cc', w: '#f2e6d6', c: '#8a5a3b' }, rows: [
      '...s..s.....', '....s..s....', '...s..s.....', '............', '.wwwwwwww...', '.wccccccwww.',
      '.wwwwwwww.w.', '.wwwwwwww.w.', '.wwwwwwwwww.', '..wwwwww....', 'wwwwwwwwww..', '............'] },
    'badge.hidden_spot_hunter': { pal: { f: '#2b3a4a', g: '#9fd3ee', w: '#ffffff', h: '#8a5a3b' }, rows: [
      '..ffff......', '.fggggf.....', 'fggwgggf....', 'fgwggggf....', 'fggggggf....', 'fggggggf....',
      '.fggggf.....', '..fffffh....', '.......hh...', '........hh..', '.........hh.', '..........h.'] },
    'badge.local_hero': { pal: { r: '#e2553f', w: '#ffffff' }, rows: [
      '............', '.rrr...rrr..', 'rrrrr.rrrrr.', 'rrwrrrrrrrr.', 'rrrrrrrrrrr.', 'rrrrrrrrrrr.',
      '.rrrrrrrrr..', '..rrrrrrr...', '...rrrrr....', '....rrr.....', '.....r......', '............'] }
  };
  /* Visual direction A: 12×12 pixel class icons (display only — class rules live in character.js / the server). */
  const CLASS_ART = {
    'class.wanderer': { pal: {"n": "#101B30", "c": "#FFF3D6", "r": "#D9533F", "b": "#2F66C2", "a": "#D9A548"}, rows: ["............", "....nnnn....", "..nnccccnn..", ".nccccccrrn.", ".ncccccrrcn.", "nccccarrcccn", "ncccbbaccccn", ".nccbbccccn.", ".nbbccccccn.", "..nnccccnn..", "....nnnn....", "............"] },
    'class.adventurer': { pal: {"n": "#101B30", "r": "#D9533F", "w": "#FFFFFF", "m": "#5E8F5E", "d": "#315947"}, rows: ["............", "......nrr...", "......nrrr..", "......n.....", ".....www....", "....wwmmm...", "...wmmmmmd..", "..mmmmmmmdd.", ".mmmmmmmddd.", "mmmmmmmmdddd", "............", "............"] },
    'class.merchant': { pal: {"n": "#5E3A1E", "r": "#D9533F", "g": "#5E8F5E", "a": "#D9A548", "t": "#8E5A32"}, rows: ["............", "....nnnn....", "...n....n...", "..n.rrgg.n..", "aaaaaaaaaaaa", ".tatatatata.", ".atatatatat.", "..tatatata..", "..atatatat..", "...tttttt...", "............", "............"] },
    'class.artist': { pal: {"t": "#8E5A32", "c": "#FFF3D6", "r": "#D9533F", "b": "#2F66C2", "a": "#D9A548", "g": "#5E8F5E"}, rows: ["............", "...tttttt...", "..tccccccct.", ".tcrcccbcct.", ".tcccccccct.", ".tcacc..cct.", ".tccc...ct..", ".tcgccc.ct..", "..tcccccct..", "...tttttt...", "............", "............"] },
    'class.gourmet': { pal: {"w": "#AEBBC9", "n": "#101B30", "o": "#E0783A", "b": "#2F66C2"}, rows: ["............", "...w..w....n", "..w..w....n.", "...w..w..n..", "..w..w..n...", "oooooooooooo", "bbbbbbbbbbbb", ".bbbbbbbbbb.", "..bbbbbbbb..", "...bbbbbb...", "....nnnn....", "............"] },
    'class.scholar': { pal: {"b": "#2F66C2", "a": "#D9A548", "p": "#FFF3D6", "n": "#101B30", "r": "#D9533F"}, rows: ["............", "..bbbbbbbbn.", "..bbbbbbbbpn", "..bbaaaabbpn", "..bbbbbbbbpn", "..bbbbbbbbpn", "..bbbbbbbbpn", "..bbbbbbbbpn", "..bbbbbbbbpn", "..nnnnnnnnn.", "......r.....", "......r....."] },
    'class.naturalist': { pal: {"g": "#5E8F5E", "d": "#315947"}, rows: ["............", ".......gggg.", ".....gggggg.", "....gggggdg.", "...ggggdggg.", "..gggdgggg..", "..ggdggggg..", "..gdgggg....", "..dggg......", ".d..........", "d...........", "............"] },
    'class.chronicler': { pal: {"k": "#3B4252", "s": "#6B7384", "l": "#8EC5FF", "w": "#FFFFFF", "r": "#D9533F"}, rows: ["............", "............", "..kkk....r..", "kkkkkkkkkkkk", "kssskkkksssk", "ksskllllkssk", "ksskllwlkssk", "ksskllllkssk", "kssskkkksssk", "kkkkkkkkkkkk", "............", "............"] },
    'class.maker': { pal: {"h": "#5B6576", "t": "#8E5A32"}, rows: ["............", "..hhhhhhh...", "..hhhhhhhhh.", "..hhhhhhh...", ".....tt.....", ".....tt.....", ".....tt.....", ".....tt.....", ".....tt.....", ".....tt.....", "............", "............"] },
    'class.helper': { pal: {"r": "#D9533F", "w": "#FFFFFF"}, rows: ["............", "..rrr..rrr..", ".rrrrrrrrrr.", ".rrrrwwrrrr.", ".rrrwwwwrrr.", ".rrrrwwrrrr.", "..rrrrrrrr..", "...rrrrrr...", "....rrrr....", ".....rr.....", "............", "............"] }
  };
  const classIcon = cls => CLASS_ART['class.' + (cls && cls.code)] ? pixelSvg(CLASS_ART['class.' + cls.code], 'pixel-class-art') : esc((cls && cls.icon) || '');
  const FALLBACK_ART = { pal: { q: '#9aa5b4' }, rows: [
    '............', '....qqqq....', '...qq..qq...', '.......qq...', '......qq....', '.....qq.....',
    '.....qq.....', '............', '.....qq.....', '.....qq.....', '............', '............'] };

  function pixelSvg(art, cls) {
    let rects = '';
    art.rows.forEach((row, y) => { for (let x = 0; x < 12; x++) { const c = row[x]; if (c && c !== '.' && art.pal[c]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${art.pal[c]}"/>`; } });
    return `<svg class="${cls}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }
  function badgeArt(key, label = '') {
    const art = ART[key] || FALLBACK_ART;
    let rects = '';
    art.rows.forEach((row, y) => {
      for (let x = 0; x < 12; x++) {
        const c = row[x];
        if (c && c !== '.' && art.pal[c]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${art.pal[c]}"/>`;
      }
    });
    return `<svg class="pixel-badge-art" viewBox="0 0 12 12" shape-rendering="crispEdges" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${rects}</svg>`;
  }

  /* ---------- level math (display only; server stores the authoritative level) ---------- */
  const xpForLevel = L => LEVEL_FACTOR * L * (L - 1);
  function levelFor(xp) {
    const v = Math.max(0, Number(xp) || 0);
    return Math.min(LEVEL_MAX, Math.max(1, Math.floor((1 + Math.sqrt(1 + 4 * v / LEVEL_FACTOR)) / 2)));
  }
  function levelProgress(xp, level) {
    const v = Math.max(0, Number(xp) || 0), L = Math.max(1, Number(level) || levelFor(v));
    if (L >= LEVEL_MAX) return { level: L, into: 0, span: 0, pct: 100, toNext: 0, max: true };
    const floor = xpForLevel(L), next = xpForLevel(L + 1);
    const into = Math.max(0, v - floor), span = next - floor;
    return { level: L, into, span, pct: Math.max(0, Math.min(100, Math.round(into / span * 100))), toNext: Math.max(0, next - v), max: false };
  }
  const titleOf = key => TITLES[key] || TITLES.novice;

  function catalog(rows) {
    const list = Array.isArray(rows) && rows.length ? rows : BADGES;
    return list.map(r => ({ ...(BADGES.find(b => b.code === r.code) || {}), ...r, available: r.available !== false }));
  }

  /* ---------- markup ---------- */
  function xpBar(p, label) {
    return `<div class="xp-meta"><span>${esc(label)}</span><span>${p.max ? 'เลเวลสูงสุด' : `อีก ${p.toNext.toLocaleString('th-TH')} XP ถึง Lv.${p.level + 1}`}</span></div><div class="xp-track" role="progressbar" aria-label="ความคืบหน้าเลเวล" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}"><span style="width:${p.pct}%"></span></div>`;
  }

  /* opts: { avatarHtml, name, state:{total_xp,level,title_key}, cls:{icon,en,th}, compact, pending, note } */
  function progressCard(o) {
    const st = o.state || { total_xp: 0, level: 1, title_key: 'novice' };
    const p = levelProgress(st.total_xp, st.level), t = titleOf(st.title_key), cls = o.cls || { icon: '🧭', en: 'Wanderer', th: 'นักเดินทาง' };
    const xpText = `${Number(st.total_xp || 0).toLocaleString('th-TH')} XP`;
    if (o.compact) {
      return `<div class="adventure-card character-rank-card progress-compact"><div class="level-line"><span class="explorer-icon" aria-hidden="true">${classIcon(cls)}</span><div><strong>Lv. ${p.level} <span class="class-name">${esc(cls.en)}</span></strong><p>${esc(t.th)} · ${esc(cls.th)}</p></div></div>${xpBar(p, xpText)}<button class="text-button class-path-link" data-action="class-paths">ดูเส้นทางอาชีพทั้งหมด</button>${o.note ? `<p class="form-help character-rank-note">${esc(o.note)}</p>` : ''}</div>`;
    }
    return `<section class="progress-card" aria-label="ความคืบหน้าตัวละคร">
      <div class="progress-avatar">${o.avatarHtml || ''}<span class="progress-level-chip">Lv.${p.level}</span></div>
      <div class="progress-body">
        <small class="progress-kicker">CHARACTER PROGRESS</small>
        <div class="progress-title"><strong>${esc(o.name || '')}</strong><span class="title-chip">${esc(t.en)} · ${esc(t.th)}</span></div>
        ${o.readonly
          ? `<div class="progress-class readonly"><span class="progress-class-icon" aria-hidden="true">${classIcon(cls)}</span><span><small>PRIMARY LIFE CLASS</small><b>${esc(cls.en)} · ${esc(cls.th)}</b></span></div>`
          : `<button class="progress-class" data-action="class-paths" aria-label="อาชีพหลัก ${esc(cls.en)} — ดูเส้นทางอาชีพ"><span class="progress-class-icon" aria-hidden="true">${classIcon(cls)}</span><span><small>PRIMARY LIFE CLASS</small><b>${esc(cls.en)} · ${esc(cls.th)}</b></span><span class="progress-class-go">เส้นทาง ›</span></button>`}
        ${xpBar(p, xpText)}
        ${o.note ? `<p class="form-help progress-note">${esc(o.note)}</p>` : ''}
      </div>
    </section>`;
  }

  /* opts: { catalog, earned:Set, compact, label, action } — action defaults to the owner's badge-detail */
  function badgeStrip(o) {
    const list = catalog(o.catalog), earned = o.earned || new Set();
    const cells = list.map(b => {
      const got = earned.has(b.code), soon = !b.available;
      const state = got ? 'ได้รับแล้ว' : soon ? 'เร็ว ๆ นี้' : 'ยังไม่ได้รับ';
      return `<button class="pixel-badge ${got ? 'earned' : 'locked'} ${soon ? 'soon' : ''} rarity-${esc(b.rarity || 'common')}" data-action="${esc(o.action || 'badge-detail')}" data-badge="${esc(b.code)}" aria-label="เหรียญ ${esc(b.name_en)} — ${state}"><span class="pixel-badge-frame">${badgeArt(b.pixel_asset_key)}${soon ? '<i class="soon-tag">SOON</i>' : ''}</span>${o.compact ? '' : `<small>${esc(b.name_en)}</small>`}</button>`;
    }).join('');
    const count = list.filter(b => earned.has(b.code)).length;
    return `<div class="badge-strip ${o.compact ? 'compact' : ''}"><div class="badge-strip-head"><span>${esc(o.label || 'เหรียญแห่งการเดินทาง')}</span><b>${count}/${list.filter(b => b.available).length}</b></div><div class="badge-strip-row">${cells}</div></div>`;
  }

  /* opts: { badge, earned, awardedAt, progress:{current,target}|null, own } */
  function badgeDetail(o) {
    const b = o.badge, soon = !b.available;
    const status = o.earned
      ? `<p class="badge-status earned">✓ ได้รับแล้ว${o.awardedAt ? ' · ' + esc(new Date(o.awardedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })) : ''}</p>`
      : soon ? '<p class="badge-status soon">เร็ว ๆ นี้ — ยังเก็บเหรียญนี้ไม่ได้ในรุ่นนี้</p>'
      : o.progress && o.own ? `<p class="badge-status">ความคืบหน้าของคุณ ${o.progress.current}/${o.progress.target}</p><div class="xp-track"><span style="width:${Math.round(Math.min(1, o.progress.current / Math.max(1, o.progress.target)) * 100)}%"></span></div>`
      : '<p class="badge-status">ยังไม่ได้รับ</p>';
    return `<div class="badge-detail ${o.earned ? 'earned' : 'locked'}"><span class="pixel-badge-frame big rarity-${esc(b.rarity || 'common')}">${badgeArt(b.pixel_asset_key, b.name_en)}</span><h3>${esc(b.name_en)} <small>${esc(b.name_th)}</small></h3><p class="form-help">${esc(b.description_th)}</p><p class="badge-rarity">${esc(RARITY_TH[b.rarity] || 'ทั่วไป')}</p>${status}<p class="form-help badge-fineprint">เหรียญคำนวณจาก Discovery ที่เผยแพร่และตรวจสอบได้บนเซิร์ฟเวอร์ ปักหมุดซ้ำที่เดิม ๆ ไม่ช่วยให้ได้เร็วขึ้น</p></div>`;
  }

  window.GerarAIProgression = Object.freeze({
    LEVEL_FACTOR, LEVEL_MAX, TITLES, BADGES, badgeArt, classIcon, xpForLevel, levelFor, levelProgress, titleOf,
    catalog, progressCard, badgeStrip, badgeDetail
  });
})();
