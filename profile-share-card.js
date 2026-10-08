'use strict';
/* Approved Classic Warm arch card. PNG is drawn locally; no screenshot or external image service. */
(()=>{
 const C=window.GerarAICharacter,P=window.GerarAIProgression,R=window.GerarAIRemote;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const themes=[
  {id:'warm',name:'ครีมอุ่น',paper:'#fff7e8',sky:'#bdccc5',sun:'#ffebc3',arch:'#c0cfb4',ground:'#9caf88',ink:'#203448',muted:'#60776e',footer:'#f9e9ce',line:'#dac59f',chip:'#e6eddc',edge:'#c2cfb6',accent:'#36584a'},
  {id:'forest',name:'ป่าเขียว',paper:'#eff4e9',sky:'#8fab9b',sun:'#f7e3b2',arch:'#bbceac',ground:'#829e78',ink:'#243e33',muted:'#506953',footer:'#d8e5cf',line:'#a7bea0',chip:'#dce8d3',edge:'#abc3a2',accent:'#304f38',tint:'#5b8060'},
  {id:'ocean',name:'ฟ้าทะเล',paper:'#f0f7fa',sky:'#99bdcb',sun:'#fff0c7',arch:'#c4dce1',ground:'#91b5bb',ink:'#213e54',muted:'#526f80',footer:'#dbeaf1',line:'#aac5d0',chip:'#dfeef2',edge:'#abcbd4',accent:'#315d70',tint:'#619bb7'},
  {id:'sunset',name:'พีชยามเย็น',paper:'#fff2e9',sky:'#ddb2a1',sun:'#ffe4a6',arch:'#ead0b5',ground:'#c5a381',ink:'#513b37',muted:'#826155',footer:'#f3d9c6',line:'#d5b399',chip:'#f1dfcb',edge:'#d8bda0',accent:'#79583e',tint:'#d69a7f'},
  {id:'lavender',name:'ม่วงละมุน',paper:'#f7f2fa',sky:'#b6adc9',sun:'#ffebcc',arch:'#d8cde3',ground:'#b0a0be',ink:'#40374f',muted:'#72627d',footer:'#e8ddef',line:'#c6b5d4',chip:'#e9dfef',edge:'#cbb9d8',accent:'#655073',tint:'#b598c4'}
 ];
 const themeFor=id=>themes.find(t=>t.id===id)||themes[0];
 function savedTheme(id){try{return themeFor(localStorage.getItem('gerarai.card-theme.'+id)).id;}catch{return 'warm';}}
 let request=0;
 function publicLink(id,base=window.GERARAI_CONFIG?.publicSiteUrl||location.href){
  try{const u=new URL(base),h=u.hostname.toLowerCase();if(!/^https?:$/.test(u.protocol)||u.username||u.password||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h==='[::1]'||/^(127\.|10\.|192\.168\.|0\.)/.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||!R.isId(id))return null;u.search='';u.hash='u/'+id;return u.href;}catch{return null;}
 }
 function image(src){return new Promise((resolve,reject)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('โหลดภาพในการ์ดไม่สำเร็จ กรุณาลองใหม่'));i.src=src;});}
 async function svgImage(svg){if(!svg.includes('xmlns='))svg=svg.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');const u=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{return await image(u);}finally{URL.revokeObjectURL(u);}}
 function arch(ctx,x,y,w,h){ctx.beginPath();ctx.moveTo(x,y+h-18);ctx.lineTo(x,y+w/2);ctx.arc(x+w/2,y+w/2,w/2,Math.PI,0);ctx.lineTo(x+w,y+h-18);ctx.quadraticCurveTo(x+w,y+h,x+w-18,y+h);ctx.lineTo(x+18,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-18);ctx.closePath();}
 function fitText(ctx,text,x,y,maxWidth,size,min=18,weight=600){ctx.font=`${weight} ${size}px "Segoe UI", "Leelawadee UI", sans-serif`;while(ctx.measureText(text).width>maxWidth&&size>min){size--;ctx.font=`${weight} ${size}px "Segoe UI", "Leelawadee UI", sans-serif`;}if(ctx.measureText(text).width>maxWidth){let chars=Array.from(text);while(chars.length&&ctx.measureText(chars.join('')+'…').width>maxWidth)chars.pop();text=chars.join('')+'…';}ctx.fillText(text,x,y);}
 function safeData(data){const p=data.profile;return {id:p.id,name:String(p.display_name||'สมาชิก GERARAI').slice(0,80),handle:String(p.handle||'').slice(0,30),type:p.avatar_type,spec:C.normalizeSpec(p.pixel_avatar_data),hasSpec:!!p.pixel_avatar_data,photo:p.avatar_path?R.avatarUrl(p.avatar_path):null,cls:data.progression?.state?C.CLASSES.find(x=>x.code===data.progression.state.primary_class_code):null,badges:P.catalog(R.progression.catalog).filter(b=>b.available&&(data.progression?.badges||[]).includes(b.code))};}
 async function render(data,{showClass=true,badgeCode='',theme='warm'}={}){
  const palette=themeFor(theme);
  const height=675,shift=0,canvas=document.createElement('canvas');canvas.width=1080;canvas.height=height*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.imageSmoothingEnabled=false;
  await document.fonts.ready;
  const [land,logo,compass]=await Promise.all([image('assets/pixel/world/cover-horizon.svg'),image('assets/gerarai-mark.png'),image('assets/pixel/compass.svg')]);
  ctx.fillStyle=palette.paper;ctx.fillRect(0,0,540,height);ctx.fillStyle=palette.sky;ctx.fillRect(0,0,540,239+shift);ctx.drawImage(land,-370,143+shift,1280,96);if(palette.tint){ctx.save();ctx.globalAlpha=.28;ctx.fillStyle=palette.tint;ctx.fillRect(0,143+shift,540,96);ctx.restore();}ctx.fillStyle=palette.sun;ctx.beginPath();ctx.arc(451,63+shift,21,0,Math.PI*2);ctx.fill();
  arch(ctx,120,76+shift,300,300);ctx.fillStyle=palette.paper;ctx.fill();arch(ctx,128,84+shift,284,284);ctx.save();ctx.clip();ctx.fillStyle=palette.arch;ctx.fillRect(128,84+shift,284,284);ctx.fillStyle=palette.ground;ctx.fillRect(128,320+shift,284,48);
  if(data.type==='pixel'&&data.hasSpec){const pet=C.toV2(data.spec).companion.enabled;ctx.drawImage(await svgImage(C.sprite(data.spec)),pet?150:174,148+shift,192,192);if(pet)ctx.drawImage(await svgImage(C.petSprite(data.spec)),318,274+shift,72,72);}
  else if(data.type==='photo'&&data.photo){const pic=await image(data.photo),side=Math.min(pic.width,pic.height);ctx.imageSmoothingEnabled=true;ctx.drawImage(pic,(pic.width-side)/2,(pic.height-side)/2,side,side,128,84+shift,284,284);ctx.imageSmoothingEnabled=false;}
  else{ctx.fillStyle=palette.accent;ctx.textAlign='center';fitText(ctx,Array.from(data.name)[0]||'G',270,270+shift,190,100,60,700);}
  ctx.restore();ctx.textAlign='center';ctx.fillStyle=palette.ink;fitText(ctx,data.name,270,429+shift,450,43,24,750);if(data.handle){ctx.fillStyle=palette.muted;fitText(ctx,'@'+data.handle,270,468+shift,430,19,14,400);}
  const badge=data.badges.find(b=>b.code===badgeCode),items=[];if(showClass&&data.cls)items.push({text:data.cls.en,img:compass,bg:palette.chip,stroke:palette.edge,fg:palette.accent});if(badge)items.push({text:badge.name_en,img:await svgImage(P.badgeArt(badge.pixel_asset_key)),bg:'#f5e4be',stroke:'#d9bb80',fg:'#796036'});
  ctx.font='600 14px "Segoe UI",sans-serif';const widths=items.map(i=>Math.min(214,ctx.measureText(i.text).width+52)),total=widths.reduce((a,b)=>a+b,0)+Math.max(0,items.length-1)*10;let x=(540-total)/2;for(let n=0;n<items.length;n++){const it=items[n],w=widths[n],y=500+shift;ctx.beginPath();ctx.roundRect(x,y,w,41,21);ctx.fillStyle=it.bg;ctx.fill();ctx.strokeStyle=it.stroke;ctx.stroke();ctx.drawImage(it.img,x+12,y+10,20,20);ctx.textAlign='left';ctx.fillStyle=it.fg;fitText(ctx,it.text,x+39,y+26,w-46,14,11,600);x+=w+10;}
  const foot=height-74;ctx.fillStyle=palette.footer;ctx.fillRect(0,foot,540,height-foot);ctx.fillStyle=palette.line;ctx.fillRect(0,foot,540,1);ctx.imageSmoothingEnabled=true;ctx.drawImage(logo,197,foot+24,38,25);ctx.imageSmoothingEnabled=false;ctx.fillStyle=palette.ink;ctx.textAlign='left';ctx.font='800 23px "Segoe UI",sans-serif';ctx.fillText('GERARAI',244,foot+47);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('สร้างไฟล์ PNG ไม่สำเร็จ')),'image/png'));return {blob,canvas};
 }
 async function open(id){
  const seq=++request;openDialog('การ์ดโปรไฟล์', '<p class="form-help" role="status">กำลังเตรียมการ์ดจากข้อมูลที่บันทึกไว้…</p>');
  const content=document.getElementById('dialog-content'),loading=content.firstElementChild;
  try{const result=await R.profileCard(id);if(seq!==request||!document.getElementById('dialog').open||!content.contains(loading))return;if(!result)throw new Error('ไม่พบโปรไฟล์นี้');const data=safeData(result),link=publicLink(id);let file=null,url=null,version=0,sharing=false;
   // Public cards are view-only. Ownership comes from the active auth session.
   const ownsCard=()=>!!R.user?.id&&R.user.id===data.id;
   if(!ownsCard()){
    content.innerHTML=`<section class="share-card-panel"><img class="profile-share-preview" id="card-preview" alt="ตัวอย่างการ์ดโปรไฟล์ ${esc(data.name)}" draggable="false" hidden><p id="card-status" class="form-help" role="status">กำลังเตรียมภาพ…</p></section>`;
    const preview=content.querySelector('#card-preview'),status=content.querySelector('#card-status');
    let previewUrl=null;
    const valid=()=>seq===request&&document.getElementById('dialog').open&&content.contains(preview);
    const cleanup=()=>{if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}};
    const observer=new MutationObserver(()=>{if(!valid()){cleanup();observer.disconnect();}});
    observer.observe(content,{childList:true});
    document.getElementById('dialog').addEventListener('close',()=>{cleanup();observer.disconnect();},{once:true});
    try{const {blob}=await render(data);if(!valid())return;previewUrl=URL.createObjectURL(blob);preview.src=previewUrl;preview.hidden=false;status.textContent='';}
    catch(e){if(valid())status.textContent=e.message||'โหลดภาพไม่สำเร็จ';}
    return;
   }
   let selectedTheme=savedTheme(data.id);
   content.innerHTML=`<section class="share-card-panel"><fieldset class="card-themes"><legend>ธีมสีการ์ด</legend><div class="card-theme-buttons">${themes.map(t=>`<button type="button" class="card-theme" data-card-theme="${t.id}" aria-pressed="${t.id===selectedTheme}"><span class="card-theme-swatches" aria-hidden="true"><i style="background:${t.sky}"></i><i style="background:${t.paper}"></i><i style="background:${t.ground}"></i></span>${t.name}</button>`).join('')}</div></fieldset><p class="form-help">การ์ดจากโปรไฟล์ที่บันทึกไว้ · ชื่อและอวาตาร์เป็นข้อมูลสาธารณะ</p><div class="share-card-options"><label class="card-check"><input type="checkbox" id="card-class" ${data.cls?'checked':'disabled'}> แสดงอาชีพปัจจุบัน</label><label>เหรียญเด่น<select id="card-badge"><option value="">ไม่แสดงเหรียญ</option>${data.badges.map(b=>`<option value="${esc(b.code)}">${esc(b.name_en)}</option>`).join('')}</select></label></div>${!data.handle?'<p class="form-help">ยังไม่ได้ตั้ง @username จึงแสดงเฉพาะชื่อบนการ์ด</p>':''}${!data.badges.length?'<p class="form-help">ยังไม่มีเหรียญที่ได้รับให้เลือกแสดง</p>':''}<img class="profile-share-preview" id="card-preview" alt="ตัวอย่างการ์ดโปรไฟล์ ${esc(data.name)}" hidden><p id="card-status" class="form-help" role="status" aria-live="polite"></p><div class="share-card-actions"><button class="primary" id="card-download" disabled>ดาวน์โหลด PNG</button><button class="secondary" id="card-share" disabled>แชร์รูปไปยังแอป…</button><button class="secondary" id="card-copy" ${link?'':'disabled'}>คัดลอกลิงก์โปรไฟล์</button></div>${link?`<label class="form-field">ลิงก์โปรไฟล์<input id="card-link" readonly value="${esc(link)}"></label>`:'<p class="form-help">ขณะนี้เปิดจากเครื่องนี้ จึงยังไม่มีลิงก์สาธารณะให้ส่งต่อ แต่ดาวน์โหลดและแชร์รูปการ์ดได้</p>'}<details class="card-help"><summary>แชร์ไป Instagram / Facebook / LINE อย่างไร?</summary><p>กด “แชร์รูปไปยังแอป…” แล้วเลือกแอปที่อุปกรณ์แสดง หากไม่มีแอปที่ต้องการ ให้ดาวน์โหลด PNG แล้วเลือกภาพนี้ในโพสต์หรือ Story ของแอปนั้น คุณเป็นผู้เลือกผู้รับและกดยืนยันโพสต์เอง</p></details></section>`;
   const el=id=>content.querySelector('#'+id),status=el('card-status'),download=el('card-download'),share=el('card-share'),preview=el('card-preview');
   const valid=()=>seq===request&&document.getElementById('dialog').open&&content.contains(status);
   const cleanup=()=>{if(url){URL.revokeObjectURL(url);url=null;}file=null;};
   const observer=new MutationObserver(()=>{if(!valid()){cleanup();observer.disconnect();}});observer.observe(content,{childList:true});document.getElementById('dialog').addEventListener('close',()=>{cleanup();observer.disconnect();},{once:true});
   async function update(){const n=++version;file=null;download.disabled=share.disabled=true;preview.hidden=true;status.textContent='กำลังสร้างภาพ…';try{const {blob}=await render(data,{theme:selectedTheme,showClass:el('card-class').checked,badgeCode:el('card-badge').value});if(n!==version||!valid())return;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);file=new File([blob],`GERARAI-${data.handle||'profile'}-${selectedTheme}-portrait.png`,{type:'image/png'});preview.src=url;preview.hidden=false;download.disabled=false;let can=false;try{can=!!navigator.canShare?.({files:[file]})&&!!navigator.share;}catch{}share.disabled=!can;status.textContent=can?'พร้อมดาวน์โหลดหรือแชร์รูป':'อุปกรณ์นี้ไม่รองรับแชร์รูปโดยตรง — ดาวน์โหลด PNG แล้วเลือกภาพในแอปได้';}catch(e){if(n===version&&valid())status.textContent=e.message||'สร้างการ์ดไม่สำเร็จ กรุณาปิดแล้วลองใหม่';}}
   content.querySelectorAll('[data-card-theme]').forEach(button=>button.addEventListener('click',()=>{
    if(!ownsCard())return;
    selectedTheme=themeFor(button.dataset.cardTheme).id;
    content.querySelectorAll('[data-card-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cardTheme===selectedTheme)));
    try{localStorage.setItem('gerarai.card-theme.'+data.id,selectedTheme);}catch{}
    update();
   }));
   ['card-class','card-badge'].forEach(id=>el(id).addEventListener('change',update));
   download.onclick=()=>{if(!ownsCard()||!file||!url)return;const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();status.textContent='เริ่มดาวน์โหลด PNG แล้ว';};
   share.onclick=async()=>{if(!ownsCard()||!file||sharing)return;sharing=true;share.disabled=true;try{await navigator.share({files:[file],title:`${data.name} · GERARAI`});if(valid())status.textContent='ส่งรูปให้เมนูแชร์ของอุปกรณ์แล้ว';}catch(e){if(valid())status.textContent=e.name==='AbortError'?'ยกเลิกการแชร์แล้ว':'แชร์รูปไม่ได้ในอุปกรณ์นี้ กรุณาดาวน์โหลด PNG แทน';}finally{sharing=false;if(valid()&&file)share.disabled=false;}};
   el('card-copy').onclick=async()=>{if(!ownsCard()||!link)return;try{await navigator.clipboard.writeText(link);status.textContent='คัดลอกลิงก์โปรไฟล์แล้ว';}catch{el('card-link').focus();el('card-link').select();status.textContent='เลือกข้อความลิงก์ไว้แล้ว กดคัดลอกด้วยตนเอง';}};
   await update();
  }catch(e){if(seq===request&&document.getElementById('dialog').open&&content.contains(loading))content.innerHTML=`<p class="form-error" role="alert">${esc(e.message||'โหลดการ์ดไม่สำเร็จ')}</p>`;}
 }
 window.GerarAIShareCard=Object.freeze({open,render,safeData,publicLink});
})();
