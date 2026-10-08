/* Shared My/Public Profile summary. No map, coordinates, or client aggregation. */
(() => {
  'use strict';
  let active = null;
  const remote = () => window.GerarAIRemote;
  const clear = () => { if (active) { active.controller.abort(); active.host.replaceChildren(); active = null; } };
  function mount(force = false) {
    if (document.hidden) { clear(); return; }
    const host = document.querySelector('[data-journey-profile]');
    if (!host || !remote()?.enabled) { clear(); return; }
    if (!force && active?.host === host) return;
    clear();
    const current = active = { host, controller: new AbortController(), epoch: remote().epoch };
    host.innerHTML = '<section class="journey-summary" aria-label="บันทึกการค้นพบ"><header><span class="journey-kicker">YOUR WORLD, YOUR STORIES</span><h2>บันทึกการค้นพบ</h2></header><div class="journey-body" aria-live="polite"><p>กำลังโหลดบันทึกการค้นพบ…</p></div></section>';
    const body = host.querySelector('.journey-body');
    remote().journeySummary(host.dataset.journeyProfile, { signal: current.controller.signal,
      exclude: typeof state !== 'undefined' ? (state.reported || []).map(x => x.id) : []
    }).then(data => {
      if (active !== current || !host.isConnected || current.epoch !== remote().epoch) return;
      const format = n => n.toLocaleString('th-TH');
      body.innerHTML = `<div class="journey-metrics"><div><strong>${format(data.discoveries)}</strong><span>จุดค้นพบ</span><small>จากเรื่องราวสาธารณะ</small></div><div><strong>${format(data.places)}</strong><span>สถานที่ที่ยืนยันได้</span><small>นับสถานที่เดิมเพียงครั้งเดียว</small></div></div>${data.discoveries === 0 ? '<p class="journey-empty">ยังไม่มีรอยทางสาธารณะที่แสดงได้</p>' : ''}<p class="journey-note">จำนวนสถานที่นับเฉพาะจุดที่เปิดเผยตำแหน่งชัดเจนและเชื่อมกับสถานที่ที่ยืนยันแล้ว จึงอาจยังไม่ครบทุกการค้นพบ</p><div class="journey-countries"><h3>ประเทศที่เคยไป</h3><p>ยังไม่มีข้อมูลประเทศที่ยืนยันได้</p><small>ยังไม่มีข้อมูลเมืองที่ยืนยันได้</small></div>`;
    }).catch(() => {
      if (active !== current || !host.isConnected || current.epoch !== remote().epoch) return;
      body.innerHTML = '<p>ยังโหลดบันทึกการค้นพบไม่ได้</p><button type="button" class="secondary">ลองอีกครั้ง</button>';
      body.querySelector('button').addEventListener('click', () => mount(true));
    });
  }
  window.addEventListener('gerarai:identity-changing', clear);
  window.addEventListener('hashchange', clear);
  window.addEventListener('focus', () => mount(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); else mount(true); });
  new MutationObserver(() => mount()).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
  mount();
})();
