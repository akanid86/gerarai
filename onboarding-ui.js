'use strict';
/* GERARAI — S4 Onboarding UI (v0.7.0-dev) · docs/SAFETY-ARCHITECTURE.md §2.7
 * 1) "ก่อนเริ่มใช้ GERARAI": 20+ self-attestation (own checkbox, never pre-checked) · Terms + Community acceptance
 *    (one checkbox, never pre-checked) · Privacy Notice acknowledgement (a notice line, no checkbox).
 * 2) Re-consent when a MATERIAL version becomes current (summary_th shown) · re-confirm age when the statement changes.
 * 3) Feature acknowledgements, separate from onboarding: Emergency notice (before reporting / updating a situation) and
 *    Location Safety (before sharing an exact location).
 * 4) Age review (read-only) and configuration error (fail-closed) states · self-correction entry in Privacy & Safety.
 * The database is the real gate (M1 triggers). This file only mirrors it so members are asked BEFORE a write fails,
 * which also gives the same experience while enforcement is still 'off'. Everything shown comes from the server:
 * the statement, titles, versions and document text; the browser sends the SHA-256 of the exact text it displayed.
 * Fallback: without M1 (RPC missing) or with nothing published, nothing here appears.
 */
(function () {
  const R = window.GerarAIRemote;
  if (!R || !R.enabled) return;
  const EUI = () => window.GerarAIEmergencyUI;
  const S = () => R.onboarding?.status || null;
  const WRITE_ACTIONS = new Set(['compose', 'like', 'save', 'save-place', 'follow', 'follow-user', 'edit-post', 'edit-profile', 'cover-menu', 'emergency-report', 'migrate-now']);
  const SAMPLE_ACTIONS = new Set(['like', 'save', 'follow', 'report', 'block']);   // live.js answers these for sample posts
  const WRITE_FORMS = new Set(['compose-form', 'edit-form', 'comment-form', 'profile-form', 'emergency-form', 'emergency-update-form']);
  const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  const laterKey = () => 'gerarai-onb-later:' + (R.user?.id || '');
  const said = { later: false };
  let dlg = null, ui = null, resumeEl = null, busyNow = false;

  /* ---------------------------------------------------------------- what the server says is needed */
  function assess() {
    const s = S();
    if (!R.user || !R.onboarding?.available || !s || !s.signed_in) return { mode: 'none' };
    const cs = s.config?.state;
    if (cs === 'error') return { mode: 'config_error' };
    if (cs !== 'ready') return { mode: 'none' };                    // unconfigured / partial: app behaves as before
    const ageState = s.age?.state;
    if (ageState === 'review_required') return { mode: 'review' };
    const needAge = ageState === 'required';
    const onb = (s.policies || []).filter(p => p.scope === 'onboarding');
    const ORDER = ['terms', 'community', 'privacy_notice'], rank = t => (ORDER.indexOf(t) + 1) || 99;
    const pend = onb.filter(p => !p.done).sort((a, b) => rank(a.policy_type) - rank(b.policy_type) || a.policy_type.localeCompare(b.policy_type));
    if (s.complete || (!needAge && !pend.length)) return { mode: 'none' };
    return {
      mode: 'onboard', needAge, age: s.age,
      accept: pend.filter(p => p.kind === 'accept'), ack: pend.filter(p => p.kind === 'acknowledge'),
      reconsent: pend.length > 0 && onb.some(p => p.done)
    };
  }
  const feature = type => (S()?.policies || []).find(p => p.policy_type === type && p.scope === 'feature') || null;
  const featurePending = type => { const f = feature(type); return !!(f && !f.done && S()?.config?.state === 'ready'); };

  /* ---------------------------------------------------------------- modal shell */
  function shell() {
    if (dlg) return dlg;
    document.body.insertAdjacentHTML('beforeend', `<dialog id="onboarding-dialog" class="onb-dialog" aria-labelledby="onb-title" aria-describedby="onb-lead"><div class="dialog-header"><h2 id="onb-title"></h2></div><div class="onb-body" id="onb-body"></div></dialog>`);
    dlg = document.getElementById('onboarding-dialog');
    dlg.addEventListener('cancel', e => e.preventDefault());         // not dismissible with Esc (sign out / read-only instead)
    dlg.addEventListener('click', onModalClick);
    dlg.addEventListener('change', e => { if (e.target.matches('#onboarding-form input[type=checkbox]')) { ui.checked[e.target.name] = e.target.checked; syncSubmit(); } });
    dlg.addEventListener('submit', e => { if (e.target.id === 'onboarding-form') { e.preventDefault(); submit(); } });
    return dlg;
  }
  const body = () => document.getElementById('onb-body');
  const title = t => { document.getElementById('onb-title').textContent = t; };
  function show() { shell(); if (!dlg.open) dlg.showModal(); }
  function hide() { if (dlg?.open) dlg.close(); ui = null; }

  function openModal(m = assess(), from = null) {
    if (m.mode === 'none') return false;
    resumeEl = from;
    shell();
    if (m.mode === 'onboard') { ui = { m, view: 'main', checked: { age: false, policies: false }, error: '' }; drawMain(); }
    else if (m.mode === 'review') { ui = { m }; drawReview(); }
    else { ui = { m }; drawConfigError(); }
    show();
    requestAnimationFrame(() => (dlg.querySelector('input[type=checkbox]') || dlg.querySelector('button.primary, button'))?.focus());
    return true;
  }

  function docLinks(list) {
    return list.map(p => `<button type="button" class="onb-link" data-onb-doc="${esc(p.policy_type)}">${esc(p.title || p.label_th)}</button>`)
      .reduce((out, b, i, a) => out + (i === 0 ? '' : i === a.length - 1 ? ' และ ' : ', ') + b, '');
  }
  function drawMain() {
    const m = ui.m;
    title(m.reconsent && !m.needAge ? 'มีการปรับปรุงข้อกำหนด' : m.needAge && !m.accept.length && !m.ack.length ? 'ยืนยันอายุอีกครั้ง' : 'ก่อนเริ่มใช้ GERARAI');
    const changes = m.reconsent ? [...m.accept, ...m.ack].filter(p => p.summary_th) : [];
    const lead = m.reconsent
      ? 'เราปรับปรุงเอกสารที่มีผลต่อการใช้งาน โปรดอ่านและยืนยันอีกครั้งก่อนโพสต์หรือโต้ตอบครั้งถัดไป'
      : m.needAge && !m.accept.length && !m.ack.length
        ? 'ข้อความยืนยันอายุมีการปรับปรุง โปรดยืนยันอีกครั้งก่อนโพสต์หรือโต้ตอบครั้งถัดไป'
        : 'ยินดีต้อนรับสู่ GERARAI ก่อนเริ่มโพสต์ แสดงความคิดเห็น หรือโต้ตอบกับคนอื่น โปรดยืนยันข้อมูลด้านล่าง';
    body().innerHTML = `<form id="onboarding-form" novalidate>
      <p class="onb-lead" id="onb-lead">${esc(lead)}</p>
      ${changes.length ? `<ul class="onb-changes">${changes.map(p => `<li><strong>${esc(p.title || p.label_th)}</strong><span>${esc(p.summary_th)}</span></li>`).join('')}</ul>` : ''}
      ${m.needAge ? `<div class="onb-box onb-age"><label class="onb-check"><input type="checkbox" name="age" ${ui.checked.age ? 'checked' : ''}><span class="onb-statement">${esc(m.age.statement_th)}</span></label>
        <p class="onb-note">ช่วง Open Beta GERARAI เปิดสำหรับผู้ที่มีอายุ ${Number(m.age.min_age) || 20} ปีบริบูรณ์ขึ้นไป เราไม่ขอวันเกิดหรือเอกสารยืนยันตัวตน การยืนยันอายุไม่ตรงความจริงถือเป็นการผิดข้อกำหนดการใช้บริการ ถ้าคุณอายุยังไม่ถึง คุณยังอ่านเนื้อหาได้ แต่ยังโพสต์หรือโต้ตอบไม่ได้</p></div>` : ''}
      ${m.accept.length ? `<div class="onb-box"><label class="onb-check"><input type="checkbox" name="policies" ${ui.checked.policies ? 'checked' : ''}><span>ฉันได้อ่านและยอมรับ ${docLinks(m.accept)}</span></label></div>` : ''}
      ${m.ack.length ? `<p class="onb-notice">โปรดอ่าน ${docLinks(m.ack)} ว่าเราเก็บและใช้ข้อมูลของคุณอย่างไร</p>` : ''}
      <p class="form-error" role="alert" ${ui.error ? '' : 'hidden'}>${esc(ui.error)}</p>
      <div class="onb-actions"><button type="button" class="secondary" data-onb="later">ดูอย่างเดียวก่อน</button><button type="submit" class="primary" data-onb="submit">เริ่มใช้งาน</button></div>
      <button type="button" class="text-button onb-signout" data-onb="signout">ออกจากระบบ</button>
    </form>`;
    syncSubmit();
  }
  function syncSubmit() {
    const btn = dlg?.querySelector('[data-onb=submit]'); if (!btn || !ui) return;
    btn.disabled = busyNow || (ui.m.needAge && !ui.checked.age) || (ui.m.accept.length > 0 && !ui.checked.policies);
  }

  // One renderer for the modal and the legal pages (legal-docs.js); it escapes everything.
  const paragraphs = text => window.GerarAILegal ? window.GerarAILegal.render(text, { headingClass: 'onb-doc-h' })
    : String(text).split(/\n{2,}/).map(t => `<p>${esc(t.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  const thaiDate = iso => { try { return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };
  async function drawDoc(type) {
    const p = (S()?.policies || []).find(x => x.policy_type === type); if (!p) return;
    ui.view = 'doc';
    title(p.title || p.label_th);
    body().innerHTML = `<div class="onb-doc"><button type="button" class="text-button onb-back" data-onb="back">← กลับไปหน้ายืนยัน</button><p class="onb-meta">กำลังโหลดเอกสาร…</p></div>`;
    try {
      const d = await R.onboardingDoc(p.policy_type, p.version);
      if (!ui || ui.view !== 'doc') return;
      if (d.shownHash !== p.content_hash) throw Object.assign(new Error('policy_version_changed'), { code: 'P0001' });
      body().innerHTML = `<div class="onb-doc"><button type="button" class="text-button onb-back" data-onb="back">← กลับไปหน้ายืนยัน</button>
        <p class="onb-meta">ฉบับ ${esc(d.version)} · มีผลตั้งแต่ ${esc(thaiDate(d.effective_at))}</p>
        <div class="onb-doc-text" tabindex="0" aria-label="${esc(d.title)}">${paragraphs(d.content)}</div>
        <div class="onb-actions"><button type="button" class="primary" data-onb="back">กลับไปยืนยัน</button></div></div>`;
      body().querySelector('.onb-doc-text').focus({ preventScroll: true });
    } catch (err) {
      if (R.onboardingCode(err) === 'policy_version_changed') return versionChanged();
      if (ui) body().querySelector('.onb-meta').textContent = R.errorText(err);
    }
  }
  function back() { if (!ui) return; ui.view = 'main'; drawMain(); }

  function drawReview() {
    title('บัญชีอยู่ระหว่างตรวจสอบอายุ');
    body().innerHTML = `<p class="onb-lead" id="onb-lead">การยืนยันอายุของบัญชีนี้ถูกแก้ไขหรืออยู่ระหว่างการตรวจสอบ ระหว่างนี้คุณยังอ่านเนื้อหา รายงาน บล็อก และลบเนื้อหาของตัวเองได้ แต่ยังโพสต์หรือโต้ตอบไม่ได้</p>
      <p class="onb-note">GERARAI จะไม่ลงโทษบัญชีจากรายงานหรือระบบอัตโนมัติเพียงอย่างเดียว ถ้าคิดว่าเป็นความผิดพลาด โปรดติดต่อทีมงาน GERARAI เพื่อขอให้ตรวจสอบ</p>
      <div class="onb-actions"><button type="button" class="primary" data-onb="later">ดูอย่างเดียว</button></div>
      <button type="button" class="text-button onb-signout" data-onb="signout">ออกจากระบบ</button>`;
  }
  function drawConfigError() {
    title('ระบบกำลังปรับปรุงเงื่อนไข');
    body().innerHTML = `<p class="onb-lead" id="onb-lead">ตอนนี้ยังโพสต์หรือโต้ตอบไม่ได้ชั่วคราว เพราะเอกสารเงื่อนไขการใช้งานกำลังถูกปรับปรุง คุณยังอ่านเนื้อหา รายงาน และบล็อกได้ตามปกติ</p>
      <div class="onb-actions"><button type="button" class="primary" data-onb="later">ตกลง</button></div>`;
  }

  async function versionChanged() {
    R.forgetOnboardingDocs();
    await R.loadOnboarding().catch(() => {});
    const m = assess();
    if (m.mode !== 'onboard') { sync(); if (m.mode === 'none') hide(); else openModal(m); return; }
    ui = { m, view: 'main', checked: { age: false, policies: false }, error: 'เอกสารเพิ่งมีการปรับปรุง โปรดอ่านฉบับล่าสุดและยืนยันอีกครั้ง' };
    drawMain(); show();
  }

  async function submit() {
    if (!ui || busyNow) return;
    const m = ui.m;
    if ((m.needAge && !ui.checked.age) || (m.accept.length && !ui.checked.policies)) return;
    busyNow = true; syncSubmit();
    const btn = dlg.querySelector('[data-onb=submit]'); if (btn) btn.textContent = 'กำลังบันทึก…';
    try {
      const seen = {};
      if (m.needAge) seen.age = await R.sha256Hex(m.age.statement_th);
      for (const p of [...m.accept, ...m.ack]) seen[p.policy_type] = (await R.onboardingDoc(p.policy_type, p.version)).shownHash;
      await R.completeOnboarding({ ageConfirmed: m.needAge ? ui.checked.age === true : false, accept: m.accept.map(p => p.policy_type), acknowledge: m.ack.map(p => p.policy_type), seen });
      busyNow = false;
      const next = assess();
      if (next.mode !== 'none') { sync(); openModal(next); return; }
      said.later = false; try { sessionStorage.removeItem(laterKey()); } catch { /* ignore */ }   // next change asks again
      hide(); sync();
      toast(m.reconsent ? 'บันทึกการยืนยันแล้ว ใช้งานต่อได้เลย' : 'พร้อมแล้ว! เริ่มการผจญภัยได้เลย');
      const el = resumeEl; resumeEl = null;
      if (el && document.contains(el)) setTimeout(() => el.click(), 0);
    } catch (err) {
      busyNow = false;
      const code = R.onboardingCode(err);
      if (code === 'policy_version_changed') return versionChanged();
      if (code === 'age_review_required') { await R.loadOnboarding().catch(() => {}); sync(); openModal(); return; }
      console.error('[GERARAI] complete_onboarding:', err?.code, err?.message);
      if (!ui) return;
      ui.error = R.errorText(err); drawMain();
    }
  }

  async function signOutNow() {
    hide();
    try { await R.signOut(); } catch (err) { toast(R.errorText(err)); }
  }
  function later() {
    said.later = true;
    try { sessionStorage.setItem(laterKey(), '1'); } catch { /* storage may be blocked */ }
    resumeEl = null; hide(); sync();
  }
  function onModalClick(e) {
    const d = e.target.closest('[data-onb-doc]'); if (d) { e.preventDefault(); drawDoc(d.dataset.onbDoc); return; }
    const b = e.target.closest('[data-onb]'); if (!b) return;
    const a = b.dataset.onb;
    if (a === 'back') back();
    else if (a === 'later') later();
    else if (a === 'signout') signOutNow();
  }

  /* ---------------------------------------------------------------- read-only banner */
  function banner(m) {
    let el = document.getElementById('onb-banner');
    const text = m.mode === 'onboard' ? (m.reconsent ? 'มีการปรับปรุงข้อกำหนด ยืนยันอีกครั้งก่อนโพสต์หรือโต้ตอบ' : 'ยืนยันอายุและยอมรับข้อกำหนดเพื่อเริ่มโพสต์และโต้ตอบ')
      : m.mode === 'review' ? 'บัญชีอยู่ระหว่างตรวจสอบอายุ · โพสต์และโต้ตอบไม่ได้ชั่วคราว'
      : m.mode === 'config_error' ? 'ระบบกำลังปรับปรุงเงื่อนไข · โพสต์และโต้ตอบไม่ได้ชั่วคราว' : '';
    if (!text) { el?.remove(); return; }
    if (!el) {
      document.querySelector('.app-layout')?.insertAdjacentHTML('beforebegin', '<div id="onb-banner" class="onb-banner" role="status"></div>');
      el = document.getElementById('onb-banner'); if (!el) return;
    }
    el.innerHTML = `<span>${esc(text)}</span>${m.mode === 'onboard' ? '<button type="button" class="text-button" data-onb-open>ยืนยันตอนนี้</button>' : ''}`;
  }

  function sync() {
    const m = assess();
    banner(m);
    if (m.mode === 'none' && dlg?.open) hide();
    return m;
  }
  function afterStatus() {
    const m = sync();
    if (m.mode !== 'onboard' || dlg?.open) return;
    let skipped = said.later;
    try { skipped = skipped || sessionStorage.getItem(laterKey()) === '1'; } catch { /* ignore */ }
    if (!skipped) openModal(m);
  }

  /* ---------------------------------------------------------------- feature acknowledgement: Emergency notice */
  async function emergencyAck(from) {
    const f = feature('emergency_notice'); if (!f) return;
    openDialog('ข้อควรรู้ก่อนรายงานสถานการณ์', `<div class="onb-feature"><p class="form-help">กำลังโหลด…</p></div>`);
    try {
      const d = await R.onboardingDoc(f.policy_type, f.version);
      if (d.shownHash !== f.content_hash) throw Object.assign(new Error('policy_version_changed'), { code: 'P0001' });
      const box = document.querySelector('#dialog-content .onb-feature'); if (!box) return;
      box.innerHTML = `${EUI()?.helpNotice ? EUI().helpNotice() : ''}
        <p class="onb-meta">${esc(d.title)} · ฉบับ ${esc(d.version)}</p>
        <div class="onb-doc-text onb-feature-text" tabindex="0">${paragraphs(d.content)}</div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-submit"><button type="button" class="secondary" data-action="close-dialog">ไว้ก่อน</button><button type="button" class="primary" data-onb-emg-ack>ฉันเข้าใจ</button></div>`;
      box.querySelector('[data-onb-emg-ack]').addEventListener('click', async ev => {
        const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
        try {
          await R.acknowledgePolicy('emergency_notice', d.shownHash);
          toast('บันทึกแล้ว ขอบคุณที่ช่วยกันดูแลข้อมูลสถานการณ์');
          if (from?.dataset?.action === 'emergency-report' && EUI()?.composer) EUI().composer();
          else closeDialog();
        } catch (err) {
          btn.disabled = false; btn.textContent = 'ฉันเข้าใจ';
          if (R.onboardingCode(err) === 'policy_version_changed') { R.forgetOnboardingDocs(); await R.loadOnboarding().catch(() => {}); emergencyAck(from); return; }
          const el = box.querySelector('.form-error'); el.textContent = R.errorText(err); el.hidden = false;
        }
      });
    } catch (err) {
      if (R.onboardingCode(err) === 'policy_version_changed') { R.forgetOnboardingDocs(); await R.loadOnboarding().catch(() => {}); return emergencyAck(from); }
      const box = document.querySelector('#dialog-content .onb-feature'); if (box) box.innerHTML = `<p class="form-error" role="alert">${esc(R.errorText(err))}</p>`;
    }
  }

  /* ---------------------------------------------------------------- feature acknowledgement: Location Safety (exact) */
  // Mirrors the DB gate (20261003090000 + M2 Place Disclosure 20261005090000): new/raised/moved exact location, or showing
  // a place's NAME (venue) on a Story — linking a place alone shows nothing and is not gated; "area" (city) is not gated.
  // New content compares with nothing; the edit form compares with the values it opened with.
  function locState(form) {
    const sel = form.querySelector('select[name=discovery_precision]');
    const radio = form.querySelector('[name=location_precision]:checked');
    const val = n => form.querySelector(`[name=${n}]`)?.value ?? '';
    return { prec: sel ? sel.value : radio ? radio.value : '', lat: val('discovery_lat') || val('latitude'), lng: val('discovery_lng') || val('longitude'), place: val('place'),
             disc: form.querySelector('[name=place_disclosure]:checked')?.value || '' };
  }
  function exposure(form) {
    if(typeof form._checkinExposure==='function')return form._checkinExposure();
    const now = locState(form), base = form.id === 'edit-form' ? (form._onbBase || now) : { prec: '', lat: '', lng: '', place: '', disc: '' };
    if (now.prec === 'exact' && (base.prec !== 'exact' || now.lat !== base.lat || now.lng !== base.lng)) return 'exact';
    if (now.place && now.disc === 'venue' && (base.disc !== 'venue' || now.place !== base.place)) return 'place';
    return null;
  }
  const wantsExact = form => !!exposure(form);
  function locAnchor(form) {
    if(form._checkinExposure)return form.querySelector('.s4-consent');
    const why = exposure(form);
    if (why === 'place') { const box = form.querySelector('.place-disclosure'); if (box) return box; const p = form.querySelector('select[name=place]'); return p ? (p.closest('label') || p) : null; }
    const sel = form.querySelector('select[name=discovery_precision]');
    if (sel) return sel.closest('label') || sel;
    const r = form.querySelector('[name=location_precision]:checked');
    return r ? (r.closest('.emg-chips') || r.closest('label')) : null;
  }
  document.addEventListener('focusin', e => { const f = e.target.closest?.('#edit-form'); if (f && !f._onbBase) f._onbBase = locState(f); }, true);
  async function locCard(form, flag = false) {
    let card = form.querySelector('.onb-loc-card');
    if (!wantsExact(form) || !featurePending('location_safety')) { card?.remove(); return; }
    const f = feature('location_safety'), anchor = locAnchor(form); if (!anchor) return;
    if (!card) {
      anchor.insertAdjacentHTML('afterend', `<div class="onb-loc-card" role="note"><strong>${exposure(form) === 'place' ? 'ก่อนแสดงชื่อสถานที่บนเรื่องราว' : 'ก่อนแชร์ตำแหน่งตรงจุด'}</strong><p class="onb-loc-summary">กำลังโหลดข้อควรรู้…</p><div class="onb-loc-full" hidden></div><p class="onb-loc-error" role="alert" hidden></p><div class="onb-loc-actions"><button type="button" class="onb-link" data-onb-loc="read">อ่านข้อควรรู้ฉบับเต็ม</button><button type="button" class="secondary" data-onb-loc="ack">ฉันเข้าใจ</button></div></div>`);
      card = form.querySelector('.onb-loc-card');
      try {
        const d = await R.onboardingDoc(f.policy_type, f.version);
        if(!card.isConnected)return;
        card.dataset.hash = d.shownHash;
        const first = String(d.content).split(/\n{2,}/)[0].trim();
        card.querySelector('.onb-loc-summary').textContent = d.summary_th || (first.length > 280 ? first.slice(0, 277) + '…' : first);
        card.querySelector('.onb-loc-full').innerHTML = paragraphs(d.content);
      } catch (err) { if(card.isConnected)card.querySelector('.onb-loc-summary').textContent = R.errorText(err); }
    }
    if (flag) { const e = card.querySelector('.onb-loc-error'); e.textContent = 'กด “ฉันเข้าใจ” ก่อน หรือเลือกตำแหน่งแบบโดยประมาณ / ไม่แสดงชื่อสถานที่'; e.hidden = false; card.scrollIntoView({ block: 'nearest' }); }
  }
  async function locAck(card) {
    const btn = card.querySelector('[data-onb-loc=ack]'); btn.disabled = true;
    try {
      const f = feature('location_safety');
      const hash = card.dataset.hash || (await R.onboardingDoc(f.policy_type, f.version)).shownHash;
      await R.acknowledgePolicy('location_safety', hash);
      card.outerHTML = '<p class="onb-loc-done" role="status">✓ รับทราบข้อควรรู้เรื่องการแชร์ตำแหน่งแล้ว</p>';
    } catch (err) {
      btn.disabled = false;
      if (R.onboardingCode(err) === 'policy_version_changed') { R.forgetOnboardingDocs(); await R.loadOnboarding().catch(() => {}); const form = card.closest('form'); card.remove(); if (form) locCard(form); return; }
      const e = card.querySelector('.onb-loc-error'); e.textContent = R.errorText(err); e.hidden = false;
    }
  }

  /* ---------------------------------------------------------------- self-correction (Privacy & Safety dialog) */
  const baseOpen = openDialog;
  openDialog = function (t, html) {
    baseOpen(t, html);
    if (t !== 'ความเป็นส่วนตัวและความปลอดภัย' || !R.user || S()?.age?.state !== 'confirmed') return;
    document.getElementById('dialog-content')?.insertAdjacentHTML('beforeend', `<h3 class="dialog-section">การยืนยันอายุ</h3><div class="safety-row"><span>ยืนยันแล้วว่าอายุ ${Number(S().age.min_age) || 20} ปีบริบูรณ์ขึ้นไป</span><button class="secondary" data-onb-age-correct>แก้ไขการยืนยันอายุ</button></div>`);
  };
  function ageCorrectDialog() {
    const min = Number(S()?.age?.min_age) || 20;
    openDialog('แก้ไขการยืนยันอายุ', `<p class="form-help">ถ้าคุณยืนยันอายุผิด หรืออายุยังไม่ถึง ${min} ปีบริบูรณ์ แจ้งได้ที่นี่ บันทึกการยืนยันเดิมจะถูกเก็บไว้เป็นประวัติ และบัญชีจะอยู่ระหว่างตรวจสอบอายุ ระหว่างนี้ยังอ่าน รายงาน บล็อก และลบเนื้อหาของตัวเองได้ แต่จะโพสต์หรือโต้ตอบไม่ได้จนกว่าจะตรวจสอบเสร็จ</p><p class="form-error" role="alert" hidden></p><div class="form-submit"><button class="secondary" data-action="close-dialog">ยกเลิก</button><button class="primary danger-fill" data-onb-age-confirm>ยืนยันผิด / อายุยังไม่ถึง ${min} ปี</button></div>`);
  }
  async function ageCorrect(btn) {
    btn.disabled = true;
    try { await R.correctMyAge(); closeDialog(); sync(); toast('บันทึกแล้ว บัญชีอยู่ระหว่างตรวจสอบอายุ'); }
    catch (err) { btn.disabled = false; const e = document.querySelector('#dialog-content .form-error'); if (e) { e.textContent = R.errorText(err); e.hidden = false; } }
  }

  /* ---------------------------------------------------------------- events */
  // window capture runs before live.js / emergency-ui.js (document) handlers, so a write is intercepted before it starts.
  window.addEventListener('click', e => {
    const el = e.target.closest('button,[data-nav]'); if (!el) return;
    if (el.hasAttribute('data-onb-open')) { stop(e); openModal(); return; }
    if (el.hasAttribute('data-onb-age-correct')) { stop(e); ageCorrectDialog(); return; }
    if (el.hasAttribute('data-onb-age-confirm')) { stop(e); ageCorrect(el); return; }
    const loc = el.dataset.onbLoc;
    if (loc) { stop(e); const card = el.closest('.onb-loc-card'); if (loc === 'read') { const full = card.querySelector('.onb-loc-full'); full.hidden = !full.hidden; el.textContent = full.hidden ? 'อ่านข้อควรรู้ฉบับเต็ม' : 'ย่อข้อควรรู้'; } else locAck(card); return; }
    if (!R.user || dlg?.contains(el)) return;
    const a = el.dataset.action, emg = el.dataset.emg;
    if (!WRITE_ACTIONS.has(a) && emg !== 'update') return;
    if (SAMPLE_ACTIONS.has(a) && el.dataset.id && !R.isId(el.dataset.id)) return;   // sample content: live.js explains
    const m = assess();
    if (m.mode !== 'none') { stop(e); openModal(m, el); return; }
    if ((a === 'emergency-report' || emg === 'update') && featurePending('emergency_notice')) { stop(e); emergencyAck(el); }
  }, true);
  window.addEventListener('submit', e => {
    const form = e.target; if (!R.user || !WRITE_FORMS.has(form.id)) return;
    const m = assess();
    if (m.mode !== 'none') { stop(e); openModal(m); return; }
    if ((form.id === 'emergency-form' || form.id === 'emergency-update-form') && featurePending('emergency_notice')) { stop(e); emergencyAck(null); return; }
    if (wantsExact(form) && featurePending('location_safety')) { stop(e); locCard(form, true); }
  }, true);
  document.addEventListener('change', e => {
    const t = e.target; if (!t.matches('select[name=discovery_precision], [name=location_precision], select[name=place], [name=place_disclosure], [name=discovery_lat], [name=discovery_lng]')) return;
    const form = t.closest('form'); if (form && R.user) locCard(form);
  });

  // Server-side answers (gate triggers / RPCs) open the matching step; R.errorText is the single place errors pass.
  const baseErrorText = R.errorText;
  let reacting = false;
  R.errorText = function (err) {
    const code = R.onboardingCode(err);
    if (code && !reacting && ['age_confirmation_required', 'age_review_required', 'policy_required', 'onboarding_config_missing'].includes(code)) {
      reacting = true;
      const emergencyOnly = code === 'policy_required' && /emergency_notice/.test(String(err?.details || ''));
      R.loadOnboarding().catch(() => {}).then(() => {
        reacting = false; sync();
        if (emergencyOnly) { if (featurePending('emergency_notice')) emergencyAck(null); }
        else openModal();
      });
    }
    return baseErrorText(err);
  };

  // Status is (re)loaded by Remote.reload (start, sign-in, sign-out); react after live.js has rendered.
  const baseLoad = R.loadOnboarding;
  R.loadOnboarding = async function (...args) {
    const out = await baseLoad.apply(this, args);
    setTimeout(afterStatus, 0);
    return out;
  };
  if (R.onboarding?.available !== null) setTimeout(afterStatus, 0);
  window.addEventListener('gerarai:identity-changing', () => { said.later = false; resumeEl = null; hide(); document.getElementById('onb-banner')?.remove(); });

  window.GerarAIOnboardingUI = Object.freeze({ assess, open: openModal, sync, refreshLocation:locCard });
})();
