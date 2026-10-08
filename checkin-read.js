'use strict';
// Public-safe presentation only. Editing consumes story_checkin_for_edit separately.
(function(root){
  const kinds=new Set(['none','area','venue','current_location','map_pin','legacy_unconfirmed']);
  const points=new Set(['current_location','map_pin','legacy_unconfirmed']);
  function point(d,postId){
    if(!d||d.post_id!==postId||d.provider||d.source==='google'||!['exact','approximate'].includes(d.location_precision))return null;
    const lat=d.latitude,lng=d.longitude;
    if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
    // Never fix/mask precise coordinates on the client: reject a broken approximate response.
    if(d.location_precision==='approximate'&&(Math.abs(lat*100-Math.round(lat*100))>1e-7||Math.abs(lng*100-Math.round(lng*100))>1e-7))return null;
    return {id:d.id,post_id:d.post_id,user_id:d.user_id,category_code:d.category_code,latitude:lat,longitude:lng,location_precision:d.location_precision};
  }
  function apply(p,r){
    Object.assign(p,{checkinKind:'none',areaId:'',areaLabel:'',city:'',location:'',place:'',placeName:'',placeDisclosure:'private',ownPlace:null,discovery:null});
    if(!r||r.post_id!==p.id||!kinds.has(r.kind)||r.kind==='none')return p;
    p.checkinKind=r.kind;
    if(['area','venue'].includes(r.disclosure)){
      p.placeDisclosure=r.disclosure;p.city=r.area_label||'';p.areaLabel=p.city;
      p.location=[p.city,r.country_code||''].filter(Boolean).join(', ');
      if(r.kind==='area'){p.areaId=r.area_id||'';p.placeDisclosure='area';}
      else if(r.disclosure==='venue'){p.place=r.place_slug||'';p.placeName=r.place_name||'';}
    }
    if(points.has(r.kind))p.discovery=point(r.discovery,p.id);
    return p;
  }
  // Presentation only: never assign this snippet to stored Story content.
  function heading(p){return (p.title||'').trim()||Array.from((p.body||'').trim()).slice(0,80).join('')||'ภาพจากเรื่องราว';}
  root.GerarAICheckinRead={apply,point,heading};
  if(typeof module!=='undefined')module.exports=root.GerarAICheckinRead;
})(typeof window==='undefined'?globalThis:window);
