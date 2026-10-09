'use strict';
/* GERARAI — โหมดใช้งานจริง (ระยะ 2)
 * โหลดหลัง app.js และทำงานเฉพาะเมื่อ Remote.enabled (config.js: backend 'supabase')
 * แทนที่ hook ใน app.js (postSource, isOn, …) และดักปุ่มที่ต้องเขียนลงฐานข้อมูล
 * เรื่องราวตัวอย่าง (is_sample) ยังแสดงอยู่ แต่เป็นแบบอ่านอย่างเดียวและมีป้าย “ตัวอย่าง”
 */
(function () {
  const Remote = window.GerarAIRemote;
  if (!Remote || !Remote.enabled) return;
  window.GERARAI_LIVE = true;
  document.documentElement.classList.add('live');

  const startHash = location.hash;
  const cameFromAuthLink = /access_token=|error_description=/.test(startHash);
  const authLinkError = /error_description=/.test(startHash);
  const Gate = window.GerarAIGate;
  // Open Beta gate: until a session is confirmed every non-legal route (auth callback, deep links such as #u/…) stays on
  // the landing; app.js remembered the requested route and Gate.mount() opens it after sign-in.
  route = Gate.routeFor(cameFromAuthLink ? 'gate' : (decodeURIComponent(startHash.slice(1)) || 'feed'));

  const seedLive = seedPosts.map(p => ({ ...p, own: false }));
  const SAMPLE_MSG = 'นี่คือเรื่องราวตัวอย่าง กดถูกใจ บันทึก หรือแสดงความคิดเห็นไม่ได้';
  const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  const busy = (btn, on, text) => { if (!btn) return; if (on) { btn.dataset.label = btn.textContent; btn.textContent = text; btn.disabled = true; } else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; } };
  const fail = err => { console.error('[GERARAI]', err); toast(err instanceof Error && /พิกัด|Discovery|ความละเอียด|แผนที่/.test(err.message) ? err.message : Remote.errorText(err)); };
  const extractTags = body => [...new Set([...body.matchAll(/#([\p{L}\p{M}\p{N}_]+)/gu)].map(m => m[1]))].slice(0, 10);

  /* ---------- hooks ---------- */
  postSource = () => [...Remote.data.posts, ...seedLive];
  isOn = (kind, id) => (kind === 'savedPlaces' || Remote.isId(id)) ? Remote.data[kind].includes(id) : false;
  // เนื้อหาตัวอย่างต้องไม่ปนกับสถานะบัญชีจริง: ธง following ในข้อมูลตัวอย่างใช้เฉพาะโหมดต้นแบบ
  isFollowing = p => p.remote ? Remote.data.following.includes(p.authorId) : false;
  canEdit = p => !!(p.remote && p.own);
  postBadge = p => p.remote ? '' : '<span class="sample-chip" title="เรื่องราวตัวอย่าง ไม่ใช่ผู้ใช้จริง">ตัวอย่าง</span>';
  meInitial = () => Remote.profile?.display_name?.[0] || '';

  /* ---------- M2 Place Disclosure (PD-2/PD-3, locked contract 1 Oct 21:32) ---------- */
  // P3: member mode never offers or shows sample/mock places — the catalogue becomes the real published GERARAI places.
  places.splice(0, places.length);
  const syncPlaces = () => { places.splice(0, places.length, ...(Remote.places || [])); };
  const baseReload = Remote.reload;
  Remote.reload = async function (...args) { const r = await baseReload.apply(this, args); syncPlaces(); return r; };

  /* ---------- Open Beta gate: no member data without a confirmed session ---------- */
  // Signed out: nothing but the public policy status (legal pages) is requested — no places, Stories, Discoveries,
  // profiles or progression. Signed in: the stored session is first confirmed with the Auth server (/auth/v1/user);
  // an explicitly rejected session (401/403) is signed out instead of loading data.
  const AUTH_KEY = (() => { try { return 'sb-' + new URL(window.GERARAI_CONFIG.supabase.url).hostname.split('.')[0] + '-auth-token'; } catch { return ''; } })();
  function clearMemberState() {
    Remote.profile = null; Remote.places = []; Remote.placeIds = {};
    Remote.data = { posts: [], liked: [], saved: [], savedPlaces: [], following: [], blocked: [] };
    Remote.classProgress = []; Remote.classCatalog = [];
    Remote.progression = { available: false, state: null, badges: [], catalog: [], summary: null };
    syncPlaces();
  }
  async function sessionRejected() {
    let token = '';
    try { token = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null')?.access_token || ''; } catch { token = ''; }
    if (!token) return false;                     // in-memory session just issued by the Auth server (link / code)
    try {
      const cfg = window.GERARAI_CONFIG.supabase;
      const res = await fetch(cfg.url + '/auth/v1/user', { headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + token }, cache: 'no-store' });
      if (res.status === 401 || res.status === 403) return true;
      if (!res.ok) return false;
      const u = await res.json().catch(() => null);
      return !!(u?.id && Remote.user?.id && u.id !== Remote.user.id);
    } catch { return false; }                     // network: the data requests below fail on their own
  }
  async function anonymousReload() {
    clearMemberState();
    await Remote.loadOnboarding().catch(err => { Remote.onboarding = { available: null, status: null, error: err }; console.warn('[GERARAI] onboarding status:', err?.code, err?.message); });
  }
  const memberReload = Remote.reload;
  Remote.reload = async function (...args) {
    if (!Remote.user) return anonymousReload();
    if (await sessionRejected()) {
      console.warn('[GERARAI] stored session rejected by the Auth server — signing out');
      await anonymousReload();
      try { await Remote.signOut(); } catch { /* the local session is dropped either way */ }
      return;
    }
    if (!Remote.user) return anonymousReload();
    resetFeed();
    const out = await memberReload.apply(this, args);
    resetFeed();
    return out;
  };
  window.addEventListener('gerarai:identity-changing', () => {
    publicCache.clear(); resetFeed();
    if (!Remote.user) { clearMemberState(); if (Gate.open) Gate.enter(); }   // sign-out / session expiry: back to the gate now
    else if (!Gate.open) Gate.setStatus('entering');
  });
  const PD_LABEL = { private: 'ไม่แสดง', area: 'แสดงแค่พื้นที่', venue: 'แสดงชื่อสถานที่' };
  // own = the Story's current link (edit form) from story_places, so a link outside the catalogue is kept, not wiped (G10)
  function placeOptions(selected, own) {
    const extra = own && own.slug && !places.some(x => x.id === own.slug)
      ? `<option value="${esc(own.slug)}" selected>${esc(own.name || own.slug)} · ${own.status === 'published' ? esc(own.city || '') : own.status === 'sample' ? 'ข้อมูลตัวอย่าง (แสดงไม่ได้)' : 'ยังไม่เปิดสาธารณะ'}</option>` : '';
    return `<option value="">ไม่ผูกกับสถานที่</option>${extra}${places.map(x => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''}>${esc(x.name)} · ${esc(x.city)}</option>`).join('')}`;
  }
  const placeDisclosureMarkup = () => `<fieldset class="place-disclosure" hidden><legend>แสดงสถานที่นี้บนเรื่องราวไหม</legend>
      ${['private', 'area', 'venue'].map(v => `<label class="place-disclosure-option"><input type="radio" name="place_disclosure" value="${v}"><span><b>${PD_LABEL[v]}</b><small data-pd-help="${v}">${v === 'private' ? 'ผูกไว้ให้คุณเห็นคนเดียว คนอื่นไม่เห็นสถานที่' : v === 'area' ? 'คนอื่นเห็นแค่เมืองของสถานที่' : 'คนอื่นเห็นชื่อสถานที่ และกดไปหน้าสถานที่ได้'}</small></span></label>`).join('')}
      <label class="place-venue-confirm" hidden><input type="checkbox" name="place_venue_confirm"><span>ฉันยืนยันจะแสดง<b>ชื่อสถานที่</b> แม้ตำแหน่งการค้นพบตั้งไว้แบบโดยประมาณ (ชื่อสถานที่จะบอกตำแหน่งจริงของฉัน)</span></label>
      <p class="form-help place-disclosure-note" role="status"></p></fieldset>`;
  function bindPlaceDisclosure(form, own) {
    const box = form.querySelector('.place-disclosure'), sel = form.querySelector('select[name=place]');
    if (!box || !sel) return;
    const radio = v => box.querySelector(`[name=place_disclosure][value=${v}]`);
    const confirm = box.querySelector('.place-venue-confirm'), note = box.querySelector('.place-disclosure-note');
    let touched = !!own;                                               // an existing link keeps its stored choice
    (radio(own?.disclosure || 'private') || radio('private')).checked = true;
    if (own?.venueConfirmed) confirm.querySelector('input').checked = true;
    box.addEventListener('change', e => { if (e.target.name === 'place_disclosure') touched = true; update(); });
    form.addEventListener('change', e => { if (e.target === sel) { touched = !!(own && sel.value === own.slug); if (touched) (radio(own.disclosure) || radio('private')).checked = true; } if (e.target === sel || e.target.name === 'discovery_precision') update(); });
    function update() {
      const slug = sel.value; box.hidden = !slug; if (!slug) return;
      const prec = form.querySelector('[name=discovery_precision]')?.value || 'none';
      const isOwn = own && slug === own.slug, status = isOwn ? own.status : (places.some(x => x.id === slug) ? 'published' : 'unknown');
      const notPublic = status !== 'published';
      if (!touched) (radio(prec === 'approximate' ? 'area' : 'private')).checked = true;   // P1: approximate defaults to the coarse area
      radio('area').disabled = radio('venue').disabled = notPublic || prec === 'hidden';
      if (radio('area').disabled && !radio('private').checked) radio('private').checked = true;
      const venue = radio('venue').checked;
      confirm.hidden = !(venue && prec === 'approximate');
      note.textContent = notPublic ? (status === 'sample' ? 'สถานที่นี้เป็นข้อมูลตัวอย่าง จึงแสดงบนเรื่องราวไม่ได้' : 'สถานที่นี้ยังไม่เปิดสาธารณะ จึงแสดงบนเรื่องราวไม่ได้')
        : prec === 'hidden' ? 'ตำแหน่งแบบซ่อน: สถานที่จะไม่แสดงต่อผู้อื่น'
        : prec === 'approximate' ? 'ตำแหน่งโดยประมาณ: ค่าเริ่มต้นแสดงแค่พื้นที่ · การแสดงชื่อสถานที่ต้องยืนยันแยก'
        : '';
    }
    update();
  }
  function readPlaceDisclosure(form) {
    const slug = form.querySelector('select[name=place]')?.value; if (!slug) return null;
    const level = form.querySelector('[name=place_disclosure]:checked')?.value || 'private';
    const prec = form.querySelector('[name=discovery_precision]')?.value || 'none';
    const confirmVenue = !!form.querySelector('[name=place_venue_confirm]')?.checked;
    if (level === 'venue' && prec === 'approximate' && !confirmVenue) return { error: 'ติ๊กยืนยันก่อน หากต้องการแสดงชื่อสถานที่ทั้งที่ตำแหน่งเป็นแบบโดยประมาณ' };
    return { level, confirmVenue: level === 'venue' && confirmVenue };
  }
  const PD_ERRORS = { venue_confirmation_required: 'ต้องยืนยันแยกก่อนแสดงชื่อสถานที่ เมื่อใช้ตำแหน่งแบบโดยประมาณ', place_disclosure_exceeds_precision: 'ตำแหน่งแบบซ่อนแสดงสถานที่ไม่ได้', place_not_public: 'สถานที่นี้ยังไม่เปิดสาธารณะ จึงแสดงบนเรื่องราวไม่ได้' };
  const pdFail = err => { const m = String(err?.message || ''); const k = Object.keys(PD_ERRORS).find(x => m.includes(x)); if (k) toast(PD_ERRORS[k]); else fail(err); };
  // place page: load the Stories that disclose this venue (and my own there) before showing the Stories tab
  const basePlace = renderPlace;
  renderPlace = function (id) {
    basePlace(id);
    if (!places.some(x => x.id === id) || renderPlace._loading === id) return;
    renderPlace._loading = id;
    Remote.placeStories(id).then(() => { if (route === 'place/' + id) basePlace(id); }).catch(() => {}).finally(() => { renderPlace._loading = null; });
  };
  const Avatar = window.GerarAIAvatar, Character = window.GerarAICharacter;
  function profileProgressAvatar(pr, fallback) {
    if (pr.avatar_type === 'pixel' && Character.toV2(pr.pixel_avatar_data).companion.enabled) {
      return `<span class="progress-gerdey-pair">${Character.scene(pr.pixel_avatar_data, 'Gerdey และเพื่อนร่วมทาง')}</span>`;
    }
    return `<span class="avatar progress-avatar-img">${fallback}</span>`;
  }
  const myAvatarSubject = () => ({ name: Remote.profile?.display_name, photoUrl: Remote.avatarUrl(Remote.profile?.avatar_path), avatarType: Remote.profile?.avatar_type || (Remote.profile?.avatar_path ? 'photo' : 'initial'), pixelSpec: Remote.profile?.pixel_avatar_data || null });
  const myAvatar = () => Avatar.inner(myAvatarSubject());
  avatarInner = p => p.remote ? Avatar.inner({ name: p.author, photoUrl: p.authorAvatar, avatarType: p.authorAvatarType, pixelSpec: p.authorPixelAvatar }) : esc(p.avatar || p.author[0]);
  countSaved = () => Remote.data.saved.length;
  /* ---------- progression (server-computed; display only) ---------- */
  const Progression = window.GerarAIProgression;
  const PROG_PENDING = 'ระบบเลเวลและเหรียญยังไม่เปิดบนฐานข้อมูลนี้ — ทุกคนเริ่มที่ Wanderer Lv.1';
  const myPrimaryCode = () => Remote.progression.state?.primary_class_code || 'wanderer';
  const myClass = () => Character.classByCode(Character.primaryProgress(Remote.classProgress, myPrimaryCode()).class_code);
  const myState = () => Remote.progression.state || { total_xp: 0, level: 1, title_key: 'novice' };
  const myEarned = () => new Set(Remote.progression.badges.map(b => b.badge_code));
  levelMarkup = function () {
    if (!Remote.user) return `<div class="adventure-card character-rank-card"><div class="level-line"><span class="explorer-icon" aria-hidden="true">🧭</span><div><strong>Lv. 1 <span class="class-name">Wanderer</span></strong><p>เข้าสู่ระบบเพื่อเริ่มเก็บเลเวลและเหรียญจาก Discovery จริงของคุณ</p></div></div><button class="text-button class-path-link" data-nav="profile">เริ่มต้นที่โปรไฟล์</button></div>`;
    return Progression.progressCard({ compact: true, state: myState(), cls: myClass(), note: Remote.progression.available ? '' : PROG_PENDING });
  };
  badgesMarkup = function () {
    return Progression.badgeStrip({ compact: true, catalog: Remote.progression.catalog, earned: Remote.user ? myEarned() : new Set() });
  };
  function classPathsDialog() {
    const opts = () => ({ primary: myPrimaryCode(), summary: Remote.progression.summary, selectable: !!Remote.user && Remote.progression.available, live: true });
    openDialog('เส้นทางอาชีพ', Character.pathDialogMarkup(Remote.classProgress, opts()));
    if (Remote.user && Remote.progression.available && !Remote.progression.summary) {
      Remote.loadProgressionSummary().then(() => {
        if (dialog.open && document.getElementById('dialog-title').textContent === 'เส้นทางอาชีพ') dialogContent.innerHTML = Character.pathDialogMarkup(Remote.classProgress, opts());
      }).catch(err => console.warn('[GERARAI] progression summary', err));
    }
  }
  async function setPrimaryClass(code, btn) {
    busy(btn, true, '…');
    try { await Remote.setPrimaryClass(code); classPathsDialog(); render(); toast(`ตั้ง ${Character.classByCode(code).en} เป็นอาชีพหลักแล้ว`); }
    catch (err) { busy(btn, false); fail(err); }
  }
  function badgeDialog(code) {
    const badge = Progression.catalog(Remote.progression.catalog).find(b => b.code === code);
    if (!badge) return;
    const own = Remote.progression.badges.find(b => b.badge_code === code);
    const draw = () => {
      const m = Remote.progression.summary?.badges?.find(b => b.code === code);
      return Progression.badgeDetail({ badge, earned: !!own, awardedAt: own?.awarded_at, own: !!Remote.user, progress: m ? { current: m.current, target: m.target } : null });
    };
    openDialog('เหรียญแห่งการเดินทาง', draw());
    if (Remote.user && Remote.progression.available && !Remote.progression.summary) {
      Remote.loadProgressionSummary().then(() => { if (dialog.open && dialogContent.querySelector('.badge-detail')) dialogContent.innerHTML = draw(); }).catch(() => {});
    }
  }
  // After a Story/Discovery change the server recomputes progression; reload it and describe the gain.
  async function progressionGain() {
    try {
      const d = await Remote.refreshProgression();
      if (!d) return '';
      const cat = Progression.catalog(Remote.progression.catalog);
      const parts = [];
      if (d.xp > 0) parts.push(`+${d.xp} XP`);
      if (d.levelUp) parts.push(`เลเวลอัป! Lv.${d.levelUp}`);
      d.newBadges.forEach(c => parts.push(`ได้เหรียญ ${cat.find(b => b.code === c)?.name_en || c}`));
      return parts.length ? ' · ' + parts.join(' · ') : '';
    } catch (err) { console.warn('[GERARAI] progression refresh', err); return ''; }
  }

  const baseRenderNav = renderNav;
  renderNav = function () {
    if (!Gate.open) return;
    baseRenderNav();
    const btn = document.querySelector('.avatar-header');
    if (Remote.user) { btn.innerHTML = myAvatar(); btn.setAttribute('aria-label', 'เปิดโปรไฟล์ของฉัน'); btn.classList.remove('signed-out'); }
    else { btn.innerHTML = icon('user'); btn.setAttribute('aria-label', 'เข้าสู่ระบบ'); btn.classList.add('signed-out'); }
  };

  /* ---------- sign in ---------- */
  function signInDialog(reason = '') {
    if (Remote.status === 'error') {
      openDialog('ระบบสมาชิกยังใช้งานไม่ได้', `${reason ? `<p class="signin-reason">${esc(reason)}</p>` : ''}<p class="form-help">${esc(startError ? Remote.errorText(startError) : 'เชื่อมต่อระบบสมาชิกไม่ได้')}</p><div class="form-submit"><button class="primary" onclick="location.reload()">ลองใหม่</button></div>`);
      return;
    }
    if (Remote.status === 'starting') { toast('กำลังเชื่อมต่อระบบสมาชิก… ลองอีกครั้งในอีกสักครู่'); return; }
    openDialog('เข้าสู่ระบบ GERARAI', `<form id="signin-form">
      ${reason ? `<p class="signin-reason">${esc(reason)}</p>` : ''}
      <label class="form-field">อีเมล<input type="email" name="email" required autocomplete="email" inputmode="email" placeholder="you@example.com"></label>
      <p class="form-help">ไม่ต้องตั้งรหัสผ่าน เราจะส่งลิงก์เข้าสู่ระบบไปที่อีเมลนี้ ถ้ายังไม่มีบัญชีจะสร้างให้อัตโนมัติ<br>หลังเข้าสู่ระบบ ก่อนเริ่มโพสต์หรือโต้ตอบ คุณจะได้อ่านและยืนยัน<a href="#terms">ข้อกำหนดการใช้บริการ</a>และ<a href="#community">มาตรฐานชุมชน</a> และรับทราบ<a href="#privacy">ประกาศความเป็นส่วนตัว</a></p>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-submit"><button class="text-button" type="button" id="have-code">มีรหัส/ลิงก์จากอีเมลแล้ว</button><button class="primary" type="submit">ส่งลิงก์เข้าสู่ระบบ</button></div></form>`);
    const form = document.getElementById('signin-form');
    const showError = msg => { const el = form.querySelector('.form-error'); el.textContent = msg; el.hidden = !msg; };
    const emailOf = () => String(new FormData(form).get('email') || '').trim();
    document.getElementById('have-code').addEventListener('click', () => {
      if (!form.email.checkValidity() || !emailOf()) { showError('ใส่อีเมลที่ใช้ขอเข้าสู่ระบบก่อน'); form.email.focus(); return; }
      codeStep(emailOf(), false);
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = emailOf();
      const btn = form.querySelector('[type=submit]');
      showError(''); busy(btn, true, 'กำลังส่ง…');
      try { await Remote.sendLink(email); codeStep(email); }
      catch (err) { console.error('[GERARAI] signInWithOtp:', err?.status, err?.code, err?.message); busy(btn, false); showError(Remote.errorText(err)); }
    });
  }
  /* ลิงก์จากอีเมลที่ผู้ใช้วางเอง: รับเฉพาะ <Supabase URL>/auth/v1/verify?token=… ของโปรเจกต์นี้
     แล้วเปิดจากหน้าเว็บ (ใช้ได้ในเบราว์เซอร์ที่วางลิงก์ในแถบที่อยู่ไม่ได้ เช่นเบราว์เซอร์ในแอป) */
  function verifyLinkFrom(value) {
    try {
      const u = new URL(value.trim()), base = new URL(window.GERARAI_CONFIG.supabase.url);
      if (u.origin !== base.origin || u.pathname !== '/auth/v1/verify' || !u.searchParams.get('token')) return null;
      u.searchParams.set('redirect_to', location.origin + location.pathname);
      return u.href;
    } catch { return null; }
  }
  function codeStep(email, sent = true) {
    openDialog(sent ? 'เช็กอีเมลของคุณ' : 'ใส่รหัสหรือลิงก์จากอีเมล', `${sent ? `<div class="signin-sent">${icon('check')}<p>ส่งอีเมลเข้าสู่ระบบไปที่<br><b>${esc(email)}</b> แล้ว</p></div>` : `<p class="form-help">ใช้อีเมลเข้าสู่ระบบล่าสุดที่ส่งไปที่ <b>${esc(email)}</b> (ลิงก์/รหัสใช้ได้ครั้งเดียวและมีอายุจำกัด)</p>`}
      <ol class="signin-steps"><li><b>กดลิงก์ในอีเมล</b> บนเบราว์เซอร์นี้ — เหมาะเมื่อเปิดอีเมลในเครื่องเดียวกัน</li><li>หรือ <b>ใส่รหัสตัวเลข</b> จากอีเมล / <b>วางลิงก์</b> ที่คัดลอกจากอีเมล ในช่องนี้ — ใช้ได้ทุกเครื่อง</li></ol>
      <form id="code-form" class="comment-form"><input name="code" autocomplete="one-time-code" maxlength="2000" aria-label="รหัสหรือลิงก์จากอีเมล" placeholder="รหัส หรือวางลิงก์จากอีเมล"><button class="primary" type="submit">ยืนยัน</button></form>
      <p class="form-error" role="alert" hidden></p>
      <p class="form-help">ไม่เจออีเมล ลองดูในโฟลเดอร์สแปม · ลิงก์และรหัสใช้ได้ครั้งเดียว</p>
      <div class="signin-links"><button class="text-button" data-action="signin">ใช้อีเมลอื่น</button><button class="text-button" id="resend" ${sent ? 'disabled' : ''}>${sent ? 'ส่งอีกครั้ง (60)' : 'ส่งอีเมลใหม่'}</button></div>`);
    const showError = msg => { const el = dialogContent.querySelector('.form-error'); el.textContent = msg; el.hidden = !msg; };
    let left = sent ? 60 : 0;
    const resend = document.getElementById('resend');
    const timer = setInterval(() => {
      if (!document.body.contains(resend)) return clearInterval(timer);
      left -= 1; resend.textContent = left > 0 ? `ส่งอีกครั้ง (${left})` : 'ส่งอีกครั้ง'; resend.disabled = left > 0;
      if (left <= 0) clearInterval(timer);
    }, 1000);
    resend.addEventListener('click', async () => { resend.disabled = true; showError(''); try { await Remote.sendLink(email); codeStep(email); toast('ส่งอีเมลใหม่แล้ว'); } catch (err) { console.error('[GERARAI] resend:', err?.status, err?.code, err?.message); resend.disabled = false; showError(Remote.errorText(err)); } });
    document.getElementById('code-form').addEventListener('submit', async e => {
      e.preventDefault();
      const value = String(new FormData(e.target).get('code')).trim();
      const btn = e.target.querySelector('[type=submit]');
      if (/^https?:\/\//i.test(value)) {
        const link = verifyLinkFrom(value);
        if (!link) { showError('ลิงก์นี้ไม่ใช่ลิงก์เข้าสู่ระบบของ GERARAI'); return; }
        busy(btn, true, 'กำลังเปิด…');
        location.href = link;   // Supabase ยืนยันแล้วพากลับมาหน้านี้พร้อม session
        return;
      }
      const code = value.replace(/\s+/g, '');
      if (!/^\d{6,10}$/.test(code)) { showError('ใส่รหัสตัวเลข 6–10 หลัก หรือวางลิงก์จากอีเมล'); return; }
      showError(''); busy(btn, true, '…');
      try { await Remote.verifyCode(email, code); /* onChange จะ render และปิด dialog */ }
      catch (err) { console.error('[GERARAI] verifyOtp:', err?.status, err?.code, err?.message); busy(btn, false); showError(Remote.errorText(err)); }
    });
  }
  async function signOut() {
    try { await Remote.signOut(); closeDialog(); } catch (err) { fail(err); }
  }

  /* ---------- toggles ---------- */
  async function toggleKind(kind, id) {
    const list = Remote.data[kind];
    const on = !list.includes(id);
    const apply = v => { const i = list.indexOf(id); if (v && i < 0) list.push(id); if (!v && i >= 0) list.splice(i, 1); };
    const redraw = () => {
      if (kind === 'savedPlaces') { if (route === 'place/' + id) { renderPlace(id); } else render(); }
      else if (kind === 'saved' && (route === 'saved' || (route === 'profile' && profileTab === 'saved'))) render();
      else refreshPost(id);
    };
    apply(on); redraw();
    if (kind === 'saved') toast(on ? 'บันทึกเรื่องราวแล้ว' : 'นำออกจากรายการบันทึกแล้ว');
    if (kind === 'savedPlaces') toast(on ? 'บันทึกสถานที่ในโปรไฟล์แล้ว' : 'นำสถานที่ออกจากรายการแล้ว');
    try { await Remote.toggle(kind, id, on); }
    catch (err) { apply(!on); redraw(); fail(err); }
  }

  /* ---------- compose / edit / delete ---------- */
  compose = function () { window.GerarAICheckinComposer.open(); };
  editPost = function (id) { window.GerarAICheckinComposer.edit(id); };

  async function deletePost(id, btn) {
    busy(btn, true, 'กำลังลบ…');
    try { await Remote.deletePost(id); await progressionGain(); closeDialog(); if (route === 'post/' + id) navigate('feed'); else render(); toast('ลบเรื่องราวแล้ว'); }
    catch (err) { busy(btn, false); fail(err); }
  }

  /* ---------- comments ---------- */
  const baseComments = comments;
  comments = async function (id) {
    const p = findPost(id);
    if (!p) return;
    if (!p.remote) { baseComments(id); document.getElementById('comment-form')?.remove(); dialogContent.querySelector('.form-help').textContent = SAMPLE_MSG; return; }
    openDialog('ความคิดเห็น', `<div class="comment-list" id="rc-list" aria-live="polite"><p class="form-help">กำลังโหลด…</p></div>${Remote.user
      ? `<form id="comment-form" class="comment-form"><input name="comment" aria-label="เขียนความคิดเห็น" placeholder="เขียนความคิดเห็น…" required maxlength="500"><button class="primary" type="submit">ส่ง</button></form>`
      : `<button class="primary" data-action="signin">เข้าสู่ระบบเพื่อแสดงความคิดเห็น</button>`}`);
    const draw = async () => {
      const list = document.getElementById('rc-list');
      try {
        const rows = await Remote.comments(id);
        if (!document.body.contains(list)) return;
        list.innerHTML = rows.length ? rows.map(c => `<div class="comment-row"><span class="avatar">${Avatar.inner({ name: c.author, photoUrl: c.avatarUrl, avatarType: c.avatarType, pixelSpec: c.pixelSpec })}</span><p><strong>${esc(c.author)} <small class="muted">· ${esc(c.time)}</small></strong>${esc(c.body)}</p>${c.own || p.own ? `<button class="icon-button" data-action="delete-comment" data-id="${esc(id)}" data-comment="${esc(c.id)}" aria-label="ลบความคิดเห็น">${icon('x')}</button>` : ''}</div>`).join('') : '<p class="form-help">ยังไม่มีความคิดเห็น เริ่มคุยเป็นคนแรกได้เลย</p>';
      } catch (err) { list.innerHTML = `<p class="form-help">${esc(Remote.errorText(err))}</p>`; }
    };
    comments.redraw = draw;
    draw();
    document.getElementById('comment-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const input = e.target.comment, value = input.value.trim();
      if (!value) return;
      const btn = e.target.querySelector('[type=submit]'); busy(btn, true, '…');
      try { await Remote.addComment(id, value); input.value = ''; await draw(); refreshPost(id); }
      catch (err) { fail(err); }
      finally { busy(btn, false); }
    });
  };

  /* ---------- people / follow / block / report ---------- */
  // Mini Profile: short read-only card. Avatar / name / @username / "ดูโปรไฟล์" open the Public Profile.
  // No destructive action here (block/report live in the Public Profile ⋯ menu and the Story ⋯ menu).
  function personDialog(p) {
    const followed = isFollowing(p), to = 'u/' + p.authorId;
    openDialog(p.author, `<button class="mini-profile-head" data-nav="${esc(to)}" aria-label="ดูโปรไฟล์ของ ${esc(p.author)}">${avatar(p)}<span><strong class="mini-profile-name">${esc(p.author)}</strong><small class="mini-profile-handle">${p.handle ? '@' + esc(p.handle) : 'สมาชิก GERARAI'}</small></span></button><div class="person-progress" id="person-progress" aria-live="polite"></div><div class="form-submit mini-profile-actions"><button class="secondary" data-nav="${esc(to)}" data-role="view-profile">ดูโปรไฟล์</button><button class="primary" data-action="follow" data-id="${esc(p.id)}">${followed ? 'กำลังติดตาม' : 'ติดตาม'}</button></div>`);
  }
  function drawPersonProgress(p) {
    Remote.publicProgression(p.authorId).then(info => {
      const el = document.getElementById('person-progress');
      if (!el || !info) return;
      const cls = Character.classByCode(info.state.primary_class_code), t = Progression.titleOf(info.state.title_key);
      const cat = Progression.catalog(Remote.progression.catalog), got = new Set(info.badges);
      el.innerHTML = `<p class="person-rank"><span aria-hidden="true">${cls.icon}</span> Lv.${Number(info.state.level) || 1} ${esc(cls.en)} · ${esc(t.th)}</p>${got.size ? `<div class="person-badges">${cat.filter(b => got.has(b.code)).map(b => `<span class="pixel-badge-frame mini" title="${esc(b.name_en)}">${Progression.badgeArt(b.pixel_asset_key, b.name_en)}</span>`).join('')}</div>` : ''}`;
    }).catch(() => {});
  }
  async function follow(p, btn) {
    const on = !isFollowing(p), list = Remote.data.following;
    busy(btn, true, '…');
    try {
      await Remote.follow(p.authorId, on);
      if (on) list.push(p.authorId); else list.splice(list.indexOf(p.authorId), 1);
      adjustFollowers(p.authorId, on);
      closeDialog(); if ((feedTab === 'following' && route === 'feed') || route === 'u/' + p.authorId) render();
      toast(on ? `ติดตาม ${p.author} แล้ว` : `เลิกติดตาม ${p.author} แล้ว`);
    } catch (err) { busy(btn, false); fail(err); }
  }
  async function block(p, btn) {
    busy(btn, true, 'กำลังบล็อก…');
    try { await Remote.block(p.authorId, p.author); closeDialog(); if (route.startsWith('post/')) navigate('feed'); else render(); toast(`บล็อก ${p.author} แล้ว`); }
    catch (err) { busy(btn, false); fail(err); }
  }
  async function unblock(userId) {
    try { await Remote.unblock(userId); safetyDialog(); render(); toast('เลิกบล็อกแล้ว'); } catch (err) { fail(err); }
  }

  const baseReport = reportPost;
  reportPost = function (id) {
    const p = findPost(id);
    if (!p?.remote) { toast(SAMPLE_MSG); return; }
    baseReport(id);
    const form = document.getElementById('report-form');
    form.querySelector('.form-help').innerHTML = `บอกเราว่าเรื่องราวของ ${esc(p.author)} มีปัญหาอะไร รายงานจะส่งถึงทีมดูแล และเราจะซ่อนเรื่องราวนี้จากฟีดของคุณทันที`;
    const fresh = form.cloneNode(true); form.replaceWith(fresh);   // ตัด handler ของโหมด local ออก
    fresh.addEventListener('submit', async e => {
      e.preventDefault();
      const d = new FormData(fresh);
      if (!d.get('reason')) { toast('เลือกเหตุผลก่อนส่งรายงาน'); return; }
      const btn = fresh.querySelector('[type=submit]'); busy(btn, true, 'กำลังส่ง…');
      try {
        await Remote.report(id, String(d.get('reason')), String(d.get('note') || '').trim());
        state.reported.push({ id, reason: d.get('reason'), at: new Date().toISOString() }); persist();
        closeDialog(); if (route === 'post/' + id) navigate('feed'); else render();
        toast('ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน');
      } catch (err) { busy(btn, false); fail(err); }
    });
  };

  safetyDialog = function () {
    const blocked = Remote.data.blocked;
    openDialog('ความเป็นส่วนตัวและความปลอดภัย', `<h3 class="dialog-section">บัญชี</h3><div class="safety-row"><span>${esc(Remote.user?.email || '')}</span><button class="secondary" data-action="signout">ออกจากระบบ</button></div>
      <h3 class="dialog-section">ผู้ใช้ที่บล็อก</h3>${blocked.length ? blocked.map(b => `<div class="safety-row"><span class="avatar">${Avatar.inner({ name: b.name, photoUrl: b.avatarUrl, avatarType: b.avatarType, pixelSpec: b.pixelSpec })}</span><strong>${esc(b.name)}</strong><button class="secondary" data-action="unblock" data-name="${esc(b.id)}">เลิกบล็อก</button></div>`).join('') : '<p class="form-help">ยังไม่ได้บล็อกใคร</p>'}
      <h3 class="dialog-section">เรื่องราวที่รายงาน</h3>${state.reported.length ? `<div class="safety-row"><span>ซ่อนไว้บนเครื่องนี้ ${state.reported.length} เรื่องราว (รายงานยังอยู่กับทีมดูแล)</span><button class="secondary" data-action="unreport-all">แสดงอีกครั้ง</button></div>` : '<p class="form-help">ยังไม่มีรายงาน</p>'}
      <div class="legal-buttons" style="margin-top:18px"><a class="secondary" href="#privacy">${icon('doc')}ประกาศความเป็นส่วนตัว</a><a class="secondary" href="#terms">${icon('doc')}ข้อกำหนดการใช้บริการ</a><a class="secondary" href="#community">${icon('doc')}มาตรฐานชุมชน</a></div>
      <p class="form-help">ต้องการลบบัญชี ขอสำเนาข้อมูล หรือใช้สิทธิอื่น ดู<a href="#data-rights">สิทธิในข้อมูลของคุณ</a> · อุทธรณ์ได้ที่<a href="#appeal">อุทธรณ์การดำเนินการ</a></p>`);
  };

  /* ---------- profile ---------- */
  editProfile = function () {
    const pr = Remote.profile || {};
    let workingSpec = Character.normalizeSpec(pr.pixel_avatar_data || Character.DEFAULT_SPEC);
    const avatarType = pr.avatar_type || (pr.avatar_path ? 'photo' : 'initial');
    const photoButton = `<label class="secondary avatar-pick">${icon('camera')}<span>${pr.avatar_path ? 'เปลี่ยนรูปของฉัน' : 'อัปโหลดรูปของฉัน'}</span><input id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>`;
    openDialog('สร้างตัวละครของฉัน', `<section class="character-setup">
      <div class="character-hero"><span class="avatar avatar-character-preview" id="avatar-preview">${avatarType === 'pixel' ? Character.scene(workingSpec) : myAvatar()}</span><div><small>CHARACTER IDENTITY</small><h3>${esc(pr.display_name || 'นักเดินทาง')}</h3><p>${myClass().icon} ${esc(myClass().en)} Lv.${Number(myState().level) || 1} · ${esc(Progression.titleOf(myState().title_key).th)}</p></div></div>
      <div class="avatar-mode-row"><button class="secondary ${avatarType==='pixel'?'active':''}" type="button" id="avatar-mode-pixel">▦ Pixel Character</button>${photoButton}${pr.avatar_path ? `<button class="secondary ${avatarType==='photo'?'active':''}" type="button" id="avatar-use-photo">ใช้รูปเดิม</button><button class="text-button danger" type="button" id="avatar-remove">ลบรูปที่เก็บไว้</button>` : ''}<button class="text-button" type="button" id="avatar-use-initial">ใช้ตัวอักษร</button></div>
      <div id="pixel-editor-wrap" class="pixel-editor-wrap">${Character.editorMarkup(workingSpec)}<div class="character-editor-actions"><button class="secondary" type="button" id="pixel-random">🎲 สุ่มตัวละคร</button><button class="secondary" type="button" id="pixel-reset">คืนค่าที่บันทึก</button><button class="secondary" type="button" id="pixel-undo">ย้อนกลับ</button><button class="primary" type="button" id="pixel-save">ใช้ตัวละครนี้</button></div></div>
      <p class="form-help" id="avatar-status">Pixel Character เป็นตัวตนในโลก GERARAI ส่วนรูปจริงยังเก็บแยกกันและสลับกลับมาใช้ได้</p>
    </section>
    <form id="profile-form" novalidate><label class="form-field">ชื่อในโลก GERARAI<input name="name" required maxlength="40" value="${esc(pr.display_name || '')}" placeholder="เช่น Amber"></label><label class="form-field">Traveler ID (@username)<input name="handle" maxlength="30" placeholder="เช่น akanid_84" value="${esc(pr.handle || '')}" autocapitalize="off" autocomplete="username" spellcheck="false"></label><p class="form-help">ชื่อเล่นซ้ำกันได้ แต่ Traveler ID ต้องไม่ซ้ำ · ใช้ a–z 0–9 และ _ ยาว 3–20 ตัว (@ID ที่ตั้งไว้ก่อนหน้านี้ใช้ต่อได้)</p><label class="form-field">เรื่องราวสั้น ๆ ของตัวละคร<textarea name="bio" maxlength="220">${esc(pr.bio || '')}</textarea></label><p class="form-error" role="alert" hidden></p><div class="form-submit"><button class="primary" type="submit">บันทึกชื่อและโปรไฟล์</button></div></form>`);
    const form = document.getElementById('profile-form');
    const showError = msg => { const el = form.querySelector('.form-error'); el.textContent = msg; el.hidden = !msg; };
    const status = document.getElementById('avatar-status');
    const refreshAvatarUI = () => { document.getElementById('avatar-preview').innerHTML = Remote.profile?.avatar_type === 'pixel' ? Character.scene(Remote.profile.pixel_avatar_data) : myAvatar(); renderNav(); if (route === 'profile') renderProfile(); };
    const editorWrap = document.getElementById('pixel-editor-wrap');
    const savedSpec = Character.normalizeSpec(workingSpec), history = [];
    const previewSpec = spec => { workingSpec = Character.normalizeSpec(spec); document.getElementById('avatar-preview').innerHTML = Character.scene(workingSpec, 'ตัวอย่าง Gerdey และเพื่อนร่วมทาง'); };
    const rebuildEditor = () => { const active = editorWrap.querySelector('[data-gerdey-tab][aria-pressed=true]')?.dataset.gerdeyTab || '0'; const actions = editorWrap.querySelector('.character-editor-actions'); editorWrap.innerHTML = Character.editorMarkup(workingSpec); editorWrap.append(actions); bindEditor(); editorWrap.querySelector(`[data-gerdey-tab="${active}"]`)?.click(); previewSpec(workingSpec); };
    const bindEditor = () => { Character.syncEditor(editorWrap); editorWrap.querySelector('.character-editor')?.addEventListener('change', () => { history.push(workingSpec); Character.syncEditor(editorWrap); previewSpec(Character.specFromForm(editorWrap)); }); };
    bindEditor();
    document.getElementById('avatar-mode-pixel').addEventListener('click', () => previewSpec(workingSpec));
    document.getElementById('pixel-random').addEventListener('click', () => { history.push(workingSpec); workingSpec = Character.randomSpec(workingSpec); rebuildEditor(); });
    document.getElementById('pixel-reset').addEventListener('click', () => { history.push(workingSpec); workingSpec = savedSpec; rebuildEditor(); });
    document.getElementById('pixel-undo').addEventListener('click', () => { if (history.length) { workingSpec = history.pop(); rebuildEditor(); } });
    document.getElementById('pixel-save').addEventListener('click', async e => {
      const btn = e.currentTarget; busy(btn, true, 'กำลังบันทึก…'); showError('');
      try { workingSpec = Character.specFromForm(editorWrap); await Remote.setPixelAvatar(workingSpec); editProfile(); refreshAvatarUI(); toast('ใช้ Pixel Character แล้ว'); }
      catch (err) { busy(btn, false); showError(Remote.errorText(err)); }
    });
    document.getElementById('avatar-use-photo')?.addEventListener('click', async e => {
      const btn=e.currentTarget; busy(btn,true,'…'); try { await Remote.usePhotoAvatar(); editProfile(); refreshAvatarUI(); toast('กลับมาใช้รูปโปรไฟล์แล้ว'); } catch(err){ busy(btn,false); showError(Remote.errorText(err)); }
    });
    document.getElementById('avatar-remove')?.addEventListener('click', async e => {
      const btn=e.currentTarget; busy(btn,true,'กำลังลบ…'); try { await Remote.removeAvatar(); editProfile(); refreshAvatarUI(); toast('ลบรูปโปรไฟล์ที่เก็บไว้แล้ว'); } catch(err){ busy(btn,false); showError(Remote.errorText(err)); }
    });
    document.getElementById('avatar-use-initial').addEventListener('click', async e => {
      const btn=e.currentTarget; busy(btn,true,'…'); try { await Remote.useInitialAvatar(); editProfile(); refreshAvatarUI(); toast('ใช้ตัวอักษรเป็นอวตารแล้ว'); } catch(err){ busy(btn,false); showError(Remote.errorText(err)); }
    });
    document.getElementById('avatar-input').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      status.textContent = 'กำลังเตรียมภาพ…'; showError('');
      try {
        const prepared = await Avatar.prepare(file);
        document.getElementById('avatar-preview').innerHTML = `<img src="${prepared.previewUrl}" alt="">`;
        status.textContent = `กำลังอัปโหลด (${Math.round(prepared.bytes / 1024)} KB)…`;
        await Remote.uploadAvatar(prepared);
        URL.revokeObjectURL(prepared.previewUrl);
        editProfile(); refreshAvatarUI(); toast('อัปเดตรูปโปรไฟล์แล้ว');
      } catch (err) {
        console.error('[GERARAI] avatar upload:', err?.code, err?.message);
        e.target.value = ''; document.getElementById('avatar-preview').innerHTML = myAvatar();
        status.textContent = ''; showError(Avatar.errorText(err) || Remote.errorText(err));
      }
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const d = new FormData(form), name = String(d.get('name')).trim(), handle = String(d.get('handle')).trim().toLowerCase(), bio = String(d.get('bio')).trim();
      if (!name) { showError('ใส่ชื่อในโลก GERARAI'); return; }
      const oldHandle = Remote.profile?.handle || '';
      if (!handle && oldHandle) { showError('ต้องมี @ID เสมอ ลบไม่ได้ แต่เปลี่ยนเป็นชื่ออื่นได้'); return; }
      if (handle && handle !== oldHandle && !HANDLE_NEW_RE.test(handle)) { showError('@ID ใช้ได้เฉพาะ a–z 0–9 และ _ ยาว 3–20 ตัว ไม่มีเว้นวรรค'); return; }
      showError('');
      const btn = form.querySelector('[type=submit]'); busy(btn, true, 'กำลังบันทึก…');
      try { await Remote.updateProfile({ display_name: name, bio, handle }); closeDialog(); render(); toast('บันทึกตัวละครแล้ว'); }
      catch (err) { busy(btn, false); showError(err?.code === '23505' ? 'Traveler ID นี้มีคนใช้แล้ว ลองชื่ออื่น' : Remote.errorText(err)); }
    });
  };

  renderProfile = function () {
    if (!Remote.user) {
      main.innerHTML = `<div class="profile-wrap"><div class="profile-cover"><span class="cover-caption">EXPLORE<br>MORE.<br>REAL LIFE.</span></div><section class="profile-card signin-card"><h1 class="profile-name">เริ่มเก็บเรื่องราวของคุณ</h1><p class="profile-bio">เข้าสู่ระบบด้วยอีเมลเพื่อแชร์เรื่องราว บันทึกสถานที่ที่ชอบ และติดตามนักเดินทางคนอื่น ไม่ต้องตั้งรหัสผ่าน</p><button class="primary" data-action="signin">${icon('user')}เข้าสู่ระบบ / สมัครสมาชิก</button><p class="legal-links"><a href="#privacy">นโยบายความเป็นส่วนตัว</a> · <a href="#terms">ข้อกำหนดการใช้งาน</a></p></section></div>`;
      return;
    }
    const pr = Remote.profile || { display_name: '', bio: '' };
    const mine = Remote.data.posts.filter(p => p.own);
    const savedPlaces = places.filter(p => isOn('savedPlaces', p.id));
    const joined = pr.created_at ? new Date(pr.created_at).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }) : '';
    const tabs = [['posts', 'โพสต์'], ['album', 'อัลบั้ม'], ['places', 'สถานที่'], ['saved', 'บันทึก']];
    if (!tabs.some(t => t[0] === profileTab)) profileTab = 'posts';
    const content = profileTab === 'posts'
      ? `<div class="saved-layout">${mine.map(postMarkup).join('') || empty('ยังไม่มีเรื่องราว', 'แชร์ความทรงจำแรกของคุณได้เลย', `<button class="primary" data-action="compose">แชร์เรื่องราว</button>`)}</div>`
      : profileTab === 'album'
        ? (mine.some(p => p.image) ? `<div class="photo-grid">${mine.filter(p => p.image).map(p => `<button class="photo-tile" data-action="open-post" data-id="${esc(p.id)}"><img src="${esc(p.image)}" alt="${esc(window.GerarAICheckinRead.heading(p))}" loading="lazy"><span>${esc(window.GerarAICheckinRead.heading(p))}</span></button>`).join('')}</div>` : empty('ยังไม่มีภาพ', 'ภาพจากเรื่องราวของคุณจะมาอยู่ตรงนี้'))
        : profileTab === 'places'
          ? (savedPlaces.length ? `<div class="explore-grid">${savedPlaces.map(placeCard).join('')}</div>` : empty('ยังไม่ได้บันทึกสถานที่', 'กดไอคอนบันทึกในหน้าสถานที่ แล้วสถานที่จะมาอยู่ตรงนี้', `<button class="primary" data-nav="map">เปิดแผนที่</button>`))
          : `<div class="saved-layout">${savedMarkup()}</div>`;
    main.innerHTML = `<div class="profile-wrap">${myCoverMarkup()}<section class="profile-card"><div class="profile-topline"><div class="avatar profile-avatar">${myAvatar()}</div><div class="profile-buttons"><button class="secondary" data-action="safety" aria-label="บัญชีและความปลอดภัย">${icon('shield')}<span>บัญชีและความปลอดภัย</span></button><button class="secondary" data-action="profile-card" data-user="${esc(Remote.user.id)}">${icon('share')}My Gerdey</button><button class="secondary" data-action="edit-profile">${icon('settings')}ตัวละครของฉัน</button></div></div>
      <h1 class="profile-name">${esc(pr.display_name)}</h1><p class="profile-handle">${pr.handle ? '@' + esc(pr.handle) : 'ยังไม่ได้ตั้งชื่อผู้ใช้'}</p>
      ${pr.bio ? `<p class="profile-bio">${esc(pr.bio).replace(/\n/g, '<br>')}</p>` : `<p class="profile-bio muted">ยังไม่มีคำแนะนำตัว <button class="text-button" data-action="edit-profile">เพิ่มเลย</button></p>`}
      <div class="profile-progress">${Progression.progressCard({ avatarHtml: profileProgressAvatar(pr, myAvatar()), name: pr.display_name, state: myState(), cls: myClass(), note: Remote.progression.available ? '' : PROG_PENDING })}${Progression.badgeStrip({ catalog: Remote.progression.catalog, earned: myEarned() })}</div>
      <div class="profile-meta">${joined ? `<span>${icon('calendar')}เข้าร่วมเมื่อ ${esc(joined)}</span>` : ''}</div>
      <div class="profile-stats" id="live-stats"><div><b>–</b><small>เรื่องราว</small></div><div><b>–</b><small>ผู้ติดตาม</small></div><div><b>–</b><small>กำลังติดตาม</small></div><div><b>${savedPlaces.length}</b><small>สถานที่ที่บันทึก</small></div></div></section>
      <div data-journey-profile="${esc(Remote.user.id)}"></div>
      <div class="profile-tabs" role="tablist" aria-label="เนื้อหาโปรไฟล์">${tabs.map(([key, name]) => `<button class="tab ${profileTab === key ? 'active' : ''}" role="tab" aria-selected="${profileTab === key}" data-profile-tab="${key}">${name}</button>`).join('')}</div><div id="profile-content">${content}</div></div>`;
    Remote.stats().then(s => {
      const el = document.getElementById('live-stats');
      if (!el) return;
      const b = el.querySelectorAll('b');
      b[0].textContent = s.posts; b[1].textContent = s.followers; b[2].textContent = s.following;
    }).catch(() => {});
  };

  /* ---------- profile cover (v0.6.5) ---------- */
  const Cover = window.GerarAICover;
  function myCoverMarkup() {
    const url = Remote.coverUrl(Remote.profile?.cover_path);
    return `<div class="profile-cover ${url ? 'has-custom' : ''}" ${url ? `style="background-image:url('${esc(url)}')"` : ''}>${url ? '' : window.GerarAICoverMotion.markup(Remote.profile)}<button class="cover-edit" data-action="cover-menu" aria-label="เปลี่ยนภาพหน้าปก">${icon('camera')}<span>เปลี่ยนภาพหน้าปก</span></button></div>`;
  }
  function coverError(err) { return Cover.errorText(err) || Remote.errorText(err); }
  function coverMenu() {
    const has = !!Remote.profile?.cover_path;
    openDialog('ภาพหน้าปก', `<div class="cover-menu">
      <label class="secondary cover-pick">${icon('camera')}<span>${has ? 'อัปโหลดภาพใหม่' : 'อัปโหลดภาพหน้าปก'}</span><input id="cover-input" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
      ${has ? `<button class="secondary" type="button" id="cover-reposition">ปรับตำแหน่งภาพปัจจุบัน</button><button class="text-button danger" type="button" id="cover-remove">ลบภาพหน้าปก · กลับค่าเริ่มต้น</button>` : ''}
      </div><p class="form-help">JPG, PNG หรือ WebP ไม่เกิน 15 MB · ระบบครอปเป็น 3:1 ย่อเป็น 1500×500 และลบข้อมูล EXIF/ตำแหน่ง GPS ก่อนอัปโหลด · ภาพหน้าปกเปิดดูได้สาธารณะ</p><p class="form-error" role="alert" hidden></p>`);
    const showError = msg => { const el = dialogContent.querySelector('.form-error'); el.textContent = msg; el.hidden = !msg; };
    if (!Remote.coverAvailable()) showError(Remote.errorText({ code: 'cover_migration', message: 'ฐานข้อมูลยังไม่มีระบบภาพหน้าปก — รัน migration 20260930120000_profile_covers.sql ก่อน' }));
    document.getElementById('cover-input').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      showError('');
      try { const img = await Cover.load(file); cropDialog(img); }
      catch (err) { e.target.value = ''; showError(coverError(err)); }
    });
    document.getElementById('cover-reposition')?.addEventListener('click', async ev => {
      const btn = ev.currentTarget; busy(btn, true, 'กำลังโหลด…'); showError('');
      try {
        const res = await fetch(Remote.coverUrl(Remote.profile.cover_path));
        if (!res.ok) throw Object.assign(new Error('load'), { code: 'cover_decode' });
        const blob = await res.blob();
        cropDialog(await Cover.load(new File([blob], 'cover.jpg', { type: 'image/jpeg' })));
      } catch (err) { busy(btn, false); showError(coverError(err)); }
    });
    document.getElementById('cover-remove')?.addEventListener('click', async ev => {
      const btn = ev.currentTarget;
      if (!btn.dataset.confirm) { btn.dataset.confirm = '1'; btn.textContent = 'ยืนยันลบภาพหน้าปก'; return; }
      busy(btn, true, 'กำลังลบ…');
      try { await Remote.removeCover(); closeDialog(); if (route === 'profile') renderProfile(); toast('ลบภาพหน้าปกแล้ว ใช้ภาพเริ่มต้น'); }
      catch (err) { busy(btn, false); showError(coverError(err)); }
    });
  }
  function cropDialog(img) {
    openDialog('ปรับตำแหน่งภาพหน้าปก', `<div class="cover-crop">
      <div class="cover-crop-frame"><canvas id="cover-crop-canvas" tabindex="0" aria-label="ตัวอย่างภาพหน้าปก ลากหรือใช้ปุ่มลูกศรเพื่อเลื่อน, + และ − เพื่อซูม"></canvas><span class="cover-mobile-guide" style="width:${Math.round(Cover.MOBILE_RATIO / 3 * 100)}%" aria-hidden="true"><i>ส่วนที่เห็นบนมือถือ</i></span></div>
      <div class="cover-crop-tools"><label>ซูม <input type="range" id="cover-zoom" min="1" max="3" step="0.01" value="1" aria-label="ซูมภาพหน้าปก"></label><button class="text-button" type="button" id="cover-reset">จัดกึ่งกลาง</button></div>
      <p class="form-help">ลากภาพเพื่อเลือกตำแหน่ง · ภาพที่บันทึกคือส่วนในกรอบ (3:1, 1500×500 px) · ต้นฉบับ ${img.original.width}×${img.original.height} px</p>
      ${img.lowRes ? '<p class="form-help cover-lowres">⚠ ภาพต้นฉบับกว้างไม่ถึง 1200 px ภาพอาจไม่คมชัด</p>' : ''}
      <p class="form-error" role="alert" hidden></p>
      <div class="form-submit"><button class="secondary" type="button" id="cover-cancel">ยกเลิก</button><button class="primary" type="button" id="cover-save">บันทึกภาพหน้าปก</button></div></div>`);
    const zoom = document.getElementById('cover-zoom');
    const cropper = Cover.createCropper(document.getElementById('cover-crop-canvas'), img, st => { if (Number(zoom.value) !== st.zoom) zoom.value = st.zoom; });
    window.__coverCropper = cropper;   // test hook (read-only use in tools/check-cover.cjs)
    const showError = msg => { const el = dialogContent.querySelector('.form-error'); el.textContent = msg; el.hidden = !msg; };
    zoom.addEventListener('input', () => cropper.setZoom(zoom.value));
    document.getElementById('cover-reset').addEventListener('click', () => { cropper.reset(); zoom.value = 1; });
    document.getElementById('cover-cancel').addEventListener('click', () => { cropper.destroy(); coverMenu(); });
    document.getElementById('cover-save').addEventListener('click', async ev => {
      const btn = ev.currentTarget; busy(btn, true, 'กำลังเตรียมภาพ…'); showError('');
      try {
        const out = await cropper.exportBlob();
        btn.textContent = `กำลังอัปโหลด (${Math.round(out.bytes / 1024)} KB)…`;
        await Remote.uploadCover(out);
        cropper.destroy(); closeDialog(); if (route === 'profile') renderProfile(); toast('อัปเดตภาพหน้าปกแล้ว');
      } catch (err) { console.error('[GERARAI] cover upload:', err?.code, err?.message); busy(btn, false); showError(coverError(err)); }
    });
  }

  /* ---------- public profile (v0.6.6) — read-only view of another member, route #u/<user_id> ---------- */
  // Identity is the user_id (stable); @username is display only and may change.
  const publicCache = new Map();
  let publicTab = 'posts', publicLoadSeq = 0;
  const isBlockedByMe = id => Remote.data.blocked.some(b => b.id === id);
  const profileLink = id => location.origin + location.pathname + '#u/' + id;
  function adjustFollowers(userId, on) {
    const c = publicCache.get(userId);
    if (c?.stats) c.stats.followers = Math.max(0, c.stats.followers + (on ? 1 : -1));
  }
  async function followUser(userId, name, btn) {
    if (!Remote.user) { signInDialog('เข้าสู่ระบบเพื่อติดตาม'); return; }
    const list = Remote.data.following, on = !list.includes(userId);
    busy(btn, true, '…');
    try {
      await Remote.follow(userId, on);
      if (on) list.push(userId); else list.splice(list.indexOf(userId), 1);
      adjustFollowers(userId, on);
      render(); toast(on ? `ติดตาม ${name} แล้ว` : `เลิกติดตาม ${name} แล้ว`);
    } catch (err) { busy(btn, false); fail(err); }
  }
  function publicProfileMarkup(id, data) {
    const pr = data.profile, name = pr.display_name || 'สมาชิก GERARAI';
    const coverUrl = pr.cover_path ? Remote.coverUrl(pr.cover_path) : '';
    const blocked = isBlockedByMe(id), following = Remote.data.following.includes(id);
    const st = data.progression?.state || { total_xp: 0, level: 1, title_key: 'novice', primary_class_code: 'wanderer' };
    const earned = new Set(data.progression?.badges || []);
    const cls = Character.classByCode(st.primary_class_code || 'wanderer');
    const joined = pr.created_at ? new Date(pr.created_at).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }) : '';
    const posts = blocked ? [] : data.posts;
    const stats = data.stats;
    const content = blocked
      ? empty('คุณบล็อกผู้ใช้นี้อยู่', 'เรื่องราวของผู้ใช้นี้ถูกซ่อนจากคุณ ปลดบล็อกได้จากเมนู ⋯')
      : publicTab === 'album'
        ? (posts.some(p => p.image) ? `<div class="photo-grid">${posts.filter(p => p.image).map(p => `<button class="photo-tile" data-action="open-post" data-id="${esc(p.id)}"><img src="${esc(p.image)}" alt="${esc(window.GerarAICheckinRead.heading(p))}" loading="lazy"><span>${esc(window.GerarAICheckinRead.heading(p))}</span></button>`).join('')}</div>` : empty('ยังไม่มีภาพ', 'ภาพจากเรื่องราวสาธารณะของสมาชิกคนนี้จะมาอยู่ตรงนี้'))
        : `<div class="saved-layout">${posts.map(postMarkup).join('') || empty('ยังไม่มีเรื่องราวสาธารณะ', `${esc(name)} ยังไม่ได้แชร์เรื่องราว`)}</div>`;
    return `<div class="profile-wrap public-profile" data-profile-id="${esc(id)}">
      <div class="profile-cover ${coverUrl ? 'has-custom' : ''}" ${coverUrl ? `style="background-image:url('${esc(coverUrl)}')"` : ''}>${coverUrl ? '' : window.GerarAICoverMotion.markup(pr)}<button class="cover-more" data-action="profile-more" data-user="${esc(id)}" aria-label="ตัวเลือกเพิ่มเติมของโปรไฟล์" title="ตัวเลือกเพิ่มเติม">⋯</button></div>
      <section class="profile-card"><div class="profile-topline"><div class="avatar profile-avatar">${Avatar.inner({ name, photoUrl: Remote.avatarUrl(pr.avatar_path), avatarType: pr.avatar_type || (pr.avatar_path ? 'photo' : 'initial'), pixelSpec: pr.pixel_avatar_data || null })}</div>
        <div class="profile-buttons">${!blocked ? `<button class="secondary" data-action="profile-card" data-user="${esc(id)}">${icon('share')}Gerdey</button>` : ''}${blocked ? '<span class="blocked-chip">บล็อกอยู่</span>' : `<button class="${following ? 'secondary' : 'primary'}" data-action="follow-user" data-user="${esc(id)}" data-name="${esc(name)}">${following ? 'กำลังติดตาม' : 'ติดตาม'}</button>`}</div></div>
      <h1 class="profile-name">${esc(name)}</h1><p class="profile-handle">${pr.handle ? '@' + esc(pr.handle) : 'สมาชิก GERARAI'}</p>
      ${pr.bio ? `<p class="profile-bio">${esc(pr.bio).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="profile-progress">${Progression.progressCard({ readonly: true, avatarHtml: profileProgressAvatar(pr, Avatar.inner({ name, photoUrl: Remote.avatarUrl(pr.avatar_path), avatarType: pr.avatar_type || (pr.avatar_path ? 'photo' : 'initial'), pixelSpec: pr.pixel_avatar_data || null })), name, state: st, cls, note: data.progression ? '' : 'ยังไม่มีข้อมูลเลเวลของสมาชิกคนนี้' })}${Progression.badgeStrip({ catalog: Remote.progression.catalog, earned, action: 'badge-public', label: 'เหรียญที่ได้รับ' })}</div>
      <div class="profile-meta">${joined ? `<span>${icon('calendar')}เข้าร่วมเมื่อ ${esc(joined)}</span>` : ''}</div>
      ${stats ? `<div class="profile-stats"><div><b>${stats.posts}</b><small>เรื่องราว</small></div><div><b>${stats.followers}</b><small>ผู้ติดตาม</small></div><div><b>${stats.following}</b><small>กำลังติดตาม</small></div></div>` : ''}
      </section>
      <div data-journey-profile="${esc(id)}"></div>
      <div class="profile-tabs" role="tablist" aria-label="เนื้อหาโปรไฟล์">${[['posts', 'เรื่องราว'], ['album', 'อัลบั้ม']].map(([k, t]) => `<button class="tab ${publicTab === k ? 'active' : ''}" role="tab" aria-selected="${publicTab === k}" data-public-tab="${k}">${t}</button>`).join('')}</div><div id="profile-content">${content}</div></div>`;
  }
  function renderPublicProfile(id) {
    if (!Remote.isId(id)) { main.innerHTML = empty('ไม่พบโปรไฟล์', 'ลิงก์โปรไฟล์นี้ไม่ถูกต้อง'); return; }
    if (Remote.user && id === Remote.user.id) { history.replaceState(null, '', '#profile'); route = 'profile'; renderProfile(); return; }
    const cached = publicCache.get(id);
    if (cached) main.innerHTML = publicProfileMarkup(id, cached);
    else main.innerHTML = `<div class="profile-wrap"><div class="profile-cover"></div><section class="profile-card"><p class="form-help" style="padding-top:24px">กำลังโหลดโปรไฟล์…</p></section></div>`;
    const seq = ++publicLoadSeq, identityEpoch = Remote.epoch;
    Remote.publicProfile(id).then(data => {
      if (seq !== publicLoadSeq || identityEpoch !== Remote.epoch || route !== 'u/' + id) return;
      if (!data) { publicCache.delete(id); main.innerHTML = empty('ไม่พบโปรไฟล์', 'สมาชิกคนนี้อาจลบบัญชีแล้ว'); return; }
      publicCache.set(id, data); main.innerHTML = publicProfileMarkup(id, data); decorateIcons(main);
    }).catch(err => { if (seq === publicLoadSeq && !cached) main.innerHTML = empty('โหลดโปรไฟล์ไม่สำเร็จ', esc(Remote.errorText(err))); });
  }
  const baseRender = render;
  render = function () {
    if (Gate.open && !Remote.user) { clearMemberState(); Gate.enter(); return; }
    setTimeout(maybeAskHandle, 0);
    if (route.startsWith('u/')) {
      if (map) { map.remove(); map = null; }
      renderNav(); renderPublicProfile(route.slice(2)); decorateIcons(main); return;
    }
    baseRender();
  };
  function profileMoreMenu(id) {
    const data = publicCache.get(id); if (!data) return;
    const pr = data.profile, who = pr.handle ? '@' + pr.handle : pr.display_name;
    openDialog('ตัวเลือกโปรไฟล์', `<button class="side-link" data-action="profile-share" data-user="${esc(id)}">${icon('share')}แชร์โปรไฟล์ / คัดลอกลิงก์</button><button class="side-link" data-action="profile-report" data-user="${esc(id)}">${icon('flag')}รายงานโปรไฟล์</button>${isBlockedByMe(id) ? `<button class="side-link" data-action="profile-unblock" data-user="${esc(id)}">${icon('block')}ปลดบล็อก ${esc(who)}</button>` : `<button class="side-link danger" data-action="profile-block" data-user="${esc(id)}">${icon('block')}บล็อก ${esc(who)}</button>`}`);
  }
  function profileBlockConfirm(id) {
    const pr = publicCache.get(id)?.profile; if (!pr) return;
    const who = pr.handle ? '@' + pr.handle : pr.display_name;
    openDialog(`บล็อก ${who}?`, `<p class="form-help">คุณและผู้ใช้นี้จะไม่เห็นหรือโต้ตอบกับเนื้อหาของกันและกันตามกฎของ GERARAI</p><div class="form-submit"><button class="secondary" data-action="close-dialog">ยกเลิก</button><button class="primary danger-fill" data-action="profile-block-confirm" data-user="${esc(id)}">บล็อก</button></div>`);
  }
  const PROFILE_REPORT_REASONS = [['spam', 'สแปม (Spam)'], ['scam', 'หลอกลวง / ฉ้อโกง (Scam / Fraud)'], ['impersonation', 'แอบอ้างเป็นผู้อื่น (Impersonation)'], ['harassment', 'คุกคามหรือกลั่นแกล้ง (Harassment)'], ['prohibited', 'เนื้อหาต้องห้าม (Prohibited Content)'], ['other', 'อื่น ๆ (Other)']];
  function profileReportDialog(id) {
    const pr = publicCache.get(id)?.profile; if (!pr) return;
    openDialog('รายงานโปรไฟล์', `<form id="report-form" data-profile-report="${esc(id)}"><p class="form-help">บอกเราว่าโปรไฟล์ของ ${esc(pr.display_name)} มีปัญหาอะไร รายงานจะส่งถึงทีมดูแล ผู้ถูกรายงานจะไม่รู้ว่าใครรายงาน</p><fieldset class="reason-list"><legend class="sr-only">เหตุผล</legend>${PROFILE_REPORT_REASONS.map(([v, t], i) => `<label class="reason"><input type="radio" name="reason" value="${v}" ${i === 0 ? 'required' : ''}><span>${t}</span></label>`).join('')}</fieldset><label class="form-field">รายละเอียดเพิ่มเติม (ไม่บังคับ)<textarea name="note" maxlength="500"></textarea></label><p class="form-error" role="alert" hidden></p><div class="form-submit"><button class="secondary" type="button" data-action="close-dialog">ยกเลิก</button><button class="primary" type="submit">ส่งรายงาน</button></div></form>`);
    const form = document.getElementById('report-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const d = new FormData(form), showError = m => { const el = form.querySelector('.form-error'); el.textContent = m; el.hidden = !m; };
      if (!d.get('reason')) { showError('เลือกเหตุผลก่อนส่งรายงาน'); return; }
      const btn = form.querySelector('[type=submit]'); busy(btn, true, 'กำลังส่ง…');
      try { await Remote.reportProfile(id, String(d.get('reason')), String(d.get('note') || '').trim()); closeDialog(); toast('ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน'); }
      catch (err) { busy(btn, false); showError(err?.code === '23514' ? 'ฐานข้อมูลยังไม่รองรับเหตุผลนี้ — รัน migration 20260930150000_profile_report_reasons.sql ก่อน' : Remote.errorText(err)); }
    });
  }
  async function copyProfileLink(id) {
    const url = profileLink(id);
    try { await navigator.clipboard.writeText(url); closeDialog(); toast('คัดลอกลิงก์โปรไฟล์แล้ว'); }
    catch { openDialog('แชร์โปรไฟล์', `<p class="form-help">คัดลอกลิงก์นี้</p><input class="share-link" readonly value="${esc(url)}" onclick="this.select()">`); }
  }

  /* ---------- local posts from before sign-in ---------- */
  let migrationAsked = false;
  function maybeOfferMigration() {
    const local = state.posts.filter(p => String(p.id).startsWith('local-'));
    if (!Remote.user || !local.length || migrationAsked || dialog.open) return;
    migrationAsked = true;
    openDialog('พบเรื่องราวบนเครื่องนี้', `<p class="form-help">คุณมีเรื่องราว ${local.length} เรื่องที่สร้างไว้ในเบราว์เซอร์นี้ก่อนมีระบบสมาชิก เรื่องราวเหล่านี้ยังไม่มีใครเห็น</p><ul class="migrate-list">${local.slice(0, 5).map(p => `<li>${esc(p.title)}</li>`).join('')}${local.length > 5 ? `<li>และอีก ${local.length - 5} เรื่อง</li>` : ''}</ul><div class="form-submit"><button class="secondary" data-action="migrate-later">ไว้ทีหลัง</button><button class="primary" data-action="migrate-now">เผยแพร่ในบัญชีของฉัน</button></div><button class="text-button danger" data-action="migrate-discard">ลบออกจากเครื่องนี้</button>`);
  }
  function imageInfo(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject; img.src = dataUrl;
    });
  }
  async function migrate(btn) {
    busy(btn, true, 'กำลังเผยแพร่…');
    const local = state.posts.filter(p => String(p.id).startsWith('local-')).reverse();
    let done = 0, failed = 0;
    for (const p of local) {
      try {
        let image = null;
        if (p.image) { try { image = await imageInfo(p.image); } catch { image = null; } }
        await Remote.createPost({ title: p.title, body: p.body, placeSlug: p.place, tags: extractTags(p.body), image });
        state.posts = state.posts.filter(x => x.id !== p.id); persist(); done++;
      } catch (err) { console.error(err); failed++; }
    }
    closeDialog(); render();
    toast(failed ? `เผยแพร่ ${done} เรื่อง ไม่สำเร็จ ${failed} เรื่อง (ยังอยู่บนเครื่องนี้)` : `เผยแพร่ ${done} เรื่องราวแล้ว`);
  }

  /* ---------- click interception (capture phase, runs before app.js handler) ---------- */
  const GATED = { compose: 'เข้าสู่ระบบเพื่อแชร์เรื่องราวของคุณ', like: 'เข้าสู่ระบบเพื่อกดถูกใจ', comments: 'เข้าสู่ระบบเพื่ออ่านและแสดงความคิดเห็น', save: 'เข้าสู่ระบบเพื่อบันทึกเรื่องราว', 'save-place': 'เข้าสู่ระบบเพื่อบันทึกสถานที่', follow: 'เข้าสู่ระบบเพื่อติดตาม', report: 'เข้าสู่ระบบเพื่อรายงาน', block: 'เข้าสู่ระบบเพื่อบล็อก', 'emergency-report': 'เข้าสู่ระบบเพื่อรายงานสถานการณ์', 'profile-report': 'เข้าสู่ระบบเพื่อรายงาน', 'profile-block': 'เข้าสู่ระบบเพื่อบล็อก', 'profile-unblock': '', 'edit-profile': '', safety: '' };
  const SAMPLE_BLOCKED = new Set(['like', 'save', 'report', 'block', 'follow']);
  document.addEventListener('click', e => {
    const b = e.target.closest('button,[data-nav]');
    if (!b) return;
    const a = b.dataset.action, id = b.dataset.id;
    if (a === 'signin') { stop(e); signInDialog(); return; }
    if (a === 'signout') { stop(e); signOut(); return; }
    if (b.dataset.person) { const p = findPost(b.dataset.person); if (p?.remote && !p.own) { stop(e); personDialog(p); drawPersonProgress(p); } return; }
    if (b.classList.contains('avatar-header') && !Remote.user) { stop(e); signInDialog(); return; }
    if (a === 'class-paths') { stop(e); classPathsDialog(); return; }
    if (b.dataset.publicTab) { stop(e); publicTab = b.dataset.publicTab; render(); return; }
    if (a === 'badge-public') {
      stop(e); const id = route.slice(2), data = publicCache.get(id);
      const badge = Progression.catalog(Remote.progression.catalog).find(x => x.code === b.dataset.badge);
      if (badge && data) openDialog('เหรียญแห่งการเดินทาง', Progression.badgeDetail({ badge, earned: (data.progression?.badges || []).includes(badge.code), own: false, progress: null }));
      return;
    }
    if (a === 'profile-more') { stop(e); profileMoreMenu(b.dataset.user); return; }
    if (a === 'profile-card') { stop(e); window.GerarAIShareCard.open(b.dataset.user); return; }
    if (a === 'profile-share') { stop(e); copyProfileLink(b.dataset.user); return; }
    if (a === 'follow-user') { stop(e); followUser(b.dataset.user, b.dataset.name, b); return; }
    if (a === 'badge-detail') { stop(e); badgeDialog(b.dataset.badge); return; }
    if (a === 'badges') { stop(e); if (Remote.user) navigate('profile'); else signInDialog('เข้าสู่ระบบเพื่อเริ่มเก็บเหรียญ'); return; }
    if (a === 'set-primary-class') { stop(e); if (Remote.user) setPrimaryClass(b.dataset.class, b); return; }
    if (!a) return;
    // 1) สถานะการเข้าสู่ระบบมาก่อนเสมอ ไม่ขึ้นกับว่าเป็นเนื้อหาตัวอย่างหรือจริง
    if (a in GATED && !Remote.user) { stop(e); if (dialog.open) closeDialog(); signInDialog(GATED[a]); return; }
    // 2) เข้าสู่ระบบแล้ว: เนื้อหาตัวอย่างเป็นแบบอ่านอย่างเดียว
    if (SAMPLE_BLOCKED.has(a) && id && !Remote.isId(id) && findPost(id)) { stop(e); toast(SAMPLE_MSG); return; }
    switch (a) {
      case 'like': stop(e); toggleKind('liked', id); break;
      case 'save': stop(e); toggleKind('saved', id); break;
      case 'save-place': stop(e); toggleKind('savedPlaces', id); break;
      case 'follow': { stop(e); const p = findPost(id); if (p) follow(p, b); break; }
      case 'confirm-delete': stop(e); deletePost(id, b); break;
      case 'confirm-block': { stop(e); const p = findPost(id); if (p) block(p, b); break; }
      case 'unblock': stop(e); unblock(b.dataset.name); break;
      case 'delete-comment': stop(e); Remote.deleteComment(id, b.dataset.comment).then(() => { comments.redraw?.(); refreshPost(id); }).catch(fail); break;
      case 'cover-menu': stop(e); if (Remote.user) coverMenu(); break;
      case 'profile-report': stop(e); profileReportDialog(b.dataset.user); break;
      case 'profile-block': stop(e); profileBlockConfirm(b.dataset.user); break;
      case 'profile-block-confirm': { stop(e); const uid = b.dataset.user, pr = publicCache.get(uid)?.profile; busy(b, true, 'กำลังบล็อก…');
        Remote.block(uid, pr?.display_name || '').then(() => { publicCache.delete(uid); closeDialog(); render(); toast(`บล็อก ${pr?.display_name || ''} แล้ว`); }).catch(err => { busy(b, false); fail(err); }); break; }
      case 'profile-unblock': { stop(e); const uid = b.dataset.user; Remote.unblock(uid).then(() => { publicCache.delete(uid); closeDialog(); render(); toast('ปลดบล็อกแล้ว'); }).catch(fail); break; }
      case 'migrate-now': stop(e); migrate(b); break;
      case 'migrate-later': stop(e); closeDialog(); break;
      case 'migrate-discard': stop(e); state.posts = state.posts.filter(p => !String(p.id).startsWith('local-')); persist(); closeDialog(); toast('ลบเรื่องราวบนเครื่องนี้แล้ว'); break;
      case 'about': stop(e); openDialog('GERARAI · v0.7.0-dev', `<p style="font-size:.9rem;line-height:1.9">ระบบสมาชิกเปิดใช้แล้ว เรื่องราว ความคิดเห็น การถูกใจ และการบันทึกของสมาชิกเก็บบนเซิร์ฟเวอร์และคนอื่นเห็นได้<br><br>เรื่องราวที่มีป้าย “ตัวอย่าง” รวมถึงสถานที่ รีวิว และพิกัดที่ติดป้ายข้อมูลตัวอย่าง ใช้เพื่อสาธิตเท่านั้น ภาพประกอบตัวอย่างสร้างด้วย AI</p><p class="legal-links"><a href="#privacy">ประกาศความเป็นส่วนตัว</a> · <a href="#terms">ข้อกำหนดการใช้บริการ</a> · <a href="#community">มาตรฐานชุมชน</a> · <a href="#contact">ติดต่อ</a></p>`); break;
    }
  }, true);

  /* ---------- Social Access v0.1: @ID (handle), @ID lookup, Following feed ---------- */
  // Server side: supabase/migrations/20261009090000_social_access.sql. Both RPCs are EXECUTE for authenticated only; they are
  // called with the member's own access token (same token the session uses), never anonymously.
  const HANDLE_NEW_RE = /^[a-z0-9_]{3,20}$/;
  async function memberRpc(name, args) {
    let token = '';
    try { token = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null')?.access_token || ''; } catch { token = ''; }
    if (!Remote.user || !token) throw Object.assign(new Error('ต้องเข้าสู่ระบบก่อน'), { code: 'auth' });
    const cfg = window.GERARAI_CONFIG.supabase;
    const res = await fetch(cfg.url + '/rest/v1/rpc/' + name, { method: 'POST', cache: 'no-store',
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(args || {}) });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(body?.message || 'HTTP ' + res.status), { code: body?.code || String(res.status), status: res.status });
    return body;
  }

  // Following feed: the server lists ids (following_feed); each Story is read through the normal RLS read path (fetchPost).
  const FF = { ids: [], cache: new Map(), next: null, following: null, loaded: false, loading: false, error: null, seq: 0, at: 0 };
  function resetFeed() { Object.assign(FF, { ids: [], next: null, following: null, loaded: false, loading: false, error: null, at: 0 }); FF.cache.clear(); FF.seq++; }
  const feedPost = id => Remote.data.posts.find(p => p.id === id) || FF.cache.get(id);
  const feedList = () => FF.ids.map(feedPost).filter(p => p && !state.reported.some(r => r.id === p.id));
  // Feed Stories stay reachable for like / save / comment even when the general post list is refreshed
  const basePostSource = postSource;
  postSource = () => { const base = basePostSource(), have = new Set(base.map(p => p.id)); return [...base, ...[...FF.cache.values()].filter(p => !have.has(p.id))]; };
  function feedMarkup() {
    if (FF.error) return empty('โหลดฟีดไม่สำเร็จ', esc(Remote.errorText(FF.error)), '<button class="primary" data-action="feed-refresh">ลองอีกครั้ง</button>');
    if (!FF.loaded) return '<p class="empty-state" role="status">กำลังโหลดเรื่องราวจากคนที่คุณติดตาม…</p>';
    const posts = feedList(), find = '<button class="primary" data-action="handle-search">ค้นหาเพื่อนด้วย @ID</button>';
    if (!FF.following) return empty('ยังไม่ได้ติดตามใคร', 'ฟีดนี้แสดงเฉพาะเรื่องราวจากคนที่คุณติดตาม ค้นหาเพื่อนด้วย @ID แล้วกดติดตาม', find);
    if (!posts.length) return empty('ยังไม่มีเรื่องราวใหม่', 'คนที่คุณติดตามยังไม่ได้แชร์เรื่องราว ลองค้นหาเพื่อนเพิ่มด้วย @ID', find);
    return posts.map(postMarkup).join('') + (FF.next ? `<div class="feed-more"><button class="secondary" data-action="feed-more" ${FF.loading ? 'disabled' : ''}>โหลดเพิ่ม</button></div>` : '');
  }
  function drawFeed() {
    const box = route === 'feed' && Gate.open ? main.querySelector('#feed-posts') : null;
    if (!box) return;
    box.innerHTML = feedMarkup(); decorateIcons(box);
  }
  async function loadFeed(more = false) {
    if (!Remote.user || (FF.loading && more)) return;
    const seq = ++FF.seq, epoch = Remote.epoch;
    FF.loading = true; FF.error = null;
    try {
      const args = { p_limit: 20 };
      if (more && FF.next) { args.p_before = FF.next.created_at; args.p_before_id = FF.next.id; }
      const r = await memberRpc('following_feed', args);
      const ids = (r?.rows || []).map(x => x.id).filter(Remote.isId);
      const got = await Promise.all(ids.map(id => Remote.data.posts.find(p => p.id === id) || Remote.fetchPost(id).catch(() => null)));
      if (seq !== FF.seq || epoch !== Remote.epoch) return;
      got.forEach(p => { if (p) FF.cache.set(p.id, p); });
      FF.ids = more ? [...FF.ids, ...ids.filter(id => !FF.ids.includes(id))] : ids;
      FF.next = r?.next || null; FF.following = Number(r?.following || 0); FF.loaded = true; FF.at = Date.now();
    } catch (err) { if (seq !== FF.seq) return; FF.error = err; FF.loaded = true; console.warn('[GERARAI] following_feed', err?.code, err?.message); }
    finally { if (seq === FF.seq) FF.loading = false; }
    drawFeed();
  }
  // Open Beta demo cleanup (2026-10-09): no sample story bubbles or sample "cities to visit" card in member mode; only the
  // working "Your Story" (opens the Story composer) stays.
  storiesMarkup = () => `<div class="panel stories"><button class="story" data-action="compose"><span class="story-ring mine">${icon('plus')}</span><small>Your Story</small></button></div>`;
  const demoRightRail = rightRail;
  rightRail = () => demoRightRail().replace(/<section class="panel rail-section">[\s\S]*?<\/section>/, '');
  feedPosts = () => feedList();                                 // member Feed = Following only (no sample or global Stories)
  const baseRenderFeed = renderFeed;
  renderFeed = function () {
    baseRenderFeed();
    main.querySelector('.feed-tabs')?.replaceWith(Object.assign(document.createElement('div'), { className: 'feed-tabs following-only',
      innerHTML: '<span class="tab active" aria-current="page">กำลังติดตาม</span><button class="text-button" data-action="feed-refresh">รีเฟรช</button><button class="text-button" data-action="handle-search">ค้นหา @ID</button>' }));
    main.querySelector('.search-result-note')?.remove();
    drawFeed();
    if (!FF.loading && (!FF.loaded || Date.now() - FF.at > 60000)) loadFeed();
  };
  // follow / unfollow / block: the next Feed load asks the server again; an unfollowed or blocked author disappears at once
  const baseFollow = Remote.follow;
  Remote.follow = async function (userId, on) {
    const r = await baseFollow.call(this, userId, on);
    if (!on) FF.ids = FF.ids.filter(id => feedPost(id)?.authorId !== userId);
    FF.loaded = FF.loaded && !on; FF.at = 0; FF.seq++; FF.loading = false;
    if (route === 'feed') setTimeout(drawFeed, 0);
    return r;
  };
  const baseBlock = Remote.block;
  Remote.block = async function (userId, ...rest) {
    const r = await baseBlock.call(this, userId, ...rest);
    FF.ids = FF.ids.filter(id => feedPost(id)?.authorId !== userId); FF.at = 0;
    return r;
  };

  // @ID lookup (header search starting with "@", the mobile search, or the Feed button)
  const socialRenderNav = renderNav;
  renderNav = function () { socialRenderNav(); const si = document.getElementById('search-input'); if (si && Gate.open) si.placeholder = 'ค้นหาสถานที่ เรื่องราว หรือ @ID…'; };
  const baseSearch = search;
  search = function (q) {
    const t = String(q || '').trim();
    if (t.startsWith('@')) { if (Remote.user) handleSearchDialog(t); else signInDialog(); return; }
    return baseSearch(q);
  };
  let handleSearchSeq = 0;
  function handleSearchDialog(initial = '@') {
    openDialog('ค้นหาสมาชิกด้วย @ID', `<form id="handle-search-form" class="comment-form" role="search"><input name="q" value="${esc(initial)}" maxlength="31" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="@ID ที่ต้องการค้นหา" placeholder="@traveler_id"><button class="primary" type="submit">ค้นหา</button></form>
      <p class="form-help">พิมพ์ @ID อย่างน้อย 2 ตัวอักษร ระบบแสดงเฉพาะชื่อ @ID และรูปโปรไฟล์ที่เป็นข้อมูลสาธารณะ</p><div id="handle-results" class="handle-results" aria-live="polite"></div>`);
    const form = document.getElementById('handle-search-form'), input = form.q;
    let t = null;
    const run = async () => {
      const box = document.getElementById('handle-results'); if (!box) return;
      const q = input.value.trim().toLowerCase().replace(/^@/, '');
      if (!/^[a-z0-9_.]{2,30}$/.test(q)) { box.innerHTML = q.length >= 2 ? '<p class="form-help">@ID ใช้ได้เฉพาะ a–z 0–9 และ _</p>' : ''; return; }
      const seq = ++handleSearchSeq; box.innerHTML = '<p class="form-help" role="status">กำลังค้นหา…</p>';
      try {
        const rows = await memberRpc('search_profiles_by_handle', { p_query: q, p_limit: 8 });
        if (seq !== handleSearchSeq || !document.body.contains(box)) return;
        box.innerHTML = (rows || []).length ? rows.map(r => `<button class="side-link handle-result" data-open-profile="${esc(r.id)}"><span class="avatar" aria-hidden="true">${Avatar.inner({ name: r.display_name || r.handle, photoUrl: Remote.avatarUrl(r.avatar_path), avatarType: r.avatar_type || (r.avatar_path ? 'photo' : 'initial'), pixelSpec: r.pixel_avatar_data || null })}</span><span><b>${esc(r.display_name || '')}</b><small>@${esc(r.handle)}</small></span></button>`).join('')
          : `<p class="form-help">ไม่พบ @${esc(q)}</p>`;
      } catch (err) { if (seq === handleSearchSeq && document.body.contains(box)) box.innerHTML = `<p class="form-error">${esc(Remote.errorText(err))}</p>`; }
    };
    input.addEventListener('input', () => { input.value = input.value.toLowerCase(); clearTimeout(t); t = setTimeout(run, 250); });
    form.addEventListener('submit', e => { e.preventDefault(); clearTimeout(t); run(); });
    input.focus(); input.setSelectionRange(input.value.length, input.value.length);
    if (initial.replace(/^@/, '').length >= 2) run();
  }

  // Every member chooses one @ID: existing accounts after sign-in, new accounts as the last onboarding step (the server only
  // accepts profile changes once onboarding is complete, so the question waits for it).
  const needsHandle = () => !!(Gate.open && Remote.user && Remote.profile && !Remote.profile.handle);
  const onboardingDone = () => { try { return (window.GerarAIOnboardingUI?.assess?.().mode || 'none') === 'none'; } catch { return true; } };
  function maybeAskHandle() {
    if (!needsHandle() || dialog.open || document.getElementById('onboarding-dialog')?.open || !onboardingDone()) return;
    handleDialog();
  }
  function handleDialog() {
    openDialog('เลือก @ID ของคุณ', `<form id="handle-form" novalidate><p class="form-help">@ID คือชื่อที่เพื่อนใช้ค้นหาและติดตามคุณ ใช้ a–z 0–9 และ _ ยาว 3–20 ตัว (ไม่สนตัวพิมพ์เล็กใหญ่) เปลี่ยนภายหลังได้ แต่ต้องมีเสมอ</p>
      <label class="form-field">@ID<input name="handle" required minlength="3" maxlength="20" autocapitalize="off" autocomplete="username" spellcheck="false" placeholder="เช่น mint_trip"></label>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-submit"><button class="text-button" type="button" data-action="signout">ออกจากระบบ</button><button class="primary" type="submit">บันทึก @ID</button></div></form>`);
    const form = document.getElementById('handle-form'), input = form.handle;
    const showError = m => { const el = form.querySelector('.form-error'); el.textContent = m; el.hidden = !m; };
    input.addEventListener('input', () => { input.value = input.value.toLowerCase().replace(/^@/, ''); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const handle = input.value.trim().toLowerCase().replace(/^@/, '');
      if (!HANDLE_NEW_RE.test(handle)) { showError('@ID ใช้ได้เฉพาะ a–z 0–9 และ _ ยาว 3–20 ตัว'); return; }
      const pr = Remote.profile, btn = form.querySelector('[type=submit]'); showError(''); busy(btn, true, 'กำลังบันทึก…');
      try { await Remote.updateProfile({ display_name: pr.display_name, bio: pr.bio, handle }); closeDialog(); render(); toast(`ตั้ง @${handle} แล้ว`); }
      catch (err) { busy(btn, false); showError(err?.code === '23505' ? 'มีคนใช้ @ID นี้แล้ว ลองชื่ออื่น' : /handle_format/.test(err?.message || '') ? '@ID ใช้ได้เฉพาะ a–z 0–9 และ _ ยาว 3–20 ตัว' : Remote.errorText(err)); }
    });
    input.focus();
  }
  setInterval(maybeAskHandle, 2000);

  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.openProfile) { stop(e); if (dialog.open) closeDialog(); navigate('u/' + b.dataset.openProfile); return; }
    const a = b.dataset.action;
    if (a === 'handle-search') { stop(e); if (Remote.user) handleSearchDialog('@'); else signInDialog(); }
    else if (a === 'feed-refresh') { stop(e); FF.loaded = false; FF.error = null; drawFeed(); loadFeed(); }
    else if (a === 'feed-more') { stop(e); b.disabled = true; loadFeed(true); }
  }, true);

  /* ---------- Post Audience v0.1: who may read each Story (enforced by the server; this is only the chooser) ---------- */
  // Sent with the Story write (content.audience → mutate_story_checkin) or the emergency write (report.audience →
  // create_emergency_report), so a new Story is never readable by a wider audience than chosen, not even for a moment.
  // Defaults: every Story → followers, with or without a check-in / place (location never implies public). Only an
  // explicit Discovery publication (GerarAIAudience.composeDiscovery) starts at public. Editing never changes the stored
  // audience unless the member does. Emergency reports: the report object is visible to signed-in members; the Story
  // text / photo follows the audience chosen here (default followers).
  const AUD_OPTS = [['public', '🌐', 'สาธารณะ', 'สมาชิก GERARAI ทุกคนที่เข้าสู่ระบบ'], ['followers', '👥', 'ผู้ติดตาม', 'เฉพาะคนที่ติดตามคุณ'],
    ['mutuals', '🤝', 'เพื่อน', 'เฉพาะคนที่คุณกับเขาติดตามกันและกัน'], ['private', '🔒', 'เฉพาะฉัน', 'เห็นได้คนเดียว']];
  const AUD = { key: 'new', byKey: new Map(), forms: new WeakSet() };
  const audState = (key = AUD.key) => { let s = AUD.byKey.get(key); if (!s) { s = { value: key === 'new' || key === 'emergency' ? 'followers' : null, touched: false, edit: key !== 'new' && key !== 'emergency', discovery: false }; AUD.byKey.set(key, s); } return s; };
  const audOpt = v => AUD_OPTS.find(o => o[0] === v);
  if (!document.getElementById('s4-audience-style')) document.head.insertAdjacentHTML('beforeend', `<style id="s4-audience-style">
.s4-audience{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0 2px;font-size:.88rem}
.s4-aud-label{color:var(--muted)}
.s4-aud-btn{border:1px solid var(--border);background:#fff;color:var(--navy);border-radius:999px;padding:5px 12px;font:inherit;cursor:pointer;min-height:34px}
.s4-aud-btn:disabled{opacity:.6;cursor:default}
.s4-aud-sheet{position:absolute;right:0;bottom:calc(100% + 6px);z-index:5;width:min(300px,calc(100vw - 48px));background:#fff;border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 24px rgba(16,27,48,.16);padding:6px;display:grid;gap:2px}
.s4-aud-sheet button{display:grid;grid-template-columns:24px 1fr;column-gap:8px;text-align:left;border:0;background:none;border-radius:10px;padding:8px;font:inherit;color:var(--navy);cursor:pointer}
.s4-aud-sheet button span{grid-row:span 2;font-size:1.1rem}
.s4-aud-sheet button small{color:var(--muted);font-size:.78rem}
.s4-aud-sheet button[aria-checked=true]{background:var(--soft)}
.s4-aud-sheet button:focus-visible,.s4-aud-btn:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.s4-aud-note{flex-basis:100%;margin:2px 0 0;color:var(--muted);font-size:.78rem}
.s4-audience{flex-wrap:wrap}
</style>`);
  const audForm = () => dialogContent.querySelector('form[data-s4-form], form#emergency-form');
  const audKey = form => form.id === 'emergency-form' ? 'emergency' : AUD.key;
  function audMarkup(s, locked, open, emergency) {
    const o = audOpt(s.value);
    return `<div class="s4-audience"><span class="s4-aud-label" id="s4-aud-label">กลุ่มเป้าหมาย</span>
      <button type="button" class="s4-aud-btn" data-aud-toggle aria-haspopup="true" aria-expanded="${open}" aria-labelledby="s4-aud-label s4-aud-value" ${locked || !o ? 'disabled' : ''}><span id="s4-aud-value">${o ? `${o[1]} ${o[2]}` : 'กำลังโหลด…'}</span> ▾</button>
      ${open ? `<div class="s4-aud-sheet" role="radiogroup" aria-label="เลือกกลุ่มเป้าหมาย">${AUD_OPTS.map(([v, ic, t, h]) => `<button type="button" role="radio" aria-checked="${v === s.value}" data-aud="${v}"><span>${ic}</span><b>${t}</b><small>${h}</small></button>`).join('')}</div>` : ''}
      ${emergency ? '<p class="s4-aud-note">ประเภท ตำแหน่ง และสถานะของรายงาน สมาชิกทุกคนเห็นได้ · ข้อความและรูปเห็นตามกลุ่มเป้าหมาย</p>' : ''}</div>`;
  }
  function injectAudience(open = false) {
    const form = audForm(); if (!form) return;
    const key = audKey(form), emergency = key === 'emergency';
    if (emergency && !AUD.forms.has(form)) { AUD.forms.add(form); AUD.byKey.delete('emergency'); }   // every report form starts at followers
    const s = audState(key);
    const locked = !!form.querySelector('fieldset.s4-fields')?.disabled || !!s.sent;   // an unconfirmed request is resent unchanged
    form.querySelector('.s4-audience')?.remove();
    form.querySelector('.form-submit')?.insertAdjacentHTML('beforebegin', audMarkup(s, locked, open, emergency));
  }
  new MutationObserver(() => { const form = audForm(); if (form && !form.querySelector('.s4-audience')) injectAudience(); })
    .observe(dialogContent, { childList: true, subtree: true });
  dialogContent.addEventListener('click', e => {
    const t = e.target.closest('[data-aud-toggle],[data-aud]'); const form = t && audForm(); if (!t || !form || !form.contains(t)) return;
    e.preventDefault(); e.stopPropagation();
    if (t.dataset.audToggle !== undefined) { injectAudience(t.getAttribute('aria-expanded') !== 'true'); dialogContent.querySelector('[data-aud][aria-checked=true]')?.focus(); return; }
    const s = audState(audKey(form)); s.value = t.dataset.aud; s.touched = true; injectAudience(false); dialogContent.querySelector('[data-aud-toggle]')?.focus();
  });
  function openNew(discovery) {
    AUD.key = 'new'; const s = audState('new');
    if (!s.touched && !s.sent) { s.value = discovery ? 'public' : 'followers'; s.discovery = !!discovery; }   // an explicit choice in a kept draft stays
    window.GerarAICheckinComposer.open();
  }
  compose = function () { openNew(false); };
  editPost = function (id) {
    AUD.key = id; const s = audState(id);
    if (!s.touched) memberRpc('my_post_audiences', { p_post_ids: [id] }).then(rows => { const v = rows?.[0]?.audience; if (v && !s.touched) { s.value = v; injectAudience(); } })
      .catch(err => console.warn('[GERARAI] my_post_audiences', err?.code, err?.message));
    window.GerarAICheckinComposer.edit(id);
  };
  // Explicit Discovery / place-sharing publication: the only entry that starts at public (no such button while Maps are off).
  window.GerarAIAudience = Object.freeze({ composeDiscovery: () => { if (!Remote.user) { compose(); return; } openNew(true); } });
  const audMutate = Remote.mutateStoryCheckin;
  Remote.mutateStoryCheckin = async function (req) {
    const key = AUD.key, s = audState(key);
    if (req?.p_content && !('audience' in req.p_content)) {
      if (!s.edit) req.p_content.audience = s.value || 'followers';     // a new Story always states its audience
      else if (s.touched && s.value) req.p_content.audience = s.value;   // an edit only when the owner changed it
    }
    if (req?.p_content && 'audience' in req.p_content) { s.sent = req.p_content.audience; s.value = s.sent; }
    let out;
    try { out = await audMutate.call(this, req); }
    catch (err) { if (err?.code) delete s.sent; throw err; }          // no code = outcome unknown: the composer resends this exact request
    if (key === 'new') AUD.byKey.delete('new'); else { s.touched = false; delete s.sent; }
    return out;
  };
  const audEmergency = Remote.createEmergency;
  Remote.createEmergency = function (args) {
    const s = AUD.byKey.get('emergency');
    return audEmergency.call(this, { ...args, report: { ...(args?.report || {}), audience: s?.value || 'followers' } });
  };
  window.addEventListener('gerarai:identity-changing', () => { AUD.byKey.clear(); AUD.key = 'new'; });
  /* ---------- start ---------- */
  Remote.onChange = (event, err) => {
    if (event === 'error') { fail(err); if (!Remote.user) { if (Gate.open) Gate.enter(); } else if (!Gate.open) Gate.setStatus('error'); return; }
    if (event === 'SIGNED_IN' && Remote.user) {
      if (dialog.open && /เข้าสู่ระบบ|เช็กอีเมล|รหัสหรือลิงก์/.test(document.getElementById('dialog-title').textContent)) closeDialog();
      Gate.setStatus('ready'); if (Gate.open) render(); else Gate.mount();
      toast(`ยินดีต้อนรับ ${Remote.profile?.display_name || ''}`.trim()); maybeOfferMigration();
    } else if (!Remote.user) {
      Gate.setStatus('ready'); if (Gate.open) Gate.enter(); else render();
      if (event === 'SIGNED_OUT') toast('ออกจากระบบแล้ว');
    } else { if (Gate.open) render(); else Gate.mount(); }
  };
  let startError = null;
  console.info('[GERARAI] v0.7.0-dev · backend=supabase · project=' + (window.GERARAI_CONFIG.supabase?.url || '(none)') + (Remote.configProblem ? ' · CONFIG PROBLEM: ' + Remote.configProblem : ''));
  render();
  Remote.init().then(() => {
    console.info('[GERARAI] ระบบสมาชิกพร้อม · ' + (Remote.user ? 'เข้าสู่ระบบในชื่อ ' + Remote.user.email : 'ยังไม่เข้าสู่ระบบ') + ' · โพสต์จริง ' + Remote.data.posts.length + ' · สถานที่ ' + Object.keys(Remote.placeIds).length);
    if (cameFromAuthLink) history.replaceState(null, '', location.pathname + location.search + (Remote.user ? '#feed' : ''));
    Gate.setStatus('ready');
    if (Remote.user) Gate.mount(); else render();
    if (cameFromAuthLink && Remote.user) toast(`ยินดีต้อนรับ ${Remote.profile?.display_name || ''}`.trim());
    if (authLinkError) toast('ลิงก์เข้าสู่ระบบหมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่อีกครั้ง');
    maybeOfferMigration();
  }).catch(err => {
    startError = err; console.error('[GERARAI] เริ่มระบบสมาชิกไม่สำเร็จ:', err);
    Gate.setStatus('error'); toast(Remote.errorText(err)); render();
    document.body.insertAdjacentHTML('afterbegin', `<div class="offline-banner" role="alert">${esc(err?.code === 'config' ? 'ตั้งค่าระบบสมาชิกไม่ถูกต้อง: ' + Remote.errorText(err) : 'เชื่อมต่อระบบสมาชิกไม่ได้')} · ยังเข้าสู่ระบบไม่ได้ในขณะนี้ <button class="text-button" onclick="location.reload()">ลองใหม่</button></div>`);
  });
})();
