'use strict';
/* GERARAI — Character Identity / Life Class foundation
 * - Pixel avatar renderer/editor data contract
 * - Life Class catalog (progression write is server-only; client never grants XP)
 */
(function () {
  const SKINS = {
    sand:'#f3c58f', warm:'#d99b68', tan:'#b87952', deep:'#7b4d35'
  };
  const HAIRS = {
    ink:'#202838', brown:'#5b3a29', chestnut:'#8a5234', copper:'#b65a3c', gold:'#d5a640', silver:'#88909e'
  };
  const OUTFITS = {
    moss:'#37634f', ocean:'#3268b7', clay:'#b85e46', amber:'#c68b33', plum:'#76558e', slate:'#526174'
  };
  const ACCESSORIES = ['none','backpack','cap','camera','glasses'];
  const HAIR_STYLES = ['short','wave','crop','long','spike'];

  const DEFAULT_SPEC = Object.freeze({
    skin:'warm', hairStyle:'short', hair:'ink', outfit:'moss', accessory:'backpack'
  });

  const CLASSES = Object.freeze([
    {code:'wanderer', icon:'🧭', th:'นักเดินทาง', en:'Wanderer', desc:'จุดเริ่มต้นของทุกการผจญภัย'},
    {code:'adventurer', icon:'⚔️', th:'นักผจญภัย', en:'Adventurer', desc:'ค้นพบสถานที่ใหม่ จุดลับ และเรื่องราวระหว่างทาง'},
    {code:'merchant', icon:'🛒', th:'นักค้า', en:'Merchant', desc:'ตลาด ร้านเล็ก งานคราฟต์ และโลกของการแลกเปลี่ยน'},
    {code:'artist', icon:'🎨', th:'ศิลปิน', en:'Artist', desc:'ศิลปะ ดนตรี ภาพถ่าย และงานสร้างสรรค์'},
    {code:'gourmet', icon:'🍜', th:'นักชิม', en:'Gourmet', desc:'อาหาร คาเฟ่ และรสชาติท้องถิ่น'},
    {code:'scholar', icon:'📚', th:'นักเรียนรู้', en:'Scholar', desc:'ประวัติศาสตร์ วัฒนธรรม และความรู้จากโลกจริง'},
    {code:'naturalist', icon:'🌿', th:'นักธรรมชาติ', en:'Naturalist', desc:'สัตว์ พืช ป่า ภูเขา และสายน้ำ'},
    {code:'chronicler', icon:'📷', th:'นักบันทึก', en:'Chronicler', desc:'บันทึกผู้คน เหตุการณ์ และช่วงเวลาของชีวิต'},
    {code:'maker', icon:'🔧', th:'นักสร้าง', en:'Maker', desc:'DIY งานช่าง เทคโนโลยี และสิ่งประดิษฐ์'},
    {code:'helper', icon:'🤝', th:'ผู้ช่วยเหลือ', en:'Helper', desc:'ข้อมูลที่มีประโยชน์และการช่วยเหลือชุมชน'}
  ]);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed = (value, dict, fallback) => Object.prototype.hasOwnProperty.call(dict, value) ? value : fallback;

  function normalizeSpec(input) {
    const s = input && typeof input === 'object' ? input : {};
    return {
      skin: allowed(s.skin, SKINS, DEFAULT_SPEC.skin),
      hairStyle: HAIR_STYLES.includes(s.hairStyle) ? s.hairStyle : DEFAULT_SPEC.hairStyle,
      hair: allowed(s.hair, HAIRS, DEFAULT_SPEC.hair),
      outfit: allowed(s.outfit, OUTFITS, DEFAULT_SPEC.outfit),
      accessory: ACCESSORIES.includes(s.accessory) ? s.accessory : DEFAULT_SPEC.accessory
    };
  }

  function hairRects(style, color) {
    const common = `<rect x="18" y="10" width="28" height="6" fill="${color}"/><rect x="16" y="14" width="6" height="12" fill="${color}"/>`;
    if (style === 'wave') return common + `<rect x="42" y="14" width="6" height="16" fill="${color}"/><rect x="20" y="8" width="8" height="5" fill="${color}"/><rect x="34" y="7" width="8" height="6" fill="${color}"/>`;
    if (style === 'crop') return `<rect x="18" y="9" width="28" height="8" fill="${color}"/><rect x="16" y="13" width="5" height="8" fill="${color}"/>`;
    if (style === 'long') return common + `<rect x="42" y="14" width="6" height="25" fill="${color}"/><rect x="16" y="21" width="6" height="18" fill="${color}"/>`;
    if (style === 'spike') return common + `<rect x="20" y="5" width="6" height="7" fill="${color}"/><rect x="29" y="3" width="6" height="9" fill="${color}"/><rect x="38" y="6" width="6" height="7" fill="${color}"/>`;
    return common + `<rect x="42" y="14" width="5" height="9" fill="${color}"/>`;
  }

  function accessoryRects(type) {
    if (type === 'backpack') return `<rect x="10" y="37" width="7" height="18" rx="1" fill="#8b5a37"/><rect x="12" y="39" width="4" height="10" fill="#b77a49"/>`;
    if (type === 'cap') return `<rect x="18" y="7" width="27" height="5" fill="#274c77"/><rect x="42" y="11" width="9" height="4" fill="#274c77"/>`;
    if (type === 'camera') return `<rect x="25" y="41" width="15" height="10" rx="1" fill="#303641"/><rect x="30" y="43" width="6" height="6" fill="#9fb9c9"/><rect x="28" y="38" width="9" height="4" fill="#4b5664"/>`;
    if (type === 'glasses') return `<rect x="22" y="23" width="8" height="5" fill="none" stroke="#263142" stroke-width="2"/><rect x="34" y="23" width="8" height="5" fill="none" stroke="#263142" stroke-width="2"/><rect x="30" y="24" width="4" height="2" fill="#263142"/>`;
    return '';
  }

  function sprite(spec, label='ตัวละคร GERARAI') {
    const s = normalizeSpec(spec), skin = SKINS[s.skin], hair = HAIRS[s.hair], outfit = OUTFITS[s.outfit];
    return `<svg class="pixel-sprite" viewBox="0 0 64 64" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges">
      <rect x="20" y="14" width="24" height="20" rx="2" fill="${skin}"/>
      <rect x="17" y="21" width="4" height="8" fill="${skin}"/><rect x="43" y="21" width="4" height="8" fill="${skin}"/>
      ${hairRects(s.hairStyle, hair)}
      <rect x="25" y="23" width="3" height="3" fill="#202838"/><rect x="36" y="23" width="3" height="3" fill="#202838"/>
      <rect x="30" y="29" width="5" height="2" fill="#b56f64"/>
      <rect x="18" y="34" width="28" height="21" rx="2" fill="${outfit}"/>
      <rect x="13" y="36" width="6" height="17" fill="${skin}"/><rect x="45" y="36" width="6" height="17" fill="${skin}"/>
      <rect x="22" y="54" width="8" height="8" fill="#334153"/><rect x="34" y="54" width="8" height="8" fill="#334153"/>
      <rect x="21" y="61" width="10" height="3" fill="#202838"/><rect x="33" y="61" width="10" height="3" fill="#202838"/>
      ${accessoryRects(s.accessory)}
    </svg>`;
  }

  function optionMarkup(label, name, values, current, palette) {
    return `<fieldset class="character-field"><legend>${label}</legend><div class="character-options">${values.map(v => {
      const text = typeof v === 'string' ? v : v.id, val = typeof v === 'string' ? v : v.id;
      const swatch = palette?.[val] ? `<i style="--swatch:${palette[val]}"></i>` : '';
      const title = typeof v === 'string' ? v : v.label;
      return `<label class="character-choice ${current===val?'selected':''}"><input type="radio" name="${name}" value="${esc(val)}" ${current===val?'checked':''}>${swatch}<span>${esc(title)}</span></label>`;
    }).join('')}</div></fieldset>`;
  }

  function editorMarkup(spec) {
    const s = normalizeSpec(spec);
    return `<div class="character-editor" id="pixel-character-editor">
      ${optionMarkup('สีผิว','px-skin',Object.keys(SKINS).map((id,i)=>({id,label:['อ่อน','อบอุ่น','แทน','เข้ม'][i]})),s.skin,SKINS)}
      ${optionMarkup('ทรงผม','px-hair-style',[
        {id:'short',label:'สั้น'},{id:'wave',label:'ลอน'},{id:'crop',label:'ครอป'},{id:'long',label:'ยาว'},{id:'spike',label:'ตั้ง'}],s.hairStyle)}
      ${optionMarkup('สีผม','px-hair',Object.keys(HAIRS).map((id,i)=>({id,label:['ดำ','น้ำตาล','เกาลัด','ทองแดง','ทอง','เงิน'][i]})),s.hair,HAIRS)}
      ${optionMarkup('ชุด','px-outfit',Object.keys(OUTFITS).map((id,i)=>({id,label:['มอส','น้ำเงิน','ดินเผา','อำพัน','พลัม','สเลต'][i]})),s.outfit,OUTFITS)}
      ${optionMarkup('ของติดตัว','px-accessory',[
        {id:'none',label:'ไม่มี'},{id:'backpack',label:'เป้'},{id:'cap',label:'หมวก'},{id:'camera',label:'กล้อง'},{id:'glasses',label:'แว่น'}],s.accessory)}
    </div>`;
  }

  function specFromForm(root=document) {
    const val = name => root.querySelector(`[name="${name}"]:checked`)?.value;
    return normalizeSpec({skin:val('px-skin'),hairStyle:val('px-hair-style'),hair:val('px-hair'),outfit:val('px-outfit'),accessory:val('px-accessory')});
  }

  function randomSpec() {
    const pick = a => a[Math.floor(Math.random()*a.length)];
    return {skin:pick(Object.keys(SKINS)),hairStyle:pick(HAIR_STYLES),hair:pick(Object.keys(HAIRS)),outfit:pick(Object.keys(OUTFITS)),accessory:pick(ACCESSORIES)};
  }

  function classByCode(code) { return CLASSES.find(c => c.code===code) || CLASSES[0]; }
  function normalizeProgress(rows) {
    const valid = Array.isArray(rows) ? rows.filter(r => CLASSES.some(c => c.code === r.class_code)) : [];
    if (!valid.some(r => r.class_code === 'wanderer')) valid.unshift({class_code:'wanderer',level:1,xp:0});
    return valid.map(r => ({class_code:r.class_code,level:Math.max(1,Number(r.level)||1),xp:Math.max(0,Number(r.xp)||0)}));
  }
  // Primary class = the one stored on the server (user_progression.primary_class_code) if it is unlocked.
  // Never auto-picks another class: without a stored choice the member is shown as Wanderer.
  function primaryProgress(rows, primaryCode = 'wanderer') {
    const all = normalizeProgress(rows);
    return all.find(r => r.class_code === primaryCode) || all.find(r => r.class_code === 'wanderer');
  }
  const NO_SOURCE = new Set(['merchant','scholar','maker']);   // no trusted evidence source in ruleset v1
  /* opts: { primary, summary (my_progression_summary), selectable, live } */
  function pathDialogMarkup(rows, opts = {}) {
    const progress = new Map(normalizeProgress(rows).map(r=>[r.class_code,r]));
    const primary = progress.has(opts.primary) ? opts.primary : 'wanderer';
    const metrics = new Map((opts.summary?.classes || []).map(c=>[c.code,c]));
    const need = opts.summary?.unlock || { min_events: 3, min_cells: 3, min_days: 2 };
    const intro = opts.live
      ? 'อาชีพใน GERARAI ไม่ใช่งานจริงของคุณ แต่เป็นเส้นทางที่เปิดจาก Discovery ที่คุณเผยแพร่ ระบบคำนวณบนเซิร์ฟเวอร์เท่านั้น เปิดได้หลายอาชีพ และเลือกอาชีพหลักจากอาชีพที่เปิดแล้ว'
      : 'อาชีพใน GERARAI ไม่ใช่งานจริงของคุณ แต่เป็นเส้นทางที่โลกจริงค่อย ๆ เปิดจาก Story และ Discovery ของคุณ โหมดต้นแบบไม่คำนวณ XP';
    return `<p class="form-help">${intro}</p><div class="class-path-grid">${CLASSES.map(c=>{
      const p=progress.get(c.code), unlocked=!!p, m=metrics.get(c.code), isPrimary=unlocked&&c.code===primary;
      let foot;
      if (unlocked) foot = `<b>Lv.${p.level} · ${Number(p.xp).toLocaleString('th-TH')} XP${isPrimary?' · อาชีพหลัก':''}</b>${opts.selectable&&!isPrimary?`<button class="secondary set-primary" data-action="set-primary-class" data-class="${esc(c.code)}">ตั้งเป็นอาชีพหลัก</button>`:''}`;
      else if (NO_SOURCE.has(c.code) || (m && m.has_evidence_source === false)) foot = '<b>🔒 ยังไม่เปิดในรุ่นนี้</b><small class="class-path-need">ยังไม่มีหลักฐานจากหมวด Discovery ที่ตรงกับอาชีพนี้</small>';
      else if (m) foot = `<b>🔒 ยังไม่ค้นพบ</b><small class="class-path-need">${Math.min(m.events,need.min_events)}/${need.min_events} Discovery · ${Math.min(m.cells,need.min_cells)}/${need.min_cells} พื้นที่ · ${Math.min(m.days,need.min_days)}/${need.min_days} วัน</small>`;
      else foot = '<b>🔒 ยังไม่ค้นพบ</b>';
      const merchantNote = c.code==='merchant' ? '<small class="class-path-need">อาชีพนี้ไม่ใช่การยืนยันผู้ขายหรือคะแนนความน่าเชื่อถือ</small>' : '';
      return `<article class="class-path-card ${unlocked?'unlocked':'locked'} ${isPrimary?'is-primary':''}"><span class="class-path-icon">${c.icon}</span><div><h3>${esc(c.en)} <small>${esc(c.th)}</small></h3><p>${esc(c.desc)}</p>${foot}${merchantNote}</div></article>`;
    }).join('')}</div>${opts.live?`<p class="form-help class-path-rule">ปลดล็อกเมื่อมี Discovery ตำแหน่งแม่นยำหรือโดยประมาณในหมวดที่ตรงกัน อย่างน้อย ${need.min_events} ครั้ง ใน ${need.min_cells} พื้นที่ และ ${need.min_days} วันที่ต่างกัน · Discovery ที่ซ่อนตำแหน่งไม่นับ</p>`:''}`;
  }

  window.GerarAICharacter = Object.freeze({
    DEFAULT_SPEC, CLASSES, SKINS, HAIRS, OUTFITS, ACCESSORIES, HAIR_STYLES,
    normalizeSpec, sprite, editorMarkup, specFromForm, randomSpec,
    classByCode, normalizeProgress, primaryProgress, pathDialogMarkup
  });
})();
