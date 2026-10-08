'use strict';
(function () {
  const D=window.GerarAIDiscovery, R=window.GerarAIRemote, Provider=window.GerarAIMapProvider;
  let controller=null, pickerCleanup=null, camera={center:[16.3,99.9],zoom:6}, filter='all';
  let storyRequest=0;
  const remote=()=>!!R?.enabled;
  const hidden=id=>state.reported.some(r=>r.id===id);
  const categoryIcon=c=>window.GerarAICategoryIcons.render(c.code,c.icon);
  const options=selected=>D.categories.map(c=>`<option value="${c.code}" ${c.code===selected?'selected':''}>${c.icon} ${c.label}</option>`).join('');
  const oldOpen=openDialog;
  openDialog=function(...args){pickerCleanup?.();pickerCleanup=null;oldOpen(...args);};
  dialog.addEventListener('close',()=>{pickerCleanup?.();pickerCleanup=null;});

  function mount(form, initial) {
    if(remote()&&!R.discoveryAvailable){
      form.querySelector('.form-submit').insertAdjacentHTML('beforebegin','<p class="form-help">ยังเพิ่มตำแหน่ง Discovery ไม่ได้ในขณะนี้ คุณยังโพสต์เรื่องราวได้ตามปกติ</p>');
      return;
    }
    const value=initial || {}, precision=value.location_precision || 'none';
    form.querySelector('.form-submit').insertAdjacentHTML('beforebegin',`<fieldset class="discovery-fields"><legend>สิ่งที่คุณเจอ · ตำแหน่งไม่บังคับ</legend>
      <label class="form-field">การแสดงตำแหน่ง<select name="discovery_precision"><option value="none">ไม่เพิ่มตำแหน่ง / ลบตำแหน่งเดิม</option><option value="approximate">บริเวณโดยประมาณ</option><option value="exact">ตำแหน่งตรงจุด</option><option value="hidden">ซ่อนตำแหน่ง</option></select></label>
      <div class="discovery-details" hidden><label class="form-field">หมวด Discovery<select name="discovery_category">${options(value.category_code || 'other')}</select></label>
      <div class="discovery-location"><p class="form-help">แตะบนแผนที่เพื่อปักหมุด หรือกรอกพิกัดเอง</p><div class="location-picker" aria-label="เลือกตำแหน่ง Discovery"></div>
      <button type="button" class="secondary locate-discovery">ใช้ตำแหน่งปัจจุบัน</button><div class="coordinate-fields"><label class="form-field">ละติจูด<input name="discovery_lat" type="number" step="any" min="-90" max="90" value="${value.latitude ?? ''}"></label><label class="form-field">ลองจิจูด<input name="discovery_lng" type="number" step="any" min="-180" max="180" value="${value.longitude ?? ''}"></label></div></div>
      <p class="discovery-preview form-help" role="status"></p></div><p class="discovery-error form-error" role="alert" hidden></p></fieldset>`);
    const field=form.querySelector('.discovery-fields'), select=field.querySelector('[name=discovery_precision]');
    const lat=field.querySelector('[name=discovery_lat]'),lng=field.querySelector('[name=discovery_lng]');
    const preview=field.querySelector('.discovery-preview'),error=field.querySelector('.discovery-error');
    const cat=field.querySelector('[name=discovery_category]');
    let picker=null,active=true,geoGeneration=0;
    const message=m=>{error.textContent=m;error.hidden=!m;};
    const valueOf=()=>D.normalize({category_code:cat.value,location_precision:select.value,latitude:lat.value,longitude:lng.value});
    function previewLocation() {
      if(select.value==='hidden'){preview.textContent='ไม่แสดงบนแผนที่ และไม่เก็บพิกัด';picker?.pin(null);return;}
      if(!lat.value||!lng.value){preview.textContent='ยังไม่ได้เลือกตำแหน่ง';return;}
      try {const d=valueOf();lat.value=d.latitude;lng.value=d.longitude;picker?.pin(d);preview.textContent=(d.location_precision==='approximate'?'จะแชร์บริเวณกริด 0.01° (ประมาณ 1.1 กม. ในแนวเหนือ–ใต้) · ไม่เก็บพิกัดต้นฉบับ: ':'จะแชร์พิกัดตรงจุด: ')+d.latitude.toFixed(5)+', '+d.longitude.toFixed(5);message('');}catch(e){message(e.message);}
    }
    function setPoint(a,b){if(!active)return;lat.value=a;lng.value=b;previewLocation();}
    function changePrecision(){
      geoGeneration++;
      const enabled=select.value!=='none',showMap=enabled&&select.value!=='hidden';
      field.querySelector('.discovery-details').hidden=!enabled;
      field.querySelector('.discovery-location').hidden=!showMap;
      lat.disabled=lng.disabled=!showMap;
      if(!showMap){lat.value='';lng.value='';picker?.pin(null);message('');}
      if(showMap&&!picker){
        try {picker=Provider.create(field.querySelector('.location-picker'),{center:lat.value&&lng.value?[+lat.value,+lng.value]:camera.center,zoom:lat.value&&lng.value?15:camera.zoom,onPick:setPoint,onTiles:ok=>{if(!ok)message('โหลดพื้นแผนที่ไม่ได้ คุณยังกรอกพิกัดเองได้');}});}catch(e){message(e.message);}
      }
      if(showMap)picker?.resize();
      if(enabled)previewLocation();
    }
    select.value=precision;select.addEventListener('change',changePrecision);
    lat.addEventListener('change',previewLocation);lng.addEventListener('change',previewLocation);
    field.querySelector('.locate-discovery').addEventListener('click',()=>{
      if(!navigator.geolocation){message('เบราว์เซอร์นี้ไม่รองรับตำแหน่ง เลือกบนแผนที่หรือกรอกพิกัดได้');return;}
      const generation=++geoGeneration;message('กำลังขอตำแหน่ง…');
      navigator.geolocation.getCurrentPosition(pos=>{if(!active||generation!==geoGeneration)return;setPoint(pos.coords.latitude,pos.coords.longitude);picker?.setView(+lat.value,+lng.value,15);},()=>{if(active&&generation===geoGeneration)message('ขอตำแหน่งไม่ได้ เลือกบนแผนที่หรือกรอกพิกัดเองได้');},{enableHighAccuracy:false,timeout:10000,maximumAge:0});
    });
    pickerCleanup=()=>{active=false;geoGeneration++;picker?.destroy();picker=null;};
    changePrecision();
  }
  function read(form) {
    const select=form.querySelector('[name=discovery_precision]');
    if(!select)return undefined;
    if(select.value==='none')return null;
    return D.normalize({category_code:form.elements.discovery_category.value,location_precision:select.value,latitude:form.elements.discovery_lat.value,longitude:form.elements.discovery_lng.value});
  }
  function card(d,selected=false) {
    const p=d.post,c=D.category(d.category_code);
    return `<button class="discovery-card ${selected?'selected':''}" data-discovery-select="${esc(d.id)}" aria-pressed="${selected}">${p.image?`<img src="${esc(p.image)}" alt="" loading="lazy">`:`<span class="discovery-no-photo" style="--pin:${c.color}">${categoryIcon(c)}</span>`}<span class="discovery-card-copy"><small>${categoryIcon(c)} ${c.label}${d.location_precision==='approximate'?' · โดยประมาณ':''}</small><strong>${esc(window.GerarAICheckinRead.heading(p))}</strong><span>${esc(p.body.slice(0,100))}</span><small>${esc(p.author)}${p.handle?' · @'+esc(p.handle):''} · ${esc(p.time)}</small></span></button>`;
  }
  function renderDiscoveryMap() {
    controller?.dispose();
    const mapConfig=window.GERARAI_CONFIG?.map || {};
    const googleConfigured=mapConfig.provider==='google'&&window.GerarAIPlacesProvider?.configured?.();
    const googleLabel=googleConfigured?'Google Places · ชั้นอ้างอิง':'Google Places · ยังไม่เปิด';
    const sourceNote=googleConfigured?'Google Places จะค้นหาหมุดตามบริเวณที่มองเห็น':'Google Places ยังไม่เปิด · ตอนนี้ใช้ OpenStreetMap · เพิ่ม API key ใน config.js เพื่อเปิดหมุด Google';
    const EUI=window.GerarAIEmergencyUI, emergencyOn=!!EUI&&new URLSearchParams(route.split('?')[1]||'').get('mode')==='emergency';
    main.innerHTML=`<section class="discovery-page ${emergencyOn?'emergency-on':''}"><div class="page-heading"><div><h1>${emergencyOn?'สถานการณ์ตอนนี้':'วันนี้ คุณจะเจออะไร?'}</h1><p>${emergencyOn?'รายงานสถานการณ์จากชุมชน · ตรวจเวลาและแหล่งข้อมูลทุกครั้ง':'เรื่องจริงรอบตัว · ทุกหมุดคือสิ่งที่ใครสักคนค้นพบ'}</p></div><div class="discovery-heading-actions">${EUI?`<button class="secondary emergency-toggle ${emergencyOn?'active':''}" data-emergency-toggle aria-pressed="${emergencyOn}">🆘 ${emergencyOn?'ปิดโหมดสถานการณ์':'สถานการณ์ตอนนี้'}</button>`:''}${emergencyOn?`<button class="primary" data-action="emergency-report">รายงานสถานการณ์</button>`:`<button class="primary" data-action="compose">${icon('plus')} แชร์สิ่งที่เจอ</button>`}</div></div>
      ${emergencyOn?'<div id="emergency-slot"></div>':''}
      <div class="discovery-filters" aria-label="หมวด Discovery" ${emergencyOn?'hidden':''}><button data-discovery-filter="all" aria-pressed="${filter==='all'}" class="${filter==='all'?'active':''}">ทั้งหมด</button>${D.categories.map(c=>`<button data-discovery-filter="${c.code}" class="${filter===c.code?'active':''}" aria-pressed="${filter===c.code}">${categoryIcon(c)} ${c.label}</button>`).join('')}</div>
      <div class="discovery-layout"><div class="discovery-map-panel"><div id="discovery-map" aria-label="แผนที่ Discovery"></div><div class="discovery-map-label">✦ DISCOVER YOUR WORLD</div><div class="discovery-map-sources" role="note" aria-label="แหล่งข้อมูลบนแผนที่"><span class="map-source map-source-gerarai"><i aria-hidden="true"></i> GERARAI Discovery</span><span class="map-source map-source-google"><i aria-hidden="true"></i> ${googleLabel}</span></div><button class="secondary discovery-home" data-discovery-reset>ดูภาพรวม</button><p class="discovery-tile-warning" role="status" hidden></p><div id="discovery-selected" aria-live="polite"></div>${emergencyOn?'<div id="emergency-selected" aria-live="polite"></div>':''}</div>
      <section class="discovery-list">${emergencyOn?'<div id="emergency-list" aria-live="polite"></div>':''}<div class="discovery-list-heading"><h2>สิ่งที่พบในบริเวณนี้</h2><p>${remote()?'เรื่องราวจากชุมชน GERARAI':'โหมดทดลอง · เรื่องราวบนเครื่องนี้เท่านั้น'}</p><p class="discovery-source-note">${sourceNote}</p></div><p id="discovery-status" role="status" aria-live="polite">กำลังโหลด…</p><div id="discovery-results"></div><div id="google-place-results" class="google-place-results" hidden></div><button class="secondary" id="discovery-more" hidden>โหลดเพิ่มในบริเวณนี้</button><button class="secondary" id="discovery-retry" hidden>ลองใหม่</button></section></div></section>`;
    const status=document.getElementById('discovery-status'),list=document.getElementById('discovery-results'),googleList=document.getElementById('google-place-results'),more=document.getElementById('discovery-more'),retry=document.getElementById('discovery-retry');
    const selected=document.getElementById('discovery-selected');
    let provider=null,rows=[],next=null,selection=null,abort=null,timer=null,generation=0,disposed=false,loading=false;
    const setStatus=t=>{status.textContent=t;};
    // Google reference content (M2 Place Disclosure P4/G3/G4): its own visually distinct container, no GERARAI mark,
    // "Google Maps" attribution exactly as Google requires off-map (not translated, one line), provider credits.
    function renderGooglePlaces(rows=[]){
      if(!rows.length){googleList.hidden=true;googleList.innerHTML='';return;}
      googleList.hidden=false;
      const credits=[];rows.slice(0,20).forEach(p=>(p.attributions||[]).forEach(a=>{if(!credits.some(c=>c.provider===a.provider))credits.push(a);}));
      const pin='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/></svg>';
      googleList.innerHTML=`<div class="google-place-results-heading"><span class="google-maps-attribution" translate="no" lang="en">Google Maps</span><strong>สถานที่อ้างอิงในบริเวณนี้</strong><small>ข้อมูลภายนอก ไม่ใช่เรื่องราวจากชุมชน GERARAI · แตะชื่อเพื่อเลื่อนแผนที่</small></div>${rows.slice(0,20).map(p=>`<button type="button" class="google-place-result" data-source="google" data-google-place-lat="${p.latitude}" data-google-place-lng="${p.longitude}"><span class="google-place-result-pin">${pin}</span><span><strong>${esc(p.name)}</strong>${p.address?`<small>${esc(p.address)}</small>`:''}</span></button>`).join('')}${credits.length?`<p class="google-place-credits">ข้อมูลจาก ${credits.map(a=>a.uri?`<a href="${esc(a.uri)}" target="_blank" rel="noopener">${esc(a.provider)}</a>`:esc(a.provider)).join(', ')}</p>`:''}`;
    }
    function clear(){rows=[];next=null;selection=null;provider?.clear();selected.innerHTML='';list.innerHTML='';more.hidden=true;}
    function select(d) {
      if(disposed||hidden(d.post_id))return;
      selection=d.id;const p=d.post,c=D.category(d.category_code);
      selected.innerHTML=`<div class="discovery-preview-card"><button class="icon-button discovery-close" aria-label="ปิดการ์ด">×</button>${p.image?`<img src="${esc(p.image)}" alt="${esc(window.GerarAICheckinRead.heading(p))}">`:''}<div><small>${categoryIcon(c)} ${c.label}${d.location_precision==='approximate'?' · บริเวณโดยประมาณ':''}</small><h3>${esc(window.GerarAICheckinRead.heading(p))}</h3><p>${esc(p.body.slice(0,120))}</p><div class="discovery-author">${avatar(p)}<small>${esc(p.author)} ${p.handle?'@'+esc(p.handle):''} · ${esc(p.time)}</small></div><button class="primary discovery-open-story">อ่านเรื่องราว →</button></div></div>`;
      selected.querySelector('.discovery-close').onclick=()=>{selection=null;selected.innerHTML='';draw();};
      selected.querySelector('.discovery-open-story').onclick=async()=>{
        const btn=selected.querySelector('.discovery-open-story');btn.disabled=true;
        try {const full=remote()?await R.fetchPost(d.post_id):allPosts().find(p=>p.id===d.post_id);if(disposed)return;if(!full||hidden(d.post_id)){clear();setStatus('เรื่องราวนี้ไม่พร้อมแสดงแล้ว');return;}navigate('post/'+d.post_id);}catch{if(!disposed){btn.disabled=false;setStatus('เปิดเรื่องราวไม่ได้ ลองใหม่อีกครั้ง');}}
      };
      draw();
    }
    function draw() {
      list.innerHTML=rows.map(d=>card(d,selection===d.id)).join('');
      provider?.draw(rows,select,group=>{setStatus(`${group.length} เรื่องอยู่ใกล้กัน เลือกจากรายการด้านล่าง`);list.innerHTML=group.map(d=>card(d)).join('');list.scrollIntoView({block:'nearest',behavior:'smooth'});},selection);
    }
    async function load(append=false) {
      clearTimeout(timer);abort?.abort();abort=new AbortController();const run=++generation;
      if(!append)clear();loading=true;retry.hidden=true;more.hidden=true;setStatus('กำลังค้นหาสิ่งที่พบ…');
      try {
        if(!navigator.onLine&&remote())throw new Error('ขณะนี้ออฟไลน์ เชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
        if(remote()&&R.status!=='ready'){setStatus(R.status==='error'?'เชื่อมต่อระบบสมาชิกไม่ได้ กรุณาลองโหลดหน้าใหม่':'กำลังเชื่อมต่อ…');retry.hidden=false;return;}
        const b=provider?.bounds() || D.bounds(-90,-180,90,180);
        let result;
        if(remote())result=await R.discoveriesInViewport(b,filter,append?next:null,state.reported.map(r=>r.id),abort.signal);
        else {
          const found=allPosts().filter(p=>p.own&&p.discovery&&D.inside(p.discovery,b)&&(filter==='all'||p.discovery.category_code===filter)).map(p=>({...p.discovery,id:p.id,post_id:p.id,post:p})).sort((a,b)=>a.id.localeCompare(b.id));
          const page=found.filter(d=>!append||d.id>next).slice(0,200);result={rows:page,next:page.length===200?page[199].id:null};
        }
        if(disposed||run!==generation)return;
        rows=[...rows,...result.rows].filter(d=>!hidden(d.post_id));next=result.next;draw();
        setStatus(rows.length?`${rows.length} Discoveries${next?' · ยังมีเพิ่มเติม':''}`:'ยังไม่มี Discovery ในบริเวณนี้ ลองเลื่อนแผนที่หรือแชร์สิ่งที่คุณเจอ');
        if(rows.length>=600&&next)setStatus('แสดง 600 Discoveries แล้ว ซูมเข้าเพื่อดูบริเวณที่สนใจ');
        more.hidden=!next||rows.length>=600;
        return true;
      } catch(e) {
        if(disposed||run!==generation||e.name==='AbortError')return;
        clear();retry.hidden=false;
        setStatus(['PGRST202','PGRST205','42P01','42883'].includes(e.code)?'Map Discovery ยังไม่พร้อมบนเซิร์ฟเวอร์ กรุณาติดตั้ง migration Phase 3':(!navigator.onLine?'ขณะนี้ออฟไลน์ เชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่':'โหลด Discovery ไม่สำเร็จ ลองใหม่อีกครั้ง'));
      } finally {if(run===generation)loading=false;}
    }
    function moved(){if(!provider)return;if(emergencyOn)EUI.moved();camera=provider.view();abort?.abort();generation++;clear();setStatus('กำลังค้นหาในบริเวณใหม่…');clearTimeout(timer);timer=setTimeout(()=>load(),250);}
    const mapSourceNote=()=>main.querySelector('.discovery-source-note');
    const externalStatus=state=>{const note=mapSourceNote();if(!note)return;if(state.state==='loading')note.textContent='กำลังค้นหาหมุดจาก Google Places…';else if(state.state==='ready')note.textContent=`Google Places · ${state.count||0} จุดอ้างอิงในมุมมองนี้`;else if(state.state==='paused')note.textContent='Google Places พักชั่วคราว (ถึงโควตา) · ยังใช้ GERARAI Discovery ได้';else if(state.state==='error')note.textContent='Google Places โหลดไม่ได้ · ยังใช้ GERARAI Discovery ได้';};
    controller={dispose(){if(disposed)return;disposed=true;if(emergencyOn)EUI.detach();abort?.abort();generation++;clearTimeout(timer);if(provider){camera=provider.view();provider.destroy();}rows=[];},reload:()=>load()};
    list.onclick=e=>{const b=e.target.closest('[data-discovery-select]');if(b){const d=rows.find(x=>x.id===b.dataset.discoverySelect);if(d)select(d);}};
    googleList.onclick=e=>{const b=e.target.closest('[data-google-place-lat]');if(b&&provider){provider.setView(+b.dataset.googlePlaceLat,+b.dataset.googlePlaceLng,Math.max(15,provider.view().zoom));}};
    main.querySelector('.discovery-filters').onclick=e=>{const b=e.target.closest('[data-discovery-filter]');if(b){filter=b.dataset.discoveryFilter;navigate('map');}};
    main.querySelector('[data-discovery-reset]').onclick=()=>{controller?.dispose();controller=null;filter='all';camera={center:[16.3,99.9],zoom:6};navigate('map');};
    main.querySelector('[data-emergency-toggle]')?.addEventListener('click',()=>navigate(emergencyOn?'map':'map?mode=emergency'));
    more.onclick=()=>{if(!loading)load(true);};retry.onclick=()=>load();
    const focus=new URLSearchParams(route.split('?')[1]||'').get('story');
    const mapOptions={...camera,onMove:moved,onExternalStatus:externalStatus,onExternalPlaces:renderGooglePlaces,onTiles:ok=>{const el=main.querySelector('.discovery-tile-warning');if(el){el.hidden=ok;el.textContent='โหลดพื้นแผนที่ไม่ได้ แต่ยังดูรายการ Discovery ได้';}}};
    Promise.resolve().then(()=>Provider.createAsync?Provider.createAsync(document.getElementById('discovery-map'),mapOptions):Provider.create(document.getElementById('discovery-map'),mapOptions)).then(created=>{
      if(disposed){created.destroy?.();return;}
      provider=created;
      if(emergencyOn){provider.setEmergencyMode?.(true);EUI.attach(provider,{slot:document.getElementById('emergency-slot'),list:document.getElementById('emergency-list'),selected:document.getElementById('emergency-selected'),focus:new URLSearchParams(route.split('?')[1]||'').get('emergency')});}
      if(focus){
        (async()=>{
          try {const p=remote()?await R.fetchPost(focus):allPosts().find(p=>p.id===focus);if(disposed)return;const d=p?.discovery;if(d&&d.location_precision!=='hidden'&&!hidden(focus)){filter='all';provider.setView(d.latitude,d.longitude,15);camera=provider.view();if(!(await load())||disposed)return;let current=rows.find(x=>x.post_id===focus);if(!current){current={...d,id:d.id||p.id,post_id:p.id,post:p};rows=[current,...rows].slice(0,600);}select(current);}else{await load();if(!disposed)setStatus('เรื่องราวนี้ไม่มีตำแหน่งสาธารณะ หรือไม่พร้อมแสดง');}}catch{if(!disposed){setStatus('เปิดตำแหน่งไม่ได้ กรุณาลองใหม่');retry.hidden=false;}}
        })();
      }else load();
    }).catch(e=>{if(!disposed){setStatus(e.message);document.getElementById('discovery-map').innerHTML='<div class="empty-state">เปิดพื้นแผนที่ไม่ได้<br>ตรวจการตั้งค่า Google Maps หรือใช้ GERARAI Discovery ได้</div>';retry.hidden=true;}});
  }
  const baseRender=render;
  render=function(){controller?.dispose();controller=null;storyRequest++;baseRender();
    if(remote()&&route.startsWith('post/')&&!findPost(route.slice(5))&&R.status==='ready'){
      const id=route.slice(5),request=storyRequest;
      if(!R.isId(id)||hidden(id))return;
      main.innerHTML='<p class="empty-state" role="status">กำลังโหลดเรื่องราว…</p>';
      R.fetchPost(id).then(p=>{if(request!==storyRequest)return;if(p&&!hidden(id))baseRender();else main.innerHTML=empty('ไม่พบเรื่องราว','เรื่องราวอาจถูกลบหรือไม่พร้อมแสดง');}).catch(()=>{if(request===storyRequest)main.innerHTML=empty('โหลดเรื่องราวไม่ได้','ตรวจการเชื่อมต่อแล้วลองใหม่');});
    }
  };
  renderMap=renderDiscoveryMap;
  const basePostMarkup=postMarkup;
  postMarkup=function(p){let html=basePostMarkup(p);const d=p.discovery;if(d&&d.location_precision!=='hidden')html=html.replace('<div class="post-actions">',`<div class="story-map-link"><button class="secondary" data-discovery-map="${esc(p.id)}">${categoryIcon(D.category(d.category_code))} ดูบนแผนที่${d.location_precision==='approximate'?' · โดยประมาณ':''}</button></div><div class="post-actions">`);return html;};
  document.addEventListener('click',e=>{const b=e.target.closest('[data-discovery-map]');if(b){e.preventDefault();filter='all';navigate('map?story='+encodeURIComponent(b.dataset.discoveryMap));}});
  window.addEventListener('gerarai:identity-changing',()=>{controller?.dispose();controller=null;storyRequest++;if(route.startsWith('map')){main.innerHTML='<p class="empty-state">กำลังเปลี่ยนบัญชี…</p>';}});
  window.addEventListener('offline',()=>controller?.reload());window.addEventListener('online',()=>controller?.reload());
  // A GERARAI Discovery is allowed to stand on its own; it does not require
  // an external sample place. Add the local-only option while the composer is
  // open so legacy Explore/Map lists remain unchanged.
  const localPlace={id:'',slug:'',name:'ไม่ผูกกับสถานที่ตัวอย่าง',city:'GERARAI',description:'',category:'other',coords:[16.3,99.9],rating:'—',reviews:0,image:'',is_sample:true};
  let localPlaceAdded=false;
  const ensureLocalPlace=()=>{if(!remote()&&!localPlaceAdded&&!places.some(p=>p.id==='')){places.unshift(localPlace);localPlaceAdded=true;}};
  const removeLocalPlace=()=>{if(localPlaceAdded){const i=places.indexOf(localPlace);if(i>=0)places.splice(i,1);localPlaceAdded=false;}};
  const baseCompose=compose;
  compose=function(placeId=''){ensureLocalPlace();baseCompose(placeId);};
  const baseEditPost=editPost;
  editPost=function(id){ensureLocalPlace();baseEditPost(id);};
  dialog.addEventListener('close',removeLocalPlace);
  window.GerarAIDiscoveryUI={mount,read};
  if(!remote()||route==='map'||route.startsWith('map?'))render();
})();
