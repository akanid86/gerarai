'use strict';
/* GERARAI — legal pages from one source (v0.7.0-dev) · docs/LEGAL-PAGES-PROPOSAL.md (approved with changes 30 Sep 21:44)
 * Which text a page shows:
 *   1. the version PUBLISHED in the database (policy_current → policy_documents), when the database answers;
 *      if the database answers that nothing is published, nothing is shown (the database is authoritative);
 *   2. only when the database cannot be reached: legal-published.js — a build of the last PROMOTED published version;
 *   3. otherwise: "no document in force" + contact.
 * Candidate drafts (legal-candidates.js) are NEVER shown to the public: only on a local development host, and only with
 * "?preview=candidate" in the route. Help pages (#contact, #appeal, #copyright, #data-rights) are not stored in the DB,
 * so they come from the published snapshot only.
 * Text is plain text (see tools/build-legal.py); GerarAILegal.render() escapes everything and is shared with onboarding.
 * Loaded right after app.js so that live.js / discovery-ui.js render wrappers still run around it.
 */
(function () {
  const R = window.GerarAIRemote;
  const SNAP = () => window.GERARAI_LEGAL_PUBLISHED || { docs: {}, help: {} };
  const DEV = (h => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || /\.localhost$/.test(h))(location.hostname);
  const PAGES = [
    ['terms', 'policy', 'terms', 'ข้อกำหนดการใช้บริการ'],
    ['community', 'policy', 'community', 'มาตรฐานชุมชน'],
    ['privacy', 'policy', 'privacy_notice', 'ประกาศความเป็นส่วนตัว'],
    ['emergency-safety', 'policy', 'emergency_notice', 'ข้อควรรู้เรื่องข้อมูลสถานการณ์'],
    ['location-safety', 'policy', 'location_safety', 'ข้อควรรู้เรื่องการแชร์ตำแหน่ง'],
    ['contact', 'help', 'contact', 'ติดต่อ GERARAI'],
    ['appeal', 'help', 'appeal', 'อุทธรณ์การดำเนินการ'],
    ['copyright', 'help', 'copyright', 'แจ้งละเมิดลิขสิทธิ์'],
    ['data-rights', 'help', 'data_rights', 'สิทธิในข้อมูลของคุณ']
  ].map(([route, kind, key, label]) => ({ route, kind, key, label }));
  const byRoute = new Map(PAGES.map(p => [p.route, p]));
  function parse(r) {
    const [path, qs = ''] = String(r || '').split('?');
    const page = byRoute.get(path); if (!page) return null;
    return { page, preview: DEV && new URLSearchParams(qs).get('preview') === 'candidate' };
  }

  /* ---------------------------------------------------------------- shared plain-text renderer */
  const escH = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function renderText(text, { marks = false, headingClass = 'legal-h' } = {}) {
    const e = s => { const h = escH(s); return marks ? h.replace(/⟦[^⟧]*⟧/g, m => `<mark class="legal-gap">${m}</mark>`) : h; };
    return String(text).replace(/\r\n?/g, '\n').split(/\n{2,}/).map(t => t.trim()).filter(Boolean).map(t => {
      if (/^\d+\.\s\S/.test(t) && !t.includes('\n') && t.length <= 80) return `<h4 class="${headingClass}">${e(t)}</h4>`;
      const lines = t.split('\n');
      if (lines.length > 1 && !lines[0].startsWith('•') && lines.slice(1).every(l => l.startsWith('•')) && lines[0].length <= 60)
        return `<p><strong>${e(lines[0])}</strong><br>${lines.slice(1).map(e).join('<br>')}</p>`;
      return `<p>${e(t).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }
  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------------------------------------------------------------- which version */
  function dbState() {
    if (!R || !R.enabled) return 'unreachable';                      // local prototype mode
    if (R.status === 'error') return 'unreachable';
    const o = R.onboarding || {};
    if (o.available === true && o.status) return 'ready';
    if (o.available === false) return 'unreachable';                  // M1 not installed: nothing can be published there
    if (o.error) return 'unreachable';
    return 'loading';
  }
  async function resolve(page) {
    if (page.kind === 'policy') {
      const st = dbState();
      if (st === 'loading') return { source: 'loading' };
      if (st === 'ready') {
        const p = (R.onboarding.status.policies || []).find(x => x.policy_type === page.key);
        if (!p) return { source: 'none' };                            // the database says: nothing in force
        try {
          const d = await R.onboardingDoc(p.policy_type, p.version);
          if (d.shownHash !== p.content_hash) console.warn('[GERARAI] legal: hash mismatch for', page.key, p.version);
          const snap = SNAP().docs[page.key];
          if (snap && snap.version === d.version && snap.sha256 !== d.shownHash) console.warn('[GERARAI] legal: snapshot differs from the published text', page.key, d.version);
          return { source: 'db', doc: { title: d.title, content: d.content, version: d.version, effective_at: d.effective_at } };
        } catch (err) { console.warn('[GERARAI] legal: database read failed, using the published snapshot', err?.message); }
      }
    }
    const snap = (page.kind === 'policy' ? SNAP().docs : SNAP().help)[page.key];
    return snap ? { source: 'snapshot', doc: snap } : { source: 'none' };
  }
  let candidateLoad = null;
  function loadCandidates() {
    if (!DEV) return Promise.resolve(null);
    if (window.GERARAI_LEGAL_CANDIDATES) return Promise.resolve(window.GERARAI_LEGAL_CANDIDATES);
    return candidateLoad ||= new Promise(res => {
      const s = document.createElement('script'); s.src = 'legal-candidates.js?t=' + Date.now();
      s.onload = () => res(window.GERARAI_LEGAL_CANDIDATES || null); s.onerror = () => res(null);
      document.head.appendChild(s);
    });
  }

  /* ---------------------------------------------------------------- page */
  const thaiDate = iso => { try { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };
  const nav = cur => `<nav class="legal-nav" aria-label="เอกสารและความช่วยเหลือ">${PAGES.map(p => p.route === cur ? `<span aria-current="page">${escH(p.label)}</span>` : `<a href="#${p.route}">${escH(p.label)}</a>`).join('')}</nav>`;
  const shell = (page, inner) => `<article class="legal-page" data-legal="${page.route}"><button class="back-link" data-nav="profile">${typeof icon === 'function' ? icon('back') : ''}กลับ</button>${inner}${nav(page.route)}</article>`;
  let seq = 0;
  async function draw(parsed) {
    const mine = ++seq, { page, preview } = parsed;
    const put = html => { if (mine === seq && parse(route)?.page === page) { main.innerHTML = shell(page, html); if (typeof decorateIcons === 'function') decorateIcons(main); } };
    if (preview) {
      put('<p class="muted" role="status">กำลังโหลดฉบับร่าง…</p>');
      const c = await loadCandidates(), d = c && (page.kind === 'policy' ? c.docs : c.help)[page.key];
      if (!d) return put(`<h1>${escH(page.label)}</h1><p class="legal-none">ไม่พบไฟล์ฉบับร่างบนเครื่องพัฒนา (รัน <code>python3 tools/build-legal.py candidates</code>)</p>`);
      const gaps = (c.unfilled?.[page.key] || []).length;
      return put(`<div class="draft-banner legal-candidate-banner" role="note"><strong>ฉบับร่าง (candidate) · แสดงเฉพาะเครื่องพัฒนา</strong>ยังไม่มีผลบังคับใช้ ยังไม่ผ่านการตรวจทางกฎหมาย และไม่แสดงต่อสาธารณะ${gaps ? ` · ยังไม่กรอก ${gaps} รายการ (ไฮไลต์สีเหลือง)` : ''}</div><h1>${escH(d.title)}</h1><div class="legal-body">${renderText(d.content, { marks: true })}</div>`);
    }
    put('<p class="muted" role="status">กำลังโหลดเอกสาร…</p>');
    const r = await resolve(page);
    if (r.source === 'loading') return;                                // redrawn when the status arrives
    if (r.source === 'none') {
      const contact = SNAP().help.contact && page.key !== 'contact';
      return put(`<h1>${escH(page.label)}</h1><p class="legal-none">ยังไม่มีเอกสารฉบับที่มีผลบังคับใช้ GERARAI อยู่ระหว่างเตรียมเอกสารสำหรับ Open Beta</p>${contact ? '<p class="legal-none"><a href="#contact">ติดต่อ GERARAI</a></p>' : ''}${DEV ? `<p class="legal-dev-hint"><a href="#${page.route}?preview=candidate">ดูฉบับร่าง (เฉพาะเครื่องพัฒนา)</a></p>` : ''}`);
    }
    const d = r.doc, when = d.effective_at ? thaiDate(d.effective_at) : '';
    const meta = r.source === 'db'
      ? `ฉบับ ${escH(d.version)}${when ? ` · มีผลตั้งแต่ ${escH(when)}` : ''}`
      : `ฉบับ ${escH(d.version)}${when ? ` · มีผลตั้งแต่ ${escH(when)}` : ''} · สำเนาฉบับที่เผยแพร่ (เชื่อมต่อฐานข้อมูลไม่ได้ในขณะนี้)`;
    put(`<h1>${escH(d.title)}</h1><p class="muted legal-meta" data-source="${r.source}">${meta}</p><div class="legal-body">${renderText(d.content)}</div>${DEV ? `<p class="legal-dev-hint"><a href="#${page.route}?preview=candidate">ดูฉบับร่างรอบถัดไป (เฉพาะเครื่องพัฒนา)</a></p>` : ''}`);
  }

  // Legal routes are answered here; every other route goes to the existing renderer.
  const baseRender = render;
  render = function () {
    const parsed = parse(route);
    if (!parsed) return baseRender();
    if (map) { map.remove(); map = null; }
    renderNav();
    draw(parsed);
  };
  renderLegal = kind => draw(parse(kind));                             // any remaining direct caller

  // Re-draw once the database answer arrives (start, sign-in, sign-out).
  if (R && R.enabled) {
    const baseLoad = R.loadOnboarding;
    R.loadOnboarding = async function (...args) {
      try { return await baseLoad.apply(this, args); }
      finally { const p = parse(route); if (p && !p.preview) setTimeout(() => { if (parse(route)) draw(parse(route)); }, 0); }
    };
  }

  // app.js drew its first screen before this file loaded (and sends unknown routes such as "terms?preview=…" to the feed)
  { const h = decodeURIComponent(location.hash.slice(1)); if (parse(h)) { route = h; render(); } }

  window.GerarAILegal = Object.freeze({ render: renderText, sha256Hex, resolve: route => { const p = parse(route); return p ? resolve(p.page) : Promise.resolve(null); }, pages: PAGES.map(p => ({ ...p })), isDevHost: DEV });
})();
