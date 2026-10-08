'use strict';
// Drafts live in memory, outside any dialog DOM. No GPS/map/provider request on open.
(()=>{
 const R=window.GerarAIRemote;if(!R?.enabled)return;
 const drafts=new Map();let current=null,generation=0,picker=null;
 const labels={none:'ไม่เช็กอิน',area:'พื้นที่',venue:'สถานที่',current_location:'ตำแหน่งปัจจุบัน',map_pin:'จุดบนแผนที่',legacy_unconfirmed:'เช็กอินเดิม'};
 const meaningful=s=>!!String(s||'').replace(/[\p{White_Space}\p{Cf}\p{Cc}]/gu,'');
 const extractTags=body=>[...new Set([...body.matchAll(/#([\p{L}\p{M}\p{N}_]+)/gu)].map(m=>m[1]))].slice(0,10);
 function cleanup(){generation++;picker?.destroy();picker=null;}
 const previousOpen=openDialog;
 openDialog=function(...args){cleanup();dialogContent.classList.remove('s4-composer');return previousOpen(...args);};
 const valid=(d,g)=>current===d&&generation===g&&dialog.open&&d.owner===R.user?.id;
 function shell(d,title,html){cleanup();document.getElementById('dialog-title').textContent=title;dialogContent.innerHTML=html;dialogContent.classList.add('s4-composer');return generation;}
 function error(message){const e=dialogContent.querySelector('[data-s4-error]');if(e){e.textContent=message;e.hidden=!message;}}
 const errbox='<p data-s4-error class="form-error" role="alert" hidden></p>';
 function nameOf(d){return d.label||labels[d.initial?.kind]||'';}
 function main(d,message=''){
  current=d;const locked=d.busy||d.uncertain;
  shell(d,d.edit?'แก้ไขเรื่องราว':'วันนี้คุณเจออะไร?',`<form id="${d.edit?'edit-form':'compose-form'}" data-s4-form>
   <fieldset ${locked?'disabled':''} class="s4-fields">
   <label class="form-field">เรื่องราวของคุณ<textarea name="body" maxlength="2000" placeholder="วันนี้คุณเจออะไร…">${esc(d.body)}</textarea></label>
   <details ${d.title?'open':''}><summary>เพิ่มชื่อเรื่อง (ไม่บังคับ)</summary><label class="form-field">ชื่อเรื่อง<input name="title" maxlength="100" value="${esc(d.title)}"></label></details>
   <label class="photo-upload">${icon('camera')} เพิ่มภาพ<input name="photo" type="file" accept="image/png,image/jpeg,image/webp" aria-label="แนบภาพเรื่องราว"></label>
   <div class="s4-media">${d.media.map((m,i)=>`<div><img src="${esc(m.image?.dataUrl||m.url)}" alt="ภาพที่แนบ"><button type="button" data-s4-media="${i}" aria-label="นำภาพออก">นำภาพออก</button></div>`).join('')}</div>
   <div class="s4-checkin"><button class="secondary" type="button" data-s4="checkin">📍 ${d.checkin.op==='remove'?'Check-in':esc(nameOf(d)||'Check-in')}</button>${d.checkin.op!=='remove'&&nameOf(d)?'<button class="text-button" type="button" data-s4="remove">นำเช็กอินออก</button>':''}</div>
   <div class="s4-consent"></div></fieldset>${errbox}
   ${d.conflict?'<p>เรื่องราวนี้มีการแก้ไขจากที่อื่นแล้ว ข้อความร่างของคุณยังอยู่</p><button type="button" class="secondary" data-s4="reload">โหลดข้อมูลล่าสุดเพื่อตรวจทานก่อนบันทึก</button>':''}
   <div class="form-submit"><button type="button" class="secondary" data-s4="close">เก็บร่างไว้ก่อน</button><button type="submit" class="primary" ${d.busy||d.preparing||d.conflict?'disabled':''}>${d.busy?'กำลังบันทึก…':d.uncertain?'ลองส่งคำขอเดิมอีกครั้ง':d.edit?'บันทึก':'เผยแพร่'}</button></div>
   <button type="button" class="text-button" data-s4="discard" ${locked?'disabled':''}>ทิ้งร่างนี้</button></form>`);
  const form=dialogContent.querySelector('form');
  form._checkinExposure=()=>d.checkin.op==='set'?(d.checkin.kind==='venue'&&d.checkin.disclosure==='venue'?'place':d.checkin.precision==='exact'?'exact':null):null;
  form.addEventListener('input',e=>{if(['body','title'].includes(e.target.name)){d[e.target.name]=e.target.value;d.pending=null;}});
  form.querySelector('[name=photo]').addEventListener('change',async e=>{
   if(d.media.length>=10){error('แนบได้สูงสุด 10 ภาพ');e.target.value='';return;}
   const f=e.target.files[0];if(!f)return;d.preparing=true;const g=generation;
   form.querySelector('[type=submit]').disabled=true;
   let message='';try{const image=await Store.prepareImage(f);if(current===d&&d.owner===R.user?.id){d.media.push({image,ticket:{}});d.mediaChanged=true;d.pending=null;}}
   catch{message='เลือกภาพ PNG, JPG หรือ WebP ไม่เกิน 15 MB';}
   finally{d.preparing=false;if(valid(d,g))main(d,message);}
  });
  form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();save(d);});
  form.querySelectorAll('[data-s4-media]').forEach(b=>b.onclick=()=>{d.media.splice(+b.dataset.s4Media,1);d.mediaChanged=true;d.pending=null;main(d);});
  form.querySelector('[data-s4=checkin]').onclick=()=>choices(d);
  form.querySelector('[data-s4=remove]')?.addEventListener('click',()=>{d.checkin={op:'remove'};d.label='';d.pending=null;main(d);});
  form.querySelector('[data-s4=close]').onclick=()=>closeDialog();
  form.querySelector('[data-s4=discard]').onclick=()=>{drafts.delete(d.key);current=null;closeDialog();};
  form.querySelector('[data-s4=reload]')?.addEventListener('click',async()=>{
   const g=generation;try{const latest=await R.storyCheckinForEdit(d.id);if(!valid(d,g))return;
    // Preserve all explicit draft edits. A keep operation follows the latest server state.
    d.revision=latest.revision;d.initial=latest;
    if(d.checkin.op==='keep'){d.label=latest.kind==='none'?'':labels[latest.kind];d.category=latest.category_code||d.category;}
    if(!d.mediaChanged)d.media=latest.media;
    d.pending=null;d.conflict=false;
    main(d,`อ่านข้อมูลล่าสุดแล้ว (${labels[latest.kind]||'เช็กอินเดิม'}) ร่างที่คุณแก้ยังอยู่ กรุณาตรวจทานก่อนกดบันทึก`);
   }catch(e){if(valid(d,g))error(R.errorText(e));}
  });
  window.GerarAIOnboardingUI?.refreshLocation?.(form);if(message)error(message);
 }
 function back(d){dialogContent.querySelector('[data-s4=back]').onclick=()=>main(d);}
 function choices(d){
  const g=shell(d,'Check-in',`<div class="s4-choices"><label class="form-field">ค้นหาพื้นที่หรือสถานที่<input name="checkin-search" maxlength="100" placeholder="ชื่อเมืองหรือสถานที่"></label><div data-s4-results aria-live="polite"></div><button class="secondary" data-s4="gps">ใช้ตำแหน่งปัจจุบัน</button><button class="secondary" data-s4="map">เลือกจุดบนแผนที่</button></div>${errbox}<button class="text-button" data-s4="back">กลับไปเรื่องราว</button>`);
  back(d);dialogContent.querySelector('[data-s4=gps]').onclick=()=>gps(d);dialogContent.querySelector('[data-s4=map]').onclick=()=>pointStep(d,'map_pin');
  let seq=0,timer;const input=dialogContent.querySelector('[name=checkin-search]');
  async function search(){const q=input.value,run=++seq;const host=dialogContent.querySelector('[data-s4-results]');host.textContent='กำลังค้นหา…';
   try{const [areas,venues]=await Promise.all([R.searchAreas(q),R.searchCheckinVenues(q)]);if(!valid(d,g)||run!==seq)return;
    host.innerHTML=`<h3>พื้นที่ · AREA</h3>${areas.map((a,i)=>`<button class="secondary" data-area-choice="${i}">${esc(a.display_name)}</button>`).join('')||'<p>ไม่พบพื้นที่</p>'}<h3>สถานที่ใน GERARAI · VENUE</h3>${venues.map((v,i)=>`<button class="secondary" data-venue-choice="${i}">${esc(v.name)} · ${esc(v.city||'')}</button>`).join('')||'<p>ไม่พบสถานที่</p>'}`;
    host.querySelectorAll('[data-area-choice]').forEach(b=>b.onclick=()=>reference(d,'area',areas[+b.dataset.areaChoice]));
    host.querySelectorAll('[data-venue-choice]').forEach(b=>b.onclick=()=>reference(d,'venue',venues[+b.dataset.venueChoice]));
   }catch(e){if(valid(d,g)&&run===seq){host.textContent='';error(R.errorText(e));}}
  }
  input.oninput=()=>{seq++;clearTimeout(timer);timer=setTimeout(search,200);};search();
 }
 function reference(d,kind,item){
  const label=kind==='area'?item.display_name:item.name;
  shell(d,kind==='area'?'ยืนยันพื้นที่':'ยืนยันสถานที่',`<p><strong>${esc(label)}</strong></p><p>การเช็กอินนี้ไม่สร้างหมุดบนแผนที่</p><label class="form-field">การแสดงชื่อ<select name="disclosure"><option value="${kind}">${kind==='area'?'แสดงชื่อพื้นที่':'แสดงชื่อสถานที่'}</option><option value="private">เก็บไว้ส่วนตัว</option></select></label>${errbox}<div class="form-submit"><button class="secondary" data-s4="back">ยกเลิก</button><button class="primary" data-s4="confirm">ใช้${kind==='area'?'พื้นที่':'สถานที่'}นี้</button></div>`);back(d);
  dialogContent.querySelector('[data-s4=confirm]').onclick=()=>{
   const disclosure=dialogContent.querySelector('[name=disclosure]').value;
   d.checkin={op:'set',kind,disclosure,...(kind==='area'?{area_id:item.id,confirm_area:disclosure==='area'}:{place_id:item.id})};d.label=label;d.pending=null;main(d);
  };
 }
 function gps(d){
  const g=shell(d,'ตำแหน่งปัจจุบัน',`<p role="status">กำลังขอตำแหน่ง…</p>${errbox}<button class="secondary" data-s4="back">ยกเลิก</button>`);back(d);
  if(!navigator.geolocation){main(d,'อุปกรณ์นี้ไม่รองรับตำแหน่ง เลือกจุดบนแผนที่แทนได้');return;}
  navigator.geolocation.getCurrentPosition(pos=>{if(valid(d,g))pointStep(d,'current_location',{latitude:pos.coords.latitude,longitude:pos.coords.longitude});},e=>{
   if(valid(d,g))main(d,e.code===1?'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง ร่างเรื่องราวยังอยู่':e.code===3?'ขอตำแหน่งหมดเวลา ร่างเรื่องราวยังอยู่':'หาตำแหน่งไม่สำเร็จ ร่างเรื่องราวยังอยู่');
  },{enableHighAccuracy:false,timeout:10000,maximumAge:0});
 }
 async function pointStep(d,kind,point=null){
  const g=shell(d,labels[kind],`<p>${kind==='map_pin'?'แตะเลือกจุด แล้วตรวจทานก่อนยืนยัน':'ตรวจทานตำแหน่งก่อนยืนยัน'}</p><div class="s4-map" aria-label="เลือกจุดบนแผนที่"></div>
   <label class="form-field">ความเป็นส่วนตัว<select name="point-precision"><option value="approximate">บริเวณโดยประมาณ</option><option value="exact">ตำแหน่งตรงจุด</option><option value="hidden">ซ่อนตำแหน่ง</option></select></label>
   <label class="form-field">หมวดการค้นพบ<select name="point-category">${GerarAIDiscovery.categories.map(c=>`<option value="${c.code}" ${c.code===d.category?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>
   <p data-s4-point role="status">ยังไม่ได้เลือกจุด</p>${errbox}<div class="form-submit"><button class="secondary" data-s4="back">ยกเลิก</button><button class="primary" data-s4="confirm" disabled>ใช้จุดนี้</button></div>`);back(d);
  const privacy=dialogContent.querySelector('[name=point-precision]'),confirm=dialogContent.querySelector('[data-s4=confirm]'),preview=dialogContent.querySelector('[data-s4-point]');
  function update(){if(!valid(d,g))return;const good=point&&Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)&&Math.abs(point.latitude)<=90&&Math.abs(point.longitude)<=180;
   confirm.disabled=!good;if(!good)return;
   preview.textContent=privacy.value==='hidden'?'ไม่เก็บพิกัดและไม่แสดงหมุด':privacy.value==='approximate'?'แสดงบริเวณโดยประมาณ ระบบลดความละเอียดก่อนเก็บ':`ตำแหน่งที่เลือก ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
   picker?.pin(privacy.value==='hidden'?null:point);
  }
  privacy.onchange=update;
  confirm.onclick=()=>{if(confirm.disabled)return;const precision=privacy.value,category_code=dialogContent.querySelector('[name=point-category]').value;
   d.category=category_code;d.checkin={op:'set',kind,point_intent:true,precision,category_code,disclosure:'private',...(precision==='hidden'?{}:point)};
   d.label=labels[kind]+' · '+({exact:'ตรงจุด',approximate:'โดยประมาณ',hidden:'ซ่อนตำแหน่ง'}[precision]);d.pending=null;main(d);
  };
  update();try{const map=await GerarAIMapProvider.createAsync(dialogContent.querySelector('.s4-map'),{center:point?[point.latitude,point.longitude]:[16.3,99.9],zoom:point?15:6,onPick:(latitude,longitude)=>{if(valid(d,g)){point={latitude,longitude};update();}},onTiles:good=>{if(!good&&valid(d,g))error('โหลดพื้นแผนที่ไม่ได้ ลองใหม่ภายหลังได้ โดยร่างยังอยู่');}});
   if(!valid(d,g)){map.destroy();return;}picker=map;update();
  }catch(e){if(valid(d,g))error(e.message||'เปิดแผนที่ไม่ได้');}
 }
 async function save(d){
  if(d.busy||d.preparing||d.conflict)return;
  if(!meaningful(d.title)&&!meaningful(d.body)&&!d.media.length){error('เขียนเรื่องราวหรือแนบภาพอย่างน้อยหนึ่งอย่าง');return;}
  d.busy=true;main(d);
  try{
   if(!d.pending){
    const content={title:d.title,body:d.body,tags:extractTags(d.body)};
    if(!d.edit||d.mediaChanged){content.media_ids=[];for(const m of d.media)content.media_ids.push(m.id||await R.stageStoryMedia(m.image,m.ticket));}
    if(d.owner!==R.user?.id)throw new Error('identity_changed');
    d.pending={p_request_id:crypto.randomUUID(),p_post_id:d.id,p_expected_revision:d.revision,p_content:content,p_checkin:structuredClone(d.checkin)};
   }
   const result=await R.mutateStoryCheckin(d.pending);
   drafts.delete(d.key);d.busy=false;d.uncertain=false;
   if(current===d&&dialogContent.querySelector('[data-s4-form]')){current=null;closeDialog();}
   // A failed read/refresh is never treated as a failed write or followed by destructive cleanup.
   try{const post=await R.fetchPost(result.post_id);if(post&&!d.edit)R.data.posts=[post,...R.data.posts.filter(p=>p.id!==post.id)];await R.refreshProgression();}catch{}
   if(d.edit)render();else navigate('feed');toast('บันทึกเรื่องราวแล้ว');dispatchEvent(new CustomEvent('gerarai:story-changed',{detail:{postId:result.post_id}}));
  }catch(e){d.busy=false;if(d.owner!==R.user?.id)return;
   const conflict=e.code==='40001'||/revision_conflict/.test(e.message||'');d.conflict=conflict;
   // A transport failure has an unknown commit outcome: freeze this exact request until resolved.
   d.uncertain=!!d.pending&&!e.code;
   if(!d.uncertain)d.pending=null;
   if(current===d&&dialog.open&&dialogContent.querySelector('[data-s4-form]'))main(d,conflict?'ข้อมูลมีการเปลี่ยนแปลง จึงยังไม่เขียนทับ':d.uncertain?'ยังยืนยันผลการบันทึกไม่ได้ กดลองส่งคำขอเดิมอีกครั้งได้อย่างปลอดภัย':R.errorText(e));
  }
 }
 async function open(id=null){
  if(!R.user){toast('เข้าสู่ระบบก่อนแชร์เรื่องราว');return;}const key=id||'new';let d=drafts.get(key);
  if(d?.busy){current=d;openDialog('กำลังบันทึก','');main(d);return;}
  if(!d){d={key,id:id||crypto.randomUUID(),owner:R.user.id,edit:!!id,revision:-1,title:'',body:'',media:[],mediaChanged:false,category:'other',checkin:{op:'remove'},label:''};
   if(id){current=d;openDialog('แก้ไขเรื่องราว','<p>กำลังโหลด…</p>');const g=++generation;
    try{const state=await R.storyCheckinForEdit(id);if(!valid(d,g))return;Object.assign(d,{revision:state.revision,initial:state,title:state.content.title||'',body:state.content.body||'',media:state.media,category:state.category_code||'other',checkin:{op:'keep'},label:state.kind==='none'?'':labels[state.kind]});}
    catch(e){if(valid(d,g))dialogContent.textContent=R.errorText(e);return;}
   }drafts.set(key,d);
  }
  current=d;openDialog(id?'แก้ไขเรื่องราว':'วันนี้คุณเจออะไร?','');main(d);
 }
 dialog.addEventListener('close',()=>{cleanup();dialogContent.classList.remove('s4-composer');});
 window.addEventListener('gerarai:identity-changing',()=>{cleanup();drafts.clear();current=null;if(dialogContent.classList.contains('s4-composer')){closeDialog();dialogContent.replaceChildren();}dialogContent.classList.remove('s4-composer');});
 window.GerarAICheckinComposer={open:()=>open(),edit:id=>open(id)};
})();
