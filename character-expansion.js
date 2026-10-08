'use strict';
/* Gerdey v2: additive visual customization; legacy renderer remains unchanged. */
(()=>{
const Legacy=window.GerarAICharacter;
const r=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
function human(s){const palette={cream:'#e6d8b8',navy:'#344c62',...Legacy.OUTFITS};const col=palette[s.outfit]||palette.slate;let svg=Legacy.sprite({...s,hairStyle:s.hat?'crop':['bob','curly'].includes(s.hairStyle)?'short':s.hairStyle,outfit:'slate',accessory:'none'}).replaceAll('#526174',col);const h=Legacy.HAIRS[s.hair]||'#202838';let rear='',front='';
if(s.bag==='backpack')rear=r(10,36,9,20,'#916e4e')+r(11,39,4,10,'#b99b70');
if(!s.hat&&s.hairStyle==='bob')front+=r(15,14,5,21,h)+r(44,14,5,21,h)+r(17,9,29,6,h)+r(20,7,22,3,h);
if(!s.hat&&s.hairStyle==='curly')front+=r(15,10,6,11,h)+r(19,7,7,8,h)+r(26,5,7,9,h)+r(33,7,8,7,h)+r(41,9,7,12,h);
if(s.top==='shirt')front+=`<path d="M25 34h7l-4 7zM32 34h7l-4 7z" fill="#f3ebd5"/>`+r(31,41,1,12,'#9b947f')+r(33,43,1,1,'#5b625b')+r(33,48,1,1,'#5b625b');
if(s.top==='jacket')front+=r(28,35,8,20,'#ddd7bc')+r(18,34,9,20,col)+r(37,34,9,20,col)+r(13,36,6,11,col)+r(45,36,6,11,col)+r(21,47,5,2,'#263f36')+r(38,47,5,2,'#263f36');
// Garments share the original body, face and shoe anchors; no gender gating.
if(['dress','skirt'].includes(s.top)){
 const skin=Legacy.SKINS[s.skin];
 svg=svg.replaceAll('fill="#334153"',`fill="${skin}"`);
 const skirt=s.top==='dress'?col:'#526174';
 front+=`<path d="M20 46h24v4h2v4h2v5H16v-5h2v-4h2z" fill="${skirt}"/>`;
 front+=r(20,46,24,2,s.top==='dress'?'#ddd7bc':'#334153');
 if(s.top==='dress')front+=r(13,36,6,7,col)+r(45,36,6,7,col)+r(28,34,8,2,'#f3ebd5');
 else front+=r(13,36,6,7,col)+r(45,36,6,7,col);
}
if(s.top==='hoodie')front+=r(13,36,6,14,col)+r(45,36,6,14,col)+r(23,34,18,3,'#ddd7bc')+r(26,37,1,6,'#f3ebd5')+r(37,37,1,6,'#f3ebd5')+r(25,48,14,4,'#ddd7bc');
if(s.top==='stripedtee')front+=r(13,36,6,7,col)+r(45,36,6,7,col)+r(19,40,26,3,'#f3ebd5')+r(19,47,26,3,'#f3ebd5');
if(s.top==='overalls'){
 front+=r(13,36,6,7,'#e6d8b8')+r(45,36,6,7,'#e6d8b8')+r(19,34,26,10,'#e6d8b8')+r(22,34,3,13,col)+r(39,34,3,13,col)+r(23,42,18,13,col)+r(23,41,2,2,'#c8a257')+r(39,41,2,2,'#c8a257')+r(28,46,8,5,'#ddd7bc');
 svg=svg.replaceAll('fill="#334153"',`fill="${col}"`);
}
if(s.bag==='backpack')front+=r(20,35,2,15,'#987650')+r(43,35,2,15,'#987650');
if(s.bag==='crossbody')front+=`<path d="M21 35 45 53" stroke="#967451" stroke-width="2"/>`+r(40,47,11,10,'#a3825d')+r(41,48,9,3,'#c4a47c');
if(s.camera)front+=`<path d="M25 35 30 44h7l3-9" fill="none" stroke="#3a484d" stroke-width="1.5"/>`+r(25,43,15,10,'#303641')+r(30,45,6,6,'#9fb9c9');
if(s.glasses)front+=s.glasses==='sun'?r(21,23,10,6,'#263142')+r(34,23,10,6,'#263142')+r(30,24,5,2,'#263142'):`<path d="M22 23h8v5h-8zM34 23h8v5h-8z" fill="none" stroke="#263142" stroke-width="2"/>`+r(30,24,4,2,'#263142');
if(s.hat==='bucket')front+=r(19,7,26,6,'#c5b589')+r(16,13,32,4,'#c5b589')+r(19,11,26,2,'#7b896a');
return svg.replace(/(<svg[^>]*>)/,'$1'+rear).replace('</svg>',front+'</svg>');}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATALOG=Object.freeze({
 skin:Object.keys(Legacy.SKINS),hairStyle:[...Legacy.HAIR_STYLES,'bob','curly'],hair:Object.keys(Legacy.HAIRS),
 outfit:[...Object.keys(Legacy.OUTFITS),'cream','navy'],top:['tee','shirt','jacket','dress','skirt','hoodie','stripedtee','overalls'],
 bag:['none','backpack','crossbody'],hat:['none','cap','bucket'],glasses:['none','glasses','sun'],neck:['none','camera','scarf'],
 species:['dog','cat','bird','rabbit','hamster'],color:['cream','brown','gray','orange','black','white'],pattern:['solid','bicolor','striped'],petAccessory:['none','collar','scarf']
});
const pick=(value,key,fallback)=>CATALOG[key].includes(value)?value:fallback;
function toV2(input){
 const raw=input&&typeof input==='object'?input:{},old=Legacy.normalizeSpec(raw),isV2=raw.version===2;
 const c=isV2&&raw.companion&&typeof raw.companion==='object'?raw.companion:{};
 const species=pick(c.species,'species','cat');
 return {version:2,skin:pick(raw.skin,'skin',old.skin),hairStyle:pick(raw.hairStyle,'hairStyle',old.hairStyle),hair:pick(raw.hair,'hair',old.hair),outfit:pick(raw.outfit,'outfit',old.outfit),
 top:pick(raw.top,'top','tee'),bag:pick(isV2?raw.bag:old.accessory==='backpack'?'backpack':'none','bag','none'),hat:pick(isV2?raw.hat:old.accessory==='cap'?'cap':'none','hat','none'),glasses:pick(isV2?raw.glasses:old.accessory==='glasses'?'glasses':'none','glasses','none'),neck:pick(isV2?raw.neck:old.accessory==='camera'?'camera':'none','neck','none'),
 companion:{enabled:c.enabled===true,species,color:pick(c.color,'color','cream'),pattern:['dog','cat'].includes(species)?pick(c.pattern,'pattern','solid'):'solid',accessory:['dog','cat','rabbit'].includes(species)?pick(c.accessory,'petAccessory','none'):'none'}};
}
function normalizeSpec(input){return input?.version===2?toV2(input):Legacy.normalizeSpec(input);}
function sprite(input,label='ตัวละคร GERARAI'){
 if(input?.version!==2)return Legacy.sprite(input,label);
 const s=toV2(input);let out=human({...s,hat:s.hat==='none'?false:s.hat,glasses:s.glasses==='sun'?'sun':s.glasses==='glasses',camera:s.neck==='camera'});
 if(s.neck==='scarf')out=out.replace('</svg>',r(23,34,18,3,'#b9815e')+r(34,37,4,9,'#b9815e')+'</svg>');
 // Keep the cap distinct from the new bucket hat.
 if(s.hat==='cap')out=out.replace('</svg>',r(18,7,27,6,'#274c77')+r(42,12,9,3,'#274c77')+'</svg>');
 return out.replace(/aria-label="[^"]*"/,`aria-label="${esc(label)}"`);
}
function petSprite(input){
 const c=toV2(input).companion;if(!c.enabled)return '';
 let out=window.GerdeyPetConcept.sprite(c.species,c.color,false),detail='';
 if(c.pattern==='bicolor')detail+=r(7,6,4,3,'#566763')+r(14,17,3,3,'#566763');
 if(c.pattern==='striped')detail+=r(11,7,2,2,'#8c6344')+r(7,15,3,1,'#8c6344')+r(16,18,2,1,'#8c6344');
 if(c.accessory==='collar')detail+=r(8,16,10,1,'#597b77')+r(12,17,2,2,'#c8a257');
 if(c.accessory==='scarf')detail+=r(8,16,10,2,'#597b77')+r(14,18,3,2,'#597b77');
 return out.replace('</svg>',detail+'</svg>');
}
function scene(input,label='Gerdey และเพื่อนร่วมทาง'){
 const s=normalizeSpec(input),c=toV2(s).companion;
 const person=sprite(s).replace('class="pixel-sprite"','class="gerdey-person-layer"').replace('<svg ',`<svg x="${c.enabled?5:16}" y="8" width="64" height="64" `).replace(/role="img" aria-label="[^"]*"/,'aria-hidden="true"');
 const pet=c.enabled?petSprite(s).replace('<svg ','<svg x="66" y="50" width="24" height="24" ').replace(/role="img" aria-label="[^"]*"/,'aria-hidden="true"'):'';
 return `<svg class="gerdey-scene" viewBox="0 0 96 80" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><path d="M0 69h96v11H0z" fill="#b7c8a8"/>${person}${pet}</svg>`;
}
function companionMarkup(input){return input?.version===2&&toV2(input).companion.enabled?`<section class="gerdey-profile-companion" aria-label="เพื่อนร่วมทาง"><div>${scene(input)}</div><span>เพื่อนร่วมทางของฉัน</span></section>`:'';}
const TH={sand:'อ่อน',warm:'อบอุ่น',tan:'แทน',deep:'เข้ม',short:'สั้น',wave:'ลอน',crop:'ครอป',long:'ยาว',spike:'ตั้ง',bob:'บ๊อบ',curly:'หยิกสั้น',ink:'ดำ',brown:'น้ำตาล',chestnut:'เกาลัด',copper:'ทองแดง',gold:'ทอง',silver:'เงิน',moss:'มอส',ocean:'น้ำเงิน',clay:'ดินเผา',amber:'อำพัน',plum:'พลัม',slate:'สเลต',cream:'ครีม',navy:'กรมท่า',tee:'เสื้อเรียบ',shirt:'เชิ้ต',jacket:'แจ็กเก็ตบาง',dress:'เดรสเรียบ',skirt:'เสื้อกับกระโปรง',hoodie:'ฮู้ดดี้',stripedtee:'เสื้อลายขวาง',overalls:'ชุดเอี๊ยม',none:'ไม่มี',backpack:'เป้',crossbody:'สะพายข้าง',cap:'หมวกแก๊ป',bucket:'หมวกบักเก็ต',glasses:'แว่นสายตา',sun:'แว่นกันแดด',camera:'กล้อง',scarf:'ผ้าคอ',dog:'สุนัข',cat:'แมว',bird:'นก',rabbit:'กระต่าย',hamster:'แฮมสเตอร์',gray:'เทา',orange:'ส้ม',black:'ดำ',white:'ขาว',solid:'สีพื้น',bicolor:'สองสี',striped:'ลายขีด',collar:'ปลอกคอ'};
const field=(key,title,values,value)=>`<label class="gerdey-field">${title}<select data-gerdey-field="${key}">${values.map(x=>`<option value="${x}" ${x===value?'selected':''}>${TH[x]||x}</option>`).join('')}</select></label>`;
function editorMarkup(input){const initial=normalizeSpec(input),s=toV2(initial),c=s.companion;return `<div class="character-editor gerdey-editor" data-initial="${esc(JSON.stringify(initial))}"><div class="gerdey-tabs" role="group" aria-label="หมวดปรับแต่ง">${['รูปลักษณ์','เสื้อผ้า','ของติดตัว','เพื่อนร่วมทาง'].map((x,i)=>`<button type="button" data-gerdey-tab="${i}" aria-pressed="${i===0}">${x}</button>`).join('')}</div>
 <section data-gerdey-panel="0">${field('skin','สีผิว',CATALOG.skin,s.skin)}${field('hairStyle','ทรงผม',CATALOG.hairStyle,s.hairStyle)}${field('hair','สีผม',CATALOG.hair,s.hair)}</section>
 <section data-gerdey-panel="1" hidden>${field('top','รูปแบบชุด',CATALOG.top,s.top)}${field('outfit','สีชุด',CATALOG.outfit,s.outfit)}</section>
 <section data-gerdey-panel="2" hidden>${field('hat','หมวก',CATALOG.hat,s.hat)}${field('glasses','แว่น',CATALOG.glasses,s.glasses)}${field('bag','กระเป๋า',CATALOG.bag,s.bag)}${field('neck','ของคล้องคอ',CATALOG.neck,s.neck)}<p class="form-help">เมื่อใส่หมวก จะแสดงผมส่วนที่อยู่ใต้หมวก โดยจำทรงผมเดิมไว้ · กล้องกับกระเป๋าสะพายข้างอาจมีสายซ้อนกัน</p></section>
 <section data-gerdey-panel="3" hidden><label class="gerdey-pet-toggle"><input type="checkbox" data-gerdey-field="enabled" ${c.enabled?'checked':''}> แสดงเพื่อนร่วมทาง</label>${field('species','ชนิดสัตว์',CATALOG.species,c.species)}${field('color','สีพื้น',CATALOG.color,c.color)}${field('pattern','ลาย',CATALOG.pattern,c.pattern)}${field('petAccessory','อุปกรณ์สัตว์',CATALOG.petAccessory,c.accessory)}<p class="form-help">ลายใช้กับสุนัขและแมว · อุปกรณ์ใช้กับสุนัข แมว และกระต่าย</p></section></div>`;}
function specFromForm(root=document){const editor=root.querySelector('.gerdey-editor');if(!editor)return Legacy.specFromForm(root);const initial=JSON.parse(editor.dataset.initial),s=toV2(initial);editor.querySelectorAll('[data-gerdey-field]').forEach(el=>{const key=el.dataset.gerdeyField;if(key==='enabled')s.companion.enabled=el.checked;else if(['species','color','pattern'].includes(key))s.companion[key]=el.value;else if(key==='petAccessory')s.companion.accessory=el.value;else s[key]=el.value;});const clean=toV2(s);return JSON.stringify(clean)===JSON.stringify(toV2(initial))?initial:clean;}
function syncEditor(root=document){const editor=root.querySelector('.gerdey-editor');if(!editor)return;const s=toV2(specFromForm(root)),c=s.companion;for(const key of ['pattern','petAccessory']){const el=editor.querySelector(`[data-gerdey-field="${key}"]`);el.disabled=key==='pattern'?!['dog','cat'].includes(c.species):!['dog','cat','rabbit'].includes(c.species);el.value=key==='pattern'?c.pattern:c.accessory;}editor.querySelectorAll('[data-gerdey-field]').forEach(el=>{if(['species','color','pattern','petAccessory'].includes(el.dataset.gerdeyField)&&!c.enabled)el.disabled=true;else if(['species','color'].includes(el.dataset.gerdeyField))el.disabled=false;});}
function randomSpec(input){const s=toV2(input||Legacy.DEFAULT_SPEC);for(const key of ['hairStyle','hair','outfit','top','bag','hat','glasses','neck'])s[key]=CATALOG[key][Math.floor(Math.random()*CATALOG[key].length)];return s;}
document.addEventListener('click',e=>{const b=e.target.closest('[data-gerdey-tab]');if(!b)return;const editor=b.closest('.gerdey-editor');editor.querySelectorAll('[data-gerdey-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));editor.querySelectorAll('[data-gerdey-panel]').forEach(el=>el.hidden=el.dataset.gerdeyPanel!==b.dataset.gerdeyTab);});
window.GerarAICharacter=Object.freeze({...Legacy,CATALOG,normalizeSpec,toV2,sprite,petSprite,scene,companionMarkup,editorMarkup,specFromForm,syncEditor,randomSpec});
})();
