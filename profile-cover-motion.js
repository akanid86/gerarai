/* Decorative default cover; local clock only, no location or network lookup. */
(()=>{
 const C=window.GerarAICharacter;
 const frames=[
  [0,[24,35,65],[76,87,111],.48], [5,[51,53,88],[173,143,147],.65],
  [7,[205,229,244],[243,225,192],1], [12,[181,217,240],[232,239,218],1],
  [16,[193,217,230],[244,225,193],1], [18,[139,133,172],[245,180,137],.86],
  [20,[37,49,80],[91,99,127],.52], [24,[24,35,65],[76,87,111],.48]
 ];
 function clock(date=new Date()){
  const hour=date.getHours()+date.getMinutes()/60;
  const i=frames.findIndex((f,n)=>n<frames.length-1&&hour>=f[0]&&hour<frames[n+1][0]);
  const a=frames[Math.max(0,i)],b=frames[Math.max(0,i)+1],t=(hour-a[0])/(b[0]-a[0]);
  const color=k=>'rgb('+a[k].map((v,j)=>Math.round(v+(b[k][j]-v)*t)).join(',')+')';
  return {top:color(1),bottom:color(2),light:a[3]+(b[3]-a[3])*t,night:hour<6||hour>=19};
 }
 function markup(profile){
  const pixel=profile?.avatar_type==='pixel'&&profile.pixel_avatar_data;
  const spec=pixel?C.normalizeSpec(profile.pixel_avatar_data):null;
  const pet=spec&&C.toV2(spec).companion.enabled;
  const species=pet?C.toV2(spec).companion.species:'';
  return `<div class="living-cover" aria-hidden="true"><div class="cover-stars"></div><div class="cover-orb"></div><div class="cover-cloud cloud-one"></div><div class="cover-cloud cloud-two"></div><div class="cover-terrain"></div>${pixel?`<div class="cover-travelers"><div class="cover-gerdey">${C.sprite(spec)}</div>${pet?`<div class="cover-pet pet-${species}">${C.petSprite(spec)}</div>`:''}</div>`:''}</div>`;
 }
 const active=new Map();let timer=null;
 function update(){const c=clock();for(const el of active.keys()){
  el.style.setProperty('--cover-sky-top',c.top);el.style.setProperty('--cover-sky-bottom',c.bottom);el.style.setProperty('--cover-light',c.light);el.dataset.night=String(c.night);
 }}
 function pause(){for(const [el,visible] of active)el.classList.toggle('is-running',visible&&!document.hidden);}
 const intersection=new IntersectionObserver(entries=>{for(const e of entries)if(active.has(e.target))active.set(e.target,e.isIntersecting);pause();});
 function scan(){
  for(const el of active.keys())if(!el.isConnected){intersection.unobserve(el);active.delete(el);}
  document.querySelectorAll('.living-cover').forEach(el=>{if(!active.has(el)){active.set(el,false);intersection.observe(el);}});
  if(active.size&&!timer)timer=setInterval(()=>{if(!document.hidden)update();},60000);
  if(!active.size&&timer){clearInterval(timer);timer=null;}
  update();pause();
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();pause();});
 const main=document.getElementById('main');if(main)new MutationObserver(scan).observe(main,{childList:true,subtree:true});
 window.GerarAICoverMotion=Object.freeze({markup,clock});scan();
})();
