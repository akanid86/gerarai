'use strict';
// Read-side only: public area selection, bounded server search, no GPS/provider calls.
(function(){
  const R=window.GerarAIRemote;if(!R?.enabled)return;
  const base=renderExplore;let areaId=null,generation=0;
  renderExplore=function(){
    base();const g=++generation,epoch=R.epoch||0,term=query;
    const section=document.createElement('section');section.className='checkin-explore';
    section.innerHTML='<h2 class="section-title">เรื่องราวที่ค้นพบ</h2><div data-area-options></div><p data-search-status role="status">กำลังค้นหา…</p><div class="saved-layout" data-search-posts></div><button class="secondary" data-search-next hidden>ดูเพิ่มเติม</button>';
    main.querySelector('.explore-page').append(section);
    const current=()=>g===generation&&section.isConnected&&(R.epoch||0)===epoch;
    const status=section.querySelector('[data-search-status]'),list=section.querySelector('[data-search-posts]'),next=section.querySelector('[data-search-next]');
    let cursor=null;
    async function load(append=false){
      next.disabled=true;
      try{
        const result=await R.exploreStories({areaId,query:term,cursor:append?cursor:null,exclude:(state.reported||[]).map(x=>x.id)});
        if(!current())return;
        status.textContent=`พบ ${result.total} เรื่องราว`;
        if(!append)list.innerHTML='';list.insertAdjacentHTML('beforeend',result.posts.map(postMarkup).join(''));
        cursor=result.next;next.hidden=!cursor;next.disabled=false;
      }catch{if(current()){status.textContent='โหลดเรื่องราวไม่ได้ กรุณาลองใหม่';next.hidden=true;}}
    }
    next.addEventListener('click',()=>load(true));load();
    R.searchAreas(term).then(areas=>{
      if(!current())return;
      section.querySelector('[data-area-options]').innerHTML=`<button class="secondary" data-checkin-area="" aria-pressed="${!areaId}">ทุกพื้นที่</button>`+areas.map(a=>`<button class="secondary" data-checkin-area="${esc(a.id)}" aria-pressed="${a.id===areaId}">${esc(a.display_name)}</button>`).join('');
    }).catch(()=>{});
  };
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-checkin-area]');if(!b)return;
    const id=b.dataset.checkinArea;if(id&&!R.isId(id))return;
    event.preventDefault();areaId=id||null;query='';cityFilter='';
    if(route==='explore')renderExplore();else location.hash='explore';
  });
  window.addEventListener('gerarai:identity-changing',()=>{generation++;areaId=null;document.querySelector('.checkin-explore')?.remove();});
})();
