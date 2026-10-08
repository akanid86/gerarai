'use strict';
/* Leaflet stays behind this adapter; Discovery IDs and coordinates never depend on it. */
window.GerarAIMapProvider = {
  create(element, {center=[16.3,99.9],zoom=6,onMove,onPick,onTiles}={}) {
    if (!window.L) throw new Error('แผนที่ยังโหลดไม่สำเร็จ ใช้รายการหรือกรอกพิกัดได้');
    const L=window.L, map=L.map(element,{worldCopyJump:true}).setView(center,zoom);
    const cfg=window.GERARAI_CONFIG.map || {};
    const tiles=L.tileLayer(cfg.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:cfg.attribution || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
    const layer=L.layerGroup().addTo(map), emergencyLayer=L.layerGroup().addTo(map); let pin=null, failures=0;
    tiles.on('tileload',()=>{failures=0;onTiles?.(true);});
    tiles.on('tileerror',()=>{if(++failures>=3)onTiles?.(false);});
    map.on('moveend',()=>onMove?.());
    if(onPick)map.on('click',e=>onPick(e.latlng.lat,GerarAIDiscovery.longitude(e.latlng.lng)));
    const api={
      view(){const c=map.getCenter();return {center:[c.lat,c.lng],zoom:map.getZoom()};},
      bounds(){const b=map.getBounds();return GerarAIDiscovery.bounds(b.getSouth(),b.getWest(),b.getNorth(),b.getEast());},
      setView(lat,lng,z=15){map.setView([lat,lng],z);},
      resize(){map.invalidateSize();},
      clear(){layer.clearLayers();},
      pin(d){if(pin)map.removeLayer(pin);pin=null;if(d?.latitude!=null)pin=L.circleMarker([d.latitude,d.longitude],{radius:10,color:'#325c48',fillOpacity:.65}).addTo(map);},
      draw(rows,onSelect,onCluster,selected){
        layer.clearLayers();
        const groups=GerarAIDiscovery.clusters(rows,(lat,lng)=>map.latLngToContainerPoint([lat,lng]));
        groups.forEach(group=>{
          const d=group[0], multi=group.length>1, c=GerarAIDiscovery.category(d.category_code);
          const lat=group.reduce((s,x)=>s+x.latitude,0)/group.length;
          const origin=d.longitude, lng=GerarAIDiscovery.longitude(origin+group.reduce((s,x)=>s+GerarAIDiscovery.longitude(x.longitude-origin),0)/group.length);
          const marker=L.marker([lat,lng],{keyboard:true,title:multi?`${group.length} Discoveries`:c.label,alt:multi?'กลุ่ม Discovery':c.label,icon:L.divIcon({className:'discovery-marker',html:multi?`<span class="discovery-cluster">${group.length}</span>`:`<span class="discovery-pin ${selected===d.id?'selected':''}" style="--pin:${c.color}">${GerarAIDiscovery.markerSvg(c.code)}</span>`,iconSize:[44,48],iconAnchor:[22,44]})}).addTo(layer);
          marker.on('click',()=>{if(!multi)return onSelect(d);if(map.getZoom()<18)map.setView([lat,lng],Math.min(18,map.getZoom()+2));else onCluster(group);});
        });
      },
      /* Emergency layer (GERARAI-owned data only). Freshness is text inside the marker, not colour alone. */
      drawEmergency(rows,onSelect,selected){
        emergencyLayer.clearLayers();
        rows.forEach(e=>{
          const m=emergencyMarkerHtml(e,selected===e.id);
          const marker=L.marker([e.latitude,e.longitude],{keyboard:true,title:m.label,alt:m.label,zIndexOffset:1000,icon:L.divIcon({className:'emergency-marker',html:m.html,iconSize:null,iconAnchor:[22,44]})}).addTo(emergencyLayer);
          marker.on('click',()=>onSelect(e));
        });
      },
      clearEmergency(){emergencyLayer.clearLayers();},
      setEmergencyMode(on){element.classList.toggle('emergency-mode',!!on);},
      destroy(){map.remove();}
    };
    requestAnimationFrame(()=>{if(element.isConnected)api.resize();});
    return api;
  }
};

/* Google Maps/Places provider. It is opt-in so local development keeps the
 * existing Leaflet/OSM map until a restricted browser key is configured. */
let googleMapsLoadPromise=null;

/* Google Places reference layer — request budget (approved 30 Sep 22:53).
 * SearchNearby used to run on every map "idle" (open, pan, zoom) with no limit, which exhausted the key's quota
 * (HTTP 429). Now: debounce · area cache shared by every map instance · no new search until the view leaves the
 * cached area significantly · newest request wins (older answers are discarded; the Places JS SDK has no abort) ·
 * exponential pause after 429/quota errors. Places failures never touch GERARAI Discovery. */
const PLACES_DEFAULTS={debounceMs:800,cacheTtlMs:10*60*1000,cacheMax:40,moveRatio:0.5,zoomRatio:2,backoffMinMs:30*1000,backoffMaxMs:15*60*1000};
const placesBudget={cache:[],backoffUntil:0,backoffMs:0,requests:0,cacheHits:0,throttled:0,discarded:0,lastError:''};
window.__gerarAIPlacesBudget=placesBudget;   // read-only diagnostics (tests, console)
// The pause survives a reload in this tab (a daily quota does not reset on reload); storage may be unavailable.
try { const saved=JSON.parse(sessionStorage.getItem('gerarai-places-backoff')||'null'); if(saved&&saved.until>Date.now()){placesBudget.backoffUntil=saved.until;placesBudget.backoffMs=saved.ms||0;} } catch { /* ignore */ }
const savePlacesBackoff=()=>{try{sessionStorage.setItem('gerarai-places-backoff',JSON.stringify({until:placesBudget.backoffUntil,ms:placesBudget.backoffMs}));}catch{/* ignore */}};
const placesCfg=()=>({...PLACES_DEFAULTS,...(window.GERARAI_CONFIG?.map?.google?.places||{})});
const isQuotaError=e=>/\b429\b|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|quota|rate ?limit/i.test(String(e?.code||'')+' '+String(e?.message||e||''));
function placesCacheFind(center,radius,distance){
  const c=placesCfg(),now=Date.now();
  placesBudget.cache=placesBudget.cache.filter(x=>now-x.at<c.cacheTtlMs);
  return placesBudget.cache.find(x=>distance(center,x.center)<=x.radius*c.moveRatio&&radius<=x.radius*c.zoomRatio&&radius>=x.radius/c.zoomRatio)||null;
}
/* Third-party data providers Google asks us to credit (Place.attributions, returned with every Place). Only the provider
 * name and its link are shown; nothing is stored. */
function placeAttributions(place){
  try{return (Array.isArray(place?.attributions)?place.attributions:[]).map(a=>({provider:String(a?.provider||'').slice(0,80),uri:/^https:\/\//.test(String(a?.providerURI||''))?String(a.providerURI):''})).filter(a=>a.provider);}
  catch{return [];}
}
/* Google content lives only in this tab's memory for the current member: switching account drops it (the quota pause
 * is kept — it belongs to the API key, not to the member). */
window.addEventListener('gerarai:identity-changing',()=>{placesBudget.cache=[];});
function placesCacheStore(entry){
  placesBudget.cache.unshift(entry);
  placesBudget.cache.length=Math.min(placesBudget.cache.length,placesCfg().cacheMax);
}
function loadGoogleMaps() {
  const cfg=window.GERARAI_CONFIG?.map?.google || {};
  if(!cfg.apiKey) return Promise.reject(new Error('ยังไม่ได้ตั้งค่า Google Maps API key'));
  if(window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if(googleMapsLoadPromise)return googleMapsLoadPromise;
  googleMapsLoadPromise=new Promise((resolve,reject)=>{
    const callback=`geraraiGoogleMapsReady_${Date.now()}`;
    const script=document.createElement('script');
    const params=new URLSearchParams({key:cfg.apiKey,v:'weekly',loading:'async',callback});
    window[callback]=()=>{delete window[callback];resolve(window.google.maps);};
    script.src=`https://maps.googleapis.com/maps/api/js?${params}`;
    script.async=true;script.defer=true;
    script.onerror=()=>{delete window[callback];reject(new Error('โหลด Google Maps ไม่สำเร็จ ตรวจ API key, billing และการจำกัดโดเมน'))};
    document.head.appendChild(script);
  }).catch(error=>{googleMapsLoadPromise=null;throw error;});
  return googleMapsLoadPromise;
}

function emergencyMarkerHtml(e, selected) {
  const E=window.GerarAIEmergency, rules=window.GerarAIRemote?.emergency?.rules;
  const rule=E.ruleMap(rules).get(e.type_code) || {icon:'📍',label_th:e.type_code};
  const f=E.freshness(e,rules,window.GerarAIRemote?.emergencyNow?.());
  const label=`${rule.label_th} · ${f.label} · ${f.ageText}`;
  const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return {label,state:f.state,html:`<span class="emg-pin emg-${f.state} ${selected?'selected':''} ${e.source_type==='official'?'emg-official':''}" aria-label="${esc(label)}"><b aria-hidden="true">${window.GerarAICategoryIcons.render(e.type_code,rule.icon)}</b><i>${esc(f.label)}</i></span>`};
}

function googleMarkerContent(className, html, label) {
  const el=document.createElement('span');
  el.className=className;
  el.innerHTML=html;
  if(label)el.setAttribute('aria-label',label);
  return el;
}

/* Google reference markers must never look like GERARAI content (M2 Place Disclosure P4/G3): a neutral grey pin,
 * no GERARAI mark, and an explicit "Google Maps" source in the accessible name. */
const NEUTRAL_PIN_SVG='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/></svg>';
function googlePlaceMarkerContent(label, showLabel) {
  const el=googleMarkerContent('google-place-marker',NEUTRAL_PIN_SVG,label?`${label} · Google Maps`:'Google Maps');
  el.dataset.source='google';
  if(showLabel){const name=document.createElement('span');name.className='google-place-marker-name';name.textContent=label;el.append(name);}
  return el;
}

async function createGoogleMap(element, options={}) {
  const cfg=window.GERARAI_CONFIG?.map?.google || {};
  await loadGoogleMaps();
  const [{Map,InfoWindow},{AdvancedMarkerElement},{Place,SearchNearbyRankPreference},{spherical}]=await Promise.all([
    google.maps.importLibrary('maps'),
    google.maps.importLibrary('marker'),
    google.maps.importLibrary('places'),
    google.maps.importLibrary('geometry')
  ]);
  const center=options.center || [16.3,99.9];
  const map=new Map(element,{center:{lat:+center[0],lng:+center[1]},zoom:options.zoom||6,mapId:cfg.mapId||'DEMO_MAP_ID',mapTypeControl:false,streetViewControl:false,fullscreenControl:false,gestureHandling:'greedy'});
  const info=new InfoWindow();
  let discoveryMarkers=[],externalMarkers=[],externalRows=[],emergencyMarkers=[],pin=null,disposed=false,externalRun=0;
  const clearEmergency=()=>{emergencyMarkers.forEach(marker=>marker.map=null);emergencyMarkers=[];};
  const clearDiscovery=()=>{discoveryMarkers.forEach(marker=>marker.map=null);discoveryMarkers=[];};
  const clearExternal=()=>{externalMarkers.forEach(marker=>marker.map=null);externalMarkers=[];};
  const bounds=()=>{const b=map.getBounds();return b?GerarAIDiscovery.bounds(b.getSouthWest().lat(),b.getSouthWest().lng(),b.getNorthEast().lat(),b.getNorthEast().lng()):GerarAIDiscovery.bounds(-90,-180,90,180);};
  const markerPosition=d=>({lat:+d.latitude,lng:+d.longitude});
  function externalInfo(place,marker) {
    const wrap=document.createElement('div');wrap.className='google-place-info';
    const title=document.createElement('strong');title.textContent=place.displayName || 'สถานที่อ้างอิงจาก Google Maps';
    const source=document.createElement('small');source.textContent='สถานที่อ้างอิงจาก Google Maps';
    wrap.append(title,source);
    if(place.formattedAddress){const address=document.createElement('span');address.textContent=place.formattedAddress;wrap.append(address);}
    if(place.googleMapsURI){const link=document.createElement('a');link.href=place.googleMapsURI;link.target='_blank';link.rel='noopener';link.textContent='เปิดใน Google Maps ↗';wrap.append(link);}
    const credits=placeAttributions(place);
    if(credits.length){const c=document.createElement('small');c.className='google-place-credits';c.append('ข้อมูลจาก ');
      credits.forEach((a,i)=>{if(i)c.append(', ');if(a.uri){const l=document.createElement('a');l.href=a.uri;l.target='_blank';l.rel='noopener';l.textContent=a.provider;c.append(l);}else c.append(a.provider);});wrap.append(c);}
    info.setContent(wrap);info.open({map,anchor:marker});
  }
  const renderExternal=(places,extra={})=>{
    clearExternal();
    places.forEach(place=>{
      if(!place.location)return;
      const label=place.displayName || 'Google Place';
      const content=googlePlaceMarkerContent(label,map.getZoom()>=11);
      const marker=new AdvancedMarkerElement({map,position:place.location,title:label,gmpClickable:true,content});
      marker.addEventListener('gmp-click',()=>externalInfo(place,marker));
      externalMarkers.push(marker);
    });
    externalRows=places.map(place=>({id:place.id||place.name,name:place.displayName||'Google Place',address:place.formattedAddress||'',uri:place.googleMapsURI||'',attributions:placeAttributions(place),latitude:place.location.lat(),longitude:place.location.lng()}));
    safe(()=>options.onExternalPlaces?.(externalRows));
    safe(()=>options.onExternalStatus?.({state:'ready',count:externalMarkers.length,...extra}));
  };
  const safe=fn=>{try{fn();}catch(e){console.warn('[GERARAI] Google Places layer:',e?.message);}};   // never breaks Discovery
  async function searchExternal() {
    if(disposed)return;
    const visible=map.getBounds();if(!visible)return;
    const ne=visible.getNorthEast(),sw=visible.getSouthWest(),c=map.getCenter();
    /* Nearby Search can return no rows when a tight zoom produces a tiny
     * radius. Keep a useful local search window so zooming in does not make
     * every external marker disappear. */
    const diameter=spherical.computeDistanceBetween(ne,sw),radius=Math.min(Math.max(diameter/2,2500),50000);
    const center={lat:c.lat(),lng:c.lng()},distance=(a,b)=>spherical.computeDistanceBetween(a,b);
    const hit=placesCacheFind(center,radius,distance);
    if(hit){placesBudget.cacheHits++;renderExternal(hit.places,{cached:true});return;}
    if(Date.now()<placesBudget.backoffUntil){placesBudget.throttled++;safe(()=>options.onExternalStatus?.({state:'paused',until:placesBudget.backoffUntil,count:externalMarkers.length}));return;}
    const run=++externalRun;safe(()=>options.onExternalStatus?.({state:'loading'}));
    try {
      const request={fields:['displayName','location','formattedAddress','googleMapsURI','id'],locationRestriction:{center:c,radius},maxResultCount:Math.min(20,Math.max(1,+(cfg.maxResults||20))),rankPreference:SearchNearbyRankPreference.POPULARITY};
      placesBudget.requests++;
      const result=await Place.searchNearby(request);
      placesBudget.backoffMs=0;placesBudget.lastError='';
      const places=(result.places||[]).filter(place=>place.location);
      placesCacheStore({center,radius,places,at:Date.now()});
      if(disposed||run!==externalRun){placesBudget.discarded++;return;}   // a newer view superseded this answer
      renderExternal(places);   // 0 rows = an empty list for THIS view — never the previous area's places (G6)
    } catch(error) {
      placesBudget.lastError=String(error?.message||error).slice(0,200);
      if(isQuotaError(error)){
        const pc=placesCfg();placesBudget.backoffMs=Math.min(pc.backoffMaxMs,Math.max(pc.backoffMinMs,placesBudget.backoffMs*2));
        placesBudget.backoffUntil=Date.now()+placesBudget.backoffMs;
        savePlacesBackoff();
      }
      if(disposed||run!==externalRun)return;
      if(isQuotaError(error)){safe(()=>options.onExternalStatus?.({state:'paused',until:placesBudget.backoffUntil,count:externalMarkers.length}));return;}   // keep what is on the map
      clearExternal();safe(()=>options.onExternalStatus?.({state:'error',error}));
    }
  }
  let searchTimer=null;
  const scheduleSearch=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{searchTimer=null;if(!disposed)void searchExternal();},placesCfg().debounceMs);};
  const idleListener=map.addListener('idle',()=>{if(disposed)return;options.onMove?.();scheduleSearch();});
  const clickListener=options.onPick?map.addListener('click',event=>{if(event.latLng)options.onPick(event.latLng.lat(),GerarAIDiscovery.longitude(event.latLng.lng()));}):null;
  options.onTiles?.(true);
  const api={
    view(){const c=map.getCenter();return {center:[c.lat(),c.lng()],zoom:map.getZoom()};},
    bounds,
    setView(lat,lng,z=15){map.setCenter({lat:+lat,lng:+lng});map.setZoom(z);},
    resize(){google.maps.event.trigger(map,'resize');},
    /* Discovery reloads on every viewport move; keep the external layer alive
     * until the next Places response so a tight zoom never flashes it away. */
    clear(){clearDiscovery();info.close();},
    pin(d){if(pin)pin.map=null;pin=null;if(d?.latitude!=null){const content=googleMarkerContent('discovery-location-pin','<span aria-hidden="true"></span>','ตำแหน่งที่เลือก');pin=new AdvancedMarkerElement({map,position:markerPosition(d),content});}},
    draw(rows,onSelect,onCluster,selected){
      clearDiscovery();
      rows.forEach(d=>{
        if(d.latitude==null||d.longitude==null)return;
        const c=GerarAIDiscovery.category(d.category_code),content=googleMarkerContent(`discovery-pin ${selected===d.id?'selected':''}`,GerarAIDiscovery.markerSvg(c.code),c.label);
        const marker=new AdvancedMarkerElement({map,position:markerPosition(d),title:c.label,gmpClickable:true,content});
        marker.addEventListener('gmp-click',()=>onSelect(d));discoveryMarkers.push(marker);
      });
    },
    drawEmergency(rows,onSelect,selected){
      clearEmergency();
      rows.forEach(e=>{
        const m=emergencyMarkerHtml(e,selected===e.id),content=googleMarkerContent('emergency-marker',m.html,m.label);
        const marker=new AdvancedMarkerElement({map,position:markerPosition(e),title:m.label,gmpClickable:true,content,zIndex:1000});
        marker.addEventListener('gmp-click',()=>onSelect(e));emergencyMarkers.push(marker);
      });
    },
    clearEmergency,
    setEmergencyMode(on){element.classList.toggle('emergency-mode',!!on);},
    destroy(){disposed=true;externalRun++;clearTimeout(searchTimer);idleListener?.remove?.();clickListener?.remove?.();clearDiscovery();clearExternal();clearEmergency();if(pin)pin.map=null;info.close();}
  };
  requestAnimationFrame(()=>{if(element.isConnected){api.resize();scheduleSearch();}});
  return api;
}

window.GerarAIMapProvider.createAsync=async function(element,options={}) {
  const cfg=window.GERARAI_CONFIG?.map || {};
  if(cfg.provider==='google'&&cfg.google?.enabled)return createGoogleMap(element,options);
  if(cfg.provider==='google')throw new Error('Google Maps provider ยังไม่เปิดใช้งานใน config.js');
  return window.GerarAIMapProvider.create(element,options);
};
/*
 * Optional external reference layer.
 *
 * The current map remains Leaflet/OSM until a Google Maps provider is
 * configured. Keeping this contract separate prevents Google place content
 * from being persisted as GERARAI-owned Discoveries. A live adapter should
 * return only the fields needed for the current view and retain `place_id` as
 * the stable reference; it must also render on a Google map with attribution.
 */
const googleMapConfig=window.GERARAI_CONFIG?.map?.google || {};
window.GerarAIPlacesProvider = {
  source:'google',
  configured:()=>Boolean(googleMapConfig.enabled && googleMapConfig.apiKey),
  available:false,
  reason:googleMapConfig.enabled && googleMapConfig.apiKey ? 'google-adapter-pending' : 'google-api-key-not-configured',
  async search(){return {rows:[],next:null,available:false,reason:this.reason};},
  async details(){return null;}
};
