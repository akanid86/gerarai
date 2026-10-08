'use strict';
/* GERARAI — Emergency Discovery v0.1 UI (v0.7.0-dev)
 * Map layer ("สถานการณ์ตอนนี้"), short mobile-first composer, detail card with freshness, owner
 * update / resolve / delete with append-only history, conflict notice, trust report, Feed card.
 * All rules and wording come from emergency-core.js + server config; nothing here decides "safety".
 */
(function () {
  const E = window.GerarAIEmergency, R = window.GerarAIRemote, Provider = window.GerarAIMapProvider;
  if (!E) return;
  const live = () => !!R?.enabled;
  const cfg = () => R?.emergency || {};
  const rules = () => cfg().rules;
  const setting = k => cfg().settings?.[k] ?? E.FALLBACK_SETTINGS[k];
  const ruleOf = code => E.ruleMap(rules()).get(code) || { icon: '📍', label_th: code, allowed_precisions: ['exact', 'approximate'] };
  const categoryIcon=r=>window.GerarAICategoryIcons.render(r.type_code,r.icon);
  const now = () => (R?.emergencyNow ? R.emergencyNow() : Date.now());
  const MIGRATION_MSG = 'ยังไม่เปิดระบบรายงานสถานการณ์บนฐานข้อมูลนี้ (ต้องรัน migration 20261001090000_emergency_reports.sql) · Feed, Map และ Discovery ใช้งานได้ตามปกติ';
  const REPORT_REASONS = [['false', 'ข้อมูลเท็จ / ทำให้เข้าใจผิด'], ['outdated', 'ข้อมูลล้าสมัย'], ['dangerous_advice', 'คำแนะนำที่อาจเป็นอันตราย'], ['impersonation', 'แอบอ้างเป็นแหล่งทางการ'], ['scam', 'หลอกลวง / ฉ้อโกง'], ['spam', 'สแปม'], ['other', 'อื่น ๆ']];
  const WHEN = [['0', 'ตอนนี้'], ['15', '15 นาทีที่แล้ว'], ['30', '30 นาทีที่แล้ว'], ['60', '1 ชม. ที่แล้ว'], ['custom', 'เลือกเวลา']];
  const filters = { types: null, freshOnly: false, history: false };
  let bannerClosed = false;
  try { bannerClosed = sessionStorage.getItem('gerarai-emergency-banner') === 'closed'; } catch { /* storage may be blocked */ }
  let ctx = null, pendingFocus = null, pickerCleanup = null, lastDetail = null;
  const rowById = id => ctx?.rows.find(e => e.id === id) || (lastDetail?.id === id ? lastDetail : null);

  const chips = (name, list, current, extra = '') => `<div class="emg-chips" role="radiogroup">${list.map(([v, t]) => `<label class="emg-chip"><input type="radio" name="${name}" value="${esc(v)}" ${String(current ?? '') === String(v) ? 'checked' : ''} ${extra}><span>${esc(t)}</span></label>`).join('')}</div>`;
  const helpNotice = () => `<div class="emg-help-notice" role="note"><strong>${esc(setting('help_disclaimer_th'))}</strong><p>ถ้าอันตรายถึงชีวิตหรือต้องการความช่วยเหลือด่วน ติดต่อหน่วยงานโดยตรง:</p><div class="emg-hotlines">${(setting('hotlines') || []).map(h => `<a class="secondary" href="tel:${esc(h.number)}">📞 ${esc(h.number)} · ${esc(h.label_th)}</a>`).join('')}</div></div>`;
  const sourceChip = e => `<span class="emg-source emg-source-${esc(e.source_type || 'community')}">${esc(E.SOURCE_LABEL[e.source_type] || E.SOURCE_LABEL.community)}${e.source_type === 'official' && e.official_source_name ? ' · ' + esc(e.official_source_name) : ''}</span>`;
  const freshChip = f => `<span class="emg-fresh emg-${f.state}">${esc(f.label)}</span>`;

  /* ---------------------------------------------------------------- map layer */
  function attach(provider, els) {
    ctx = { provider, els, rows: [], selection: null, abort: null, timer: null, gen: 0 };
    if (!live()) { els.slot.innerHTML = `<p class="emg-notice">รายงานสถานการณ์ใช้ได้ในโหมดสมาชิกเท่านั้น</p>`; return; }
    els.slot.innerHTML = `<p class="emg-notice">กำลังโหลดการตั้งค่าสถานการณ์…</p>`;
    R.loadEmergencyConfig().then(c => {
      if (!ctx) return;
      if (!c.available) { els.slot.innerHTML = `<p class="emg-notice" role="status">${MIGRATION_MSG}</p>`; return; }
      if (els.focus || pendingFocus) {
        const f = pendingFocus && (!els.focus || pendingFocus.id === els.focus) ? pendingFocus : { id: els.focus };
        ctx.focus = f.id; pendingFocus = null;
        if (f.latitude != null) provider.setView(f.latitude, f.longitude, 15);
      }
      renderSlot(); load();
    }).catch(err => { if (ctx) els.slot.innerHTML = `<p class="emg-notice" role="alert">${esc(R.errorText(err))}</p>`; });
  }
  function detach() { if (!ctx) return; ctx.abort?.abort(); clearTimeout(ctx.timer); ctx.gen++; ctx = null; }
  function moved() { if (!ctx || !cfg().available) return; clearTimeout(ctx.timer); ctx.timer = setTimeout(load, 300); }
  function renderSlot() {
    if (!ctx) return;
    const types = rules() || E.FALLBACK_RULES;
    ctx.els.slot.innerHTML = `${bannerClosed ? '' : `<div class="emg-banner" role="note"><span>⚠︎ ${esc(setting('banner_th'))}</span><button class="icon-button" data-emg="banner-close" aria-label="ปิดข้อความเตือน">×</button></div>`}
      <div class="emg-filters" role="group" aria-label="ประเภทสถานการณ์"><button data-emg-type="" class="${!filters.types ? 'active' : ''}" aria-pressed="${!filters.types}">ทั้งหมด</button>${types.map(r => `<button data-emg-type="${esc(r.type_code)}" class="${filters.types?.[0] === r.type_code ? 'active' : ''}" aria-pressed="${filters.types?.[0] === r.type_code}">${categoryIcon(r)} ${esc(r.label_th)}</button>`).join('')}</div>
      <div class="emg-toggles"><label><input type="checkbox" data-emg-toggle="freshOnly" ${filters.freshOnly ? 'checked' : ''}> เฉพาะรายงานใหม่</label><label><input type="checkbox" data-emg-toggle="history" ${filters.history ? 'checked' : ''}> แสดงประวัติที่หมดอายุ / คลี่คลายแล้ว</label></div>`;
    chipEdges(ctx.els.slot.querySelector('.emg-filters'));
  }
  async function load() {
    if (!ctx) return;
    const c = ctx; c.abort?.abort(); c.abort = new AbortController(); const run = ++c.gen;
    c.els.list.innerHTML = '<p class="form-help" role="status">กำลังโหลดรายงานสถานการณ์…</p>';
    try {
      const b = c.provider.bounds();
      const res = await R.emergencyInViewport(b, { types: filters.types, includeHistory: filters.history || !!c.focus }, c.abort.signal);
      if (ctx !== c || run !== c.gen) return;
      let rows = res.rows;
      if (!filters.history) rows = rows.filter(e => E.freshness(e, rules(), now()).current || e.id === c.focus);
      if (filters.freshOnly) rows = rows.filter(e => E.freshness(e, rules(), now()).state === 'fresh' || e.id === c.focus);
      c.rows = rows.sort((a, b2) => new Date(b2.reported_at) - new Date(a.reported_at));
      draw();
      if (c.focus) { const f = c.rows.find(e => e.id === c.focus); c.focus = null; if (f) select(f); }
    } catch (err) {
      if (ctx !== c || run !== c.gen || err.name === 'AbortError') return;
      c.els.list.innerHTML = `<p class="form-help" role="alert">${esc(R.errorText(err))}</p>`;
    }
  }
  function draw() {
    if (!ctx) return;
    const c = ctx;
    c.provider.drawEmergency?.(c.rows, select, c.selection);
    c.els.list.innerHTML = `<div class="emg-list-heading"><h2>รายงานสถานการณ์ในบริเวณนี้</h2><small>${c.rows.length ? `${c.rows.length} รายงาน · เรียงจากล่าสุด` : 'ยังไม่มีรายงานปัจจุบันในบริเวณนี้'}</small></div>${c.rows.map(card).join('')}`;
  }
  function card(e) {
    const r = ruleOf(e.type_code), f = E.freshness(e, rules(), now());
    return `<button class="emg-card emg-${f.state} ${ctx?.selection === e.id ? 'selected' : ''}" data-emg-select="${esc(e.id)}"><span class="emg-card-icon" aria-hidden="true">${categoryIcon(r)}</span><span class="emg-card-copy"><strong>${esc(E.headline(e))}</strong><small>${freshChip(f)} ${esc(f.reportedAgo)} · ${esc(E.clockTime(e.reported_at))}</small><small>${sourceChip(e)} · ${esc(e.post?.author || '')}</small></span></button>`;
  }
  function select(e) {
    if (!ctx) return;
    lastDetail = e; ctx.selection = e.id; draw();
    const own = !!(R.user && e.user_id === R.user.id);
    ctx.els.selected.innerHTML = `<div class="emergency-detail discovery-preview-card" data-report="${esc(e.id)}">${detailMarkup(e, own)}</div>`;
    const box = ctx.els.selected.querySelector('.emergency-detail');
    box.querySelector('[data-emg="close"]')?.addEventListener('click', () => { if (ctx) { ctx.selection = null; ctx.els.selected.innerHTML = ''; draw(); } });
    R.emergencyHistory(e.id).then(rows => {
      const el = box.querySelector('.emg-history'); if (!el || !document.body.contains(el)) return;
      el.innerHTML = rows.length ? `<ol>${rows.map(u => `<li><time>${esc(E.clockTime(u.reported_at))}</time> — ${esc(historyText(e, u))}${u.note ? ` · “${esc(u.note)}”` : ''}</li>`).join('')}</ol>` : '<p class="form-help">ยังไม่มีประวัติ</p>';
    }).catch(() => {});
  }
  function historyText(e, u) {
    if (u.action === 'resolved') return 'เจ้าของรายงานแจ้งว่าคลี่คลายแล้ว';
    const snap = { ...e, ...u, type_code: e.type_code, emergency_status: 'active' };
    const text = E.headline(snap).replace(/ · \d{2}:\d{2}$/, '').replace(/เมื่อ \d{2}:\d{2}$/, '');
    return (u.action === 'created' ? 'รายงานครั้งแรก: ' : u.action === 'reopened' ? 'เปิดรายงานอีกครั้ง: ' : 'อัปเดต: ') + text;
  }
  function detailMarkup(e, own) {
    const r = ruleOf(e.type_code), f = E.freshness(e, rules(), now()), p = e.post || {};
    const warn = E.staleWarning(e, rules(), now());
    const conflicts = ctx ? E.conflicts(e, ctx.rows, rules(), now()) : [];
    return `<div class="emg-detail-head"><span class="emg-sheet-grip" aria-hidden="true"></span><span class="emg-card-icon" aria-hidden="true">${categoryIcon(r)}</span><div><strong>${esc(r.label_th)}</strong><div class="emg-chips-row">${freshChip(f)}${sourceChip(e)}</div></div><button class="icon-button emg-detail-close" data-emg="close" aria-label="ปิดการ์ด">×</button></div>
      <p class="emg-headline">${esc(E.headline(e))}</p>
      <ul class="emg-times">${E.timeLines(e, rules(), now()).map(l => `<li>${esc(l)}</li>`).join('')}${e.emergency_status === 'resolved' && e.resolved_at ? `<li>คลี่คลายแล้วเมื่อ ${esc(E.clockTime(e.resolved_at))}</li>` : ''}</ul>
      ${warn ? `<p class="emg-stale" role="note">⚠︎ ${esc(warn)}</p>` : ''}
      ${conflicts.length ? `<div class="emg-conflict" role="note"><strong>${esc(E.CONFLICT_TEXT)}</strong><ul>${conflicts.slice(0, 5).map(x => `<li>${categoryIcon(ruleOf(x.report.type_code))} ${esc(E.headline(x.report))} · ห่าง ${x.distanceM} ม.</li>`).join('')}</ul><small>GERARAI ไม่ตัดสินว่ารายงานไหนถูก โปรดดูเวลาและแหล่งข้อมูลประกอบการตัดสินใจ</small></div>` : ''}
      ${e.type_code === 'help_request' ? helpNotice() : ''}
      <p class="form-help">${esc(E.PRECISION_LABEL[e.location_precision] || '')}</p>
      ${p.image ? `<button type="button" class="emg-photo" data-emg="photo" data-src="${esc(p.image)}" aria-label="ดูรูปขนาดใหญ่"><img src="${esc(p.image)}" alt="ภาพประกอบรายงาน" loading="lazy"><span class="emg-photo-hint" aria-hidden="true">⤢ ดูรูปเต็ม</span></button>` : ''}
      ${p.body ? `<p class="emg-note">${esc(p.body)}</p>` : ''}
      <p class="form-help">${esc(p.author || '')}${p.handle ? ' · @' + esc(p.handle) : ''}</p>
      <details class="emg-history-box" open><summary>ประวัติการอัปเดต</summary><div class="emg-history"><p class="form-help">กำลังโหลด…</p></div></details>
      <div class="emg-actions">${own
        ? `<button class="secondary" data-emg="update" data-id="${esc(e.id)}">อัปเดตสถานการณ์</button>${e.emergency_status === 'active' ? `<button class="secondary" data-emg="resolve" data-id="${esc(e.id)}">คลี่คลายแล้ว</button>` : ''}<button class="text-button danger" data-emg="delete" data-id="${esc(e.id)}">ลบรายงาน</button>`
        : `<button class="secondary" data-emg="report" data-id="${esc(e.id)}">⚑ รายงานข้อมูลนี้</button>`}</div>`;
  }

  /* ---------------------------------------------------------------- composer */
  async function composer() {
    if (!live()) { toast('รายงานสถานการณ์ใช้ได้ในโหมดสมาชิกเท่านั้น'); return; }
    try { await R.loadEmergencyConfig(); } catch (err) { toast(R.errorText(err)); return; }
    if (!cfg().available) { openDialog('รายงานสถานการณ์', `<p class="emg-notice" role="status">${MIGRATION_MSG}</p>`); return; }
    const types = rules();
    openDialog('รายงานสถานการณ์', `<form id="emergency-form" class="emergency-form" novalidate>
      <fieldset><legend>1. เกิดอะไรขึ้น?</legend><div class="emg-type-grid">${types.map(r => `<label class="emg-type"><input type="radio" name="type_code" value="${esc(r.type_code)}" required><span><b aria-hidden="true">${categoryIcon(r)}</b>${esc(r.label_th)}</span></label>`).join('')}</div></fieldset>
      <div id="emg-help-slot"></div>
      <fieldset><legend>2. อยู่ที่ไหน?</legend><div id="emg-precision"></div><button type="button" class="secondary" id="emg-gps">📍 ใช้ตำแหน่งปัจจุบัน</button><div class="location-picker emg-picker" aria-label="แตะแผนที่เพื่อปักหมุด"></div><div class="coordinate-fields"><label class="form-field">ละติจูด<input name="latitude" type="number" step="any" min="-90" max="90"></label><label class="form-field">ลองจิจูด<input name="longitude" type="number" step="any" min="-180" max="180"></label></div><p class="form-help" id="emg-loc-preview"></p></fieldset>
      <fieldset><legend>3. เห็นเมื่อไร?</legend>${chips('when', WHEN, '0')}<input type="time" name="when_time" hidden aria-label="เวลาที่เห็น"></fieldset>
      <fieldset id="emg-specific" hidden><legend>4. รายละเอียด</legend><div id="emg-specific-body"></div></fieldset>
      <label class="form-field">รายละเอียดเพิ่มเติม (ไม่บังคับ)<textarea name="note" maxlength="300" placeholder="เช่น หน้าตลาด น้ำยังไหลแรง"></textarea></label>
      <label class="photo-upload">${icon('camera')}<input id="emg-photo" type="file" accept="image/png,image/jpeg,image/webp" aria-label="แนบรูป (ไม่บังคับ)"></label><div id="emg-photo-preview"></div>
      <p class="form-help">รายงานนี้เป็น <b>รายงานจากชุมชน</b> แสดงพร้อมเวลาและหมดอายุอัตโนมัติ · ไม่ใช้เป็นการรับรองความปลอดภัยของเส้นทาง</p>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-submit"><button class="secondary" type="button" data-action="close-dialog">ยกเลิก</button><button class="primary" type="submit">เผยแพร่รายงาน</button></div></form>`);
    const form = document.getElementById('emergency-form');
    const showError = m => { const el = form.querySelector('.form-error'); el.textContent = m; el.hidden = !m; if (m) el.scrollIntoView({ block: 'nearest' }); };
    let picker = null, photo = null, active = true;
    const lat = form.latitude, lng = form.longitude, preview = document.getElementById('emg-loc-preview');
    const type = () => form.querySelector('[name=type_code]:checked')?.value;
    const precision = () => form.querySelector('[name=location_precision]:checked')?.value;
    const updatePreview = () => {
      if (!lat.value || !lng.value) { preview.textContent = 'ยังไม่ได้เลือกตำแหน่ง · แตะแผนที่หรือใช้ GPS'; return; }
      picker?.pin({ latitude: +lat.value, longitude: +lng.value });
      preview.textContent = `${E.PRECISION_LABEL[precision()] || ''} · เซิร์ฟเวอร์จะปัดพิกัดตามความละเอียดที่เลือกก่อนเผยแพร่`;
    };
    const setPoint = (a, b) => { if (!active) return; lat.value = (+a).toFixed(6); lng.value = (+b).toFixed(6); updatePreview(); };
    function onType() {
      const t = type(), r = ruleOf(t);
      document.getElementById('emg-precision').innerHTML = chips('location_precision', r.allowed_precisions.map(p => [p, E.PRECISION_LABEL[p]]), r.allowed_precisions.includes('approximate') && t === 'help_request' ? 'approximate' : r.allowed_precisions[0]);
      document.getElementById('emg-help-slot').innerHTML = t === 'help_request' ? helpNotice() : '';
      const body = document.getElementById('emg-specific-body');
      let html = '';
      if (t === 'flood') html = `<p class="emg-sub">ระดับน้ำ</p>${chips('water_depth', E.DEPTHS, 'unknown')}<p class="emg-sub">การผ่านของรถ (ตามที่คุณเห็น)</p>${chips('vehicle_access', E.VEHICLES, 'unknown')}`;
      else if (t === 'road_passable' || t === 'road_blocked') html = `<p class="emg-sub">การผ่านของรถ (ตามที่คุณเห็น)</p>${chips('vehicle_access', E.VEHICLES, t === 'road_blocked' ? 'general_impassable' : 'general_passable')}`;
      else if (t === 'help_request') html = `<p class="emg-sub">ต้องการอะไร</p>${chips('need_code', E.NEEDS, 'water')}<label class="form-field">จำนวนคนโดยประมาณ (ไม่บังคับ)<input name="people_count" type="number" min="1" max="999" inputmode="numeric"></label><p class="form-help">อย่าใส่ชื่อ เบอร์โทร บ้านเลขที่ หรือข้อมูลส่วนตัวในรายงานสาธารณะ</p>`;
      body.innerHTML = html; document.getElementById('emg-specific').hidden = !html;
      form.querySelectorAll('[name=location_precision]').forEach(i => i.addEventListener('change', updatePreview));
      if (!picker) { try { picker = Provider.create(form.querySelector('.emg-picker'), { center: [13.75, 100.5], zoom: 10, onPick: setPoint }); } catch { /* manual coordinates still work */ } }
      updatePreview();
    }
    form.querySelectorAll('[name=type_code]').forEach(i => i.addEventListener('change', onType));
    form.querySelectorAll('[name=when]').forEach(i => i.addEventListener('change', () => { form.when_time.hidden = form.querySelector('[name=when]:checked').value !== 'custom'; }));
    lat.addEventListener('change', updatePreview); lng.addEventListener('change', updatePreview);
    document.getElementById('emg-gps').addEventListener('click', () => {
      if (!navigator.geolocation) { showError('เบราว์เซอร์นี้ไม่รองรับตำแหน่ง แตะแผนที่หรือกรอกพิกัดได้'); return; }
      preview.textContent = 'กำลังขอตำแหน่ง…';
      navigator.geolocation.getCurrentPosition(pos => { setPoint(pos.coords.latitude, pos.coords.longitude); picker?.setView(pos.coords.latitude, pos.coords.longitude, 15); },
        () => { if (active) showError('ขอตำแหน่งไม่ได้ แตะแผนที่หรือกรอกพิกัดเองได้'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
    document.getElementById('emg-photo').addEventListener('change', async ev => {
      const file = ev.target.files[0]; photo = null; document.getElementById('emg-photo-preview').innerHTML = ''; if (!file) return;
      try { photo = await Store.prepareImage(file); document.getElementById('emg-photo-preview').innerHTML = `<img class="compose-preview" src="${photo.dataUrl}" alt="ภาพที่เลือก">`; }
      catch { ev.target.value = ''; showError('เลือกภาพ PNG, JPG หรือ WebP ขนาดไม่เกิน 15 MB'); }
    });
    pickerCleanup = () => { active = false; picker?.destroy(); picker = null; };
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); showError('');
      const d = readForm(form);
      const problem = E.validateDraft(d, rules());
      if (problem) { showError(problem); return; }
      const btn = form.querySelector('[type=submit]'); busyBtn(btn, true, 'กำลังเผยแพร่…');
      try {
        const text = E.storyText(d, rules());
        const post = await R.createEmergency({ ...text, image: photo, report: d });
        closeDialog(); toast('เผยแพร่รายงานสถานการณ์แล้ว · แสดงพร้อมเวลาที่รายงาน');
        const e = post?.emergency;
        if (e) { pendingFocus = { id: e.id, latitude: e.latitude, longitude: e.longitude }; navigate('map?mode=emergency&emergency=' + e.id); }
        else navigate('map?mode=emergency');
      } catch (err) { busyBtn(btn, false); showError(R.errorText(err)); }
    });
  }
  function readForm(form) {
    const val = n => form.querySelector(`[name=${n}]:checked`)?.value;
    const when = val('when') || '0';
    let reported;
    if (when === 'custom' && form.when_time.value) {
      const [h, m] = form.when_time.value.split(':').map(Number); const t = new Date(now()); t.setHours(h, m, 0, 0);
      if (t.getTime() > now() + 60000) t.setDate(t.getDate() - 1);
      reported = t.toISOString();
    } else reported = new Date(now() - Number(when === 'custom' ? 0 : when) * 60000).toISOString();
    const t = val('type_code');
    return {
      type_code: t, location_precision: val('location_precision'), latitude: form.latitude.value, longitude: form.longitude.value,
      reported_at: reported,
      water_depth: t === 'flood' ? val('water_depth') : undefined,
      vehicle_access: ['flood', 'road_passable', 'road_blocked'].includes(t) ? val('vehicle_access') : undefined,
      need_code: t === 'help_request' ? val('need_code') : undefined,
      people_count: t === 'help_request' && form.people_count?.value ? Number(form.people_count.value) : undefined,
      note: String(form.note.value || '').trim()
    };
  }
  const busyBtn = (b, on, text) => { if (!b) return; if (on) { b.dataset.label = b.textContent; b.textContent = text; b.disabled = true; } else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; } };

  /* ---------------------------------------------------------------- owner actions */
  function updateDialog(e) {
    let body = '';
    if (e.type_code === 'flood') body = `<p class="emg-sub">ระดับน้ำตอนนี้</p>${chips('water_depth', E.DEPTHS, e.water_depth || 'unknown')}<p class="emg-sub">การผ่านของรถ</p>${chips('vehicle_access', E.VEHICLES, e.vehicle_access || 'unknown')}`;
    else if (e.type_code === 'road_passable' || e.type_code === 'road_blocked') body = `<p class="emg-sub">การผ่านของรถ</p>${chips('vehicle_access', E.VEHICLES, e.vehicle_access || 'unknown')}`;
    else if (e.type_code === 'help_request') body = `<p class="emg-sub">ต้องการอะไร</p>${chips('need_code', E.NEEDS, e.need_code || 'other')}<label class="form-field">จำนวนคนโดยประมาณ<input name="people_count" type="number" min="1" max="999" value="${e.people_count || ''}"></label>`;
    openDialog('อัปเดตสถานการณ์', `<form id="emergency-update-form"><p class="form-help">การอัปเดตจะบันทึกเป็นรายงานใหม่ ณ เวลานี้ ประวัติเดิมยังเก็บไว้</p>${body}<label class="form-field">เกิดอะไรขึ้นเพิ่มเติม (ไม่บังคับ)<textarea name="note" maxlength="300"></textarea></label><p class="form-error" role="alert" hidden></p><div class="form-submit"><button class="secondary" type="button" data-action="close-dialog">ยกเลิก</button><button class="primary" type="submit">บันทึกการอัปเดต</button></div></form>`);
    const form = document.getElementById('emergency-update-form');
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const val = n => form.querySelector(`[name=${n}]:checked`)?.value;
      const upd = { note: String(form.note.value || '').trim() };
      if (form.querySelector('[name=water_depth]')) upd.water_depth = val('water_depth');
      if (form.querySelector('[name=vehicle_access]')) upd.vehicle_access = val('vehicle_access');
      if (form.querySelector('[name=need_code]')) { upd.need_code = val('need_code'); upd.people_count = form.people_count.value ? Number(form.people_count.value) : null; }
      const btn = form.querySelector('[type=submit]'); busyBtn(btn, true, 'กำลังบันทึก…');
      try { await R.updateEmergency(e.id, upd); closeDialog(); toast('อัปเดตสถานการณ์แล้ว'); refreshAfterChange(e.id); }
      catch (err) { busyBtn(btn, false); const el = form.querySelector('.form-error'); el.textContent = R.errorText(err); el.hidden = false; }
    });
  }
  async function resolve(e, btn) {
    busyBtn(btn, true, '…');
    try { await R.updateEmergency(e.id, { emergency_status: 'resolved' }); toast('ทำเครื่องหมายว่าคลี่คลายแล้ว · รายงานย้ายไปอยู่ในประวัติ'); refreshAfterChange(e.id); }
    catch (err) { busyBtn(btn, false); toast(R.errorText(err)); }
  }
  function deleteConfirm(e) {
    openDialog('ลบรายงานสถานการณ์?', `<p class="form-help">รายงานและประวัติการอัปเดตจะถูกลบถาวร ถ้าสถานการณ์จบแล้ว แนะนำให้กด “คลี่คลายแล้ว” แทน เพื่อให้คนอื่นเห็นประวัติ</p><div class="form-submit"><button class="secondary" data-action="close-dialog">ยกเลิก</button><button class="primary danger-fill" data-emg="delete-confirm" data-id="${esc(e.id)}">ลบรายงาน</button></div>`);
  }
  function reportDialog(e) {
    openDialog('รายงานข้อมูลสถานการณ์', `<form id="emergency-report-form"><p class="form-help">บอกทีมดูแลว่ารายงานนี้มีปัญหาอะไร ผู้รายงานจะไม่รู้ว่าใครแจ้ง</p><fieldset class="reason-list"><legend class="sr-only">เหตุผล</legend>${REPORT_REASONS.map(([v, t], i) => `<label class="reason"><input type="radio" name="reason" value="${v}" ${i === 0 ? 'required' : ''}><span>${t}</span></label>`).join('')}</fieldset><label class="form-field">รายละเอียดเพิ่มเติม (ไม่บังคับ)<textarea name="note" maxlength="300"></textarea></label><p class="form-error" role="alert" hidden></p><div class="form-submit"><button class="secondary" type="button" data-action="close-dialog">ยกเลิก</button><button class="primary" type="submit">ส่งรายงาน</button></div></form>`);
    const form = document.getElementById('emergency-report-form');
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const d = new FormData(form), err = form.querySelector('.form-error');
      if (!d.get('reason')) { err.textContent = 'เลือกเหตุผลก่อนส่งรายงาน'; err.hidden = false; return; }
      const btn = form.querySelector('[type=submit]'); busyBtn(btn, true, 'กำลังส่ง…');
      try { await R.report(e.post_id, String(d.get('reason')), String(d.get('note') || '').trim()); closeDialog(); toast('ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลข้อมูลสถานการณ์'); }
      catch (x) { busyBtn(btn, false); err.textContent = x?.code === '23514' ? 'ฐานข้อมูลยังไม่รองรับเหตุผลนี้ — รัน migration 20261001090000_emergency_reports.sql ก่อน' : R.errorText(x); err.hidden = false; }
    });
  }
  function refreshAfterChange(id) { if (ctx) { ctx.focus = id; if (!filters.history) filters.history = true; renderSlot(); load(); } else render(); }

  /* ---------------------------------------------------------------- Feed / Profile card */
  const basePostMarkup = postMarkup;
  postMarkup = function (p) {
    let html = basePostMarkup(p);
    const e = p.emergency;
    if (!e) return html;
    const r = ruleOf(e.type_code), f = E.freshness(e, rules(), now());
    const block = `<div class="emg-feed-card emg-${f.state}"><div class="emg-chips-row"><span class="emg-feed-type">${categoryIcon(r)} ${esc(r.label_th)}</span>${freshChip(f)}${sourceChip(e)}</div><strong>${esc(E.headline(e))}</strong><small>${esc(f.reportedAgo)} · เวลา ${esc(E.clockTime(e.reported_at))}${f.current ? '' : ' · ไม่ใช่ข้อมูลปัจจุบัน'}</small>${E.staleWarning(e, rules(), now()) ? `<small class="emg-stale">⚠︎ ${esc(E.staleWarning(e, rules(), now()))}</small>` : ''}<button class="secondary" data-emergency-map="${esc(e.id)}" data-lat="${e.latitude}" data-lng="${e.longitude}">🆘 ดูบนแผนที่สถานการณ์</button></div>`;
    return html.replace('<div class="post-actions">', block + '<div class="post-actions">');
  };

  /* ---------------------------------------------------------------- photo viewer */
  // Lightweight viewer on a native <dialog> (top layer: above top bar, bottom nav and map controls; Esc closes).
  function openPhoto(src, alt) {
    if (!src) return;
    let v = document.getElementById('emg-photo-viewer');
    if (!v) {
      v = document.createElement('dialog'); v.id = 'emg-photo-viewer'; v.className = 'emg-lightbox'; v.setAttribute('aria-label', 'ดูรูปขนาดใหญ่');
      v.innerHTML = '<button type="button" class="emg-lightbox-close" aria-label="ปิดรูป">×</button><img alt="">';
      v.addEventListener('click', ev => { if (ev.target === v || ev.target.closest('.emg-lightbox-close')) v.close(); });
      v.addEventListener('close', () => { v.querySelector('img').removeAttribute('src'); v._opener?.focus?.(); });
      document.body.appendChild(v);
    }
    const img = v.querySelector('img'); img.src = src; img.alt = alt || 'ภาพประกอบรายงาน';
    v._opener = document.activeElement;
    if (typeof v.showModal === 'function') { if (!v.open) v.showModal(); } else v.setAttribute('open', '');
    v.querySelector('.emg-lightbox-close').focus();
  }
  // Fade hint on the category chip row: show an edge fade only where more chips are hidden.
  let chipRow = null;
  const chipFade = () => { const row = chipRow; if (!row || !row.isConnected) return; const max = row.scrollWidth - row.clientWidth - 2; row.classList.toggle('fade-start', row.scrollLeft > 2); row.classList.toggle('fade-end', row.scrollLeft < max); };
  addEventListener('resize', chipFade, { passive: true });
  function chipEdges(row) {
    chipRow = row; if (!row) return;
    row.addEventListener('scroll', chipFade, { passive: true });
    const a = row.querySelector('.active'); if (a && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, a.offsetLeft - row.offsetLeft - 24);
    chipFade();
  }

  /* ---------------------------------------------------------------- events */
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-emg],[data-emg-select],[data-emg-type],[data-emergency-map],[data-action="emergency-report"]');
    if (!b) return;
    if (b.dataset.action === 'emergency-report') { ev.preventDefault(); composer(); return; }
    if (b.dataset.emergencyMap) { ev.preventDefault(); pendingFocus = { id: b.dataset.emergencyMap, latitude: +b.dataset.lat, longitude: +b.dataset.lng }; navigate('map?mode=emergency&emergency=' + b.dataset.emergencyMap); return; }
    if (b.dataset.emgSelect) { const e = ctx?.rows.find(x => x.id === b.dataset.emgSelect); if (e) { lastDetail = e; select(e); ctx.provider.setView(e.latitude, e.longitude, Math.max(14, ctx.provider.view().zoom)); } return; }
    if (b.dataset.emgType !== undefined) { filters.types = b.dataset.emgType ? [b.dataset.emgType] : null; renderSlot(); load(); return; }
    const act = b.dataset.emg, e = rowById(b.dataset.id);
    if (act === 'banner-close') { bannerClosed = true; try { sessionStorage.setItem('gerarai-emergency-banner', 'closed'); } catch { /* ignore */ } b.closest('.emg-banner')?.remove(); return; }
    if (act === 'close') return;
    if (act === 'photo') { openPhoto(b.dataset.src, b.querySelector('img')?.alt || ''); return; }
    if (!R?.user && ['update', 'resolve', 'delete', 'report'].includes(act)) { document.querySelector('.avatar-header')?.click(); return; }
    if (act === 'update' && e) updateDialog(e);
    else if (act === 'resolve' && e) resolve(e, b);
    else if (act === 'delete' && e) deleteConfirm(e);
    else if (act === 'report' && e) reportDialog(e);
    else if (act === 'delete-confirm') {
      const target = ctx?.rows.find(x => x.id === b.dataset.id) || lastDetail; if (!target) return;
      busyBtn(b, true, 'กำลังลบ…');
      R.deletePost(target.post_id).then(() => { closeDialog(); toast('ลบรายงานสถานการณ์แล้ว'); if (ctx) { ctx.selection = null; ctx.els.selected.innerHTML = ''; load(); } else render(); }).catch(err => { busyBtn(b, false); toast(R.errorText(err)); });
    }
  });
  document.addEventListener('change', ev => {
    const t = ev.target.closest('[data-emg-toggle]'); if (!t) return;
    filters[t.dataset.emgToggle] = t.checked; load();
  });
  dialog.addEventListener('close', () => { pickerCleanup?.(); pickerCleanup = null; });

  window.GerarAIEmergencyUI = Object.freeze({ attach, detach, moved, composer, helpNotice });
})();
