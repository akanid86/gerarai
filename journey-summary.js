/* GERARAI Profile Journey v0.1 (candidate R20): Mini Journey Map + Travel Summary + Countries Visited on My / Public Profile, and
 * the Full Journey Map route #journey/<profile_id>[/<CC>]. Everything comes from two viewer-aware server reads
 * (profile_journey, profile_journey_points): no client aggregation of other members' data, no provider calls (no Geoapify,
 * no Google), Leaflet + the configured OSM tiles only, no route lines, AREA check-ins are labels (never map points). */
(() => {
  'use strict';
  const I18N_TH = {
    'journey.kicker': 'YOUR WORLD, YOUR STORIES', 'journey.title': 'แผนที่การเดินทาง',
    'journey.subOwn': 'ดูว่าคุณได้ไปที่ไหนบ้าง และจุดค้นพบที่น่าประทับใจตลอดการเดินทาง',
    'journey.subOther': 'ดูว่า {name} ได้ไปที่ไหนบ้าง และจุดค้นพบที่น่าประทับใจตลอดการเดินทาง',
    'journey.fullMap': 'ดูแผนที่เต็ม', 'journey.statsOwn': 'การเดินทางของคุณ', 'journey.statsOther': 'การเดินทางของ {name}',
    'journey.places': 'สถานที่ที่ไปแล้ว', 'journey.placesUnit': 'แห่ง', 'journey.discoveries': 'จุดค้นพบ', 'journey.discoveriesUnit': 'จุด',
    'journey.countries': 'ประเทศ', 'journey.countriesUnit': 'ประเทศ', 'journey.quote': 'ทุกการเดินทางคือการเก็บชิ้นส่วนของตัวเองให้สมบูรณ์ขึ้นทีละนิด',
    'journey.visited': 'ประเทศที่เคยไป', 'journey.seeAll': 'ดูทั้งหมด', 'journey.noCountry': 'ยังไม่มีประเทศที่ยืนยันได้จากการเช็กอิน',
    'journey.loading': 'กำลังโหลดแผนที่การเดินทาง…', 'journey.error': 'ยังโหลดแผนที่การเดินทางไม่ได้', 'journey.retry': 'ลองอีกครั้ง',
    'journey.emptyOwnTitle': 'เริ่มบันทึกสถานที่แรกของคุณ', 'journey.emptyOwnText': 'เช็กอินสถานที่ในเรื่องราว แล้วแผนที่การเดินทางของคุณจะค่อย ๆ เติบโตขึ้นที่นี่',
    'journey.emptyOwnAction': 'เพิ่มเรื่องราว', 'journey.emptyOther': 'ยังไม่มีการเดินทางที่แสดงให้คุณเห็นได้',
    'journey.noMapPoints': 'ยังไม่มีจุดที่แสดงบนแผนที่ได้', 'journey.mapFailed': 'แผนที่ยังโหลดไม่สำเร็จ',
    'journey.countryPlaces': '{n} สถานที่', 'journey.stories': '{n} เรื่องราว', 'journey.openStory': 'ดูเรื่องราว',
    'journey.fullTitleOwn': 'แผนที่การเดินทางของคุณ', 'journey.fullTitleOther': 'แผนที่การเดินทางของ {name}', 'journey.back': 'กลับไปโปรไฟล์',
    'journey.filterAll': 'ทั้งหมด', 'journey.areasTitle': 'พื้นที่ที่เช็กอิน', 'journey.areasNote': 'การเช็กอินระดับพื้นที่แสดงเป็นชื่อพื้นที่ ไม่ปักหมุดตำแหน่ง',
    'journey.placesTitle': 'สถานที่และจุดค้นพบ', 'journey.approx': 'ตำแหน่งโดยประมาณ', 'journey.point': 'จุดค้นพบ',
    'journey.external': 'ข้อมูลสถานที่จากผู้ให้บริการภายนอก', 'journey.nothingHere': 'ไม่มีข้อมูลที่แสดงได้สำหรับตัวกรองนี้',
    'journey.member': 'สมาชิก GERARAI', 'journey.listMore': 'แสดงเพิ่ม'
  };
  const I18N_EN = {
    'journey.kicker': 'YOUR WORLD, YOUR STORIES', 'journey.title': 'Journey map',
    'journey.subOwn': 'Where you have been and the discoveries along the way', 'journey.subOther': 'Where {name} has been and the discoveries along the way',
    'journey.fullMap': 'Full map', 'journey.statsOwn': 'Your journey', 'journey.statsOther': "{name}'s journey",
    'journey.places': 'Places visited', 'journey.placesUnit': 'places', 'journey.discoveries': 'Discoveries', 'journey.discoveriesUnit': 'spots',
    'journey.countries': 'Countries', 'journey.countriesUnit': 'countries', 'journey.quote': 'Every journey completes a little more of who you are',
    'journey.visited': 'Countries visited', 'journey.seeAll': 'See all', 'journey.noCountry': 'No country confirmed by a check-in yet',
    'journey.loading': 'Loading the journey map…', 'journey.error': 'Could not load the journey map', 'journey.retry': 'Try again',
    'journey.emptyOwnTitle': 'Record your first place', 'journey.emptyOwnText': 'Check in to a place in a story and your journey map grows here',
    'journey.emptyOwnAction': 'Add a story', 'journey.emptyOther': 'No journey you can see yet',
    'journey.noMapPoints': 'No points that can be shown on the map yet', 'journey.mapFailed': 'The map could not load',
    'journey.countryPlaces': '{n} places', 'journey.stories': '{n} stories', 'journey.openStory': 'Open story',
    'journey.fullTitleOwn': 'Your journey map', 'journey.fullTitleOther': "{name}'s journey map", 'journey.back': 'Back to profile',
    'journey.filterAll': 'All', 'journey.areasTitle': 'Areas checked in', 'journey.areasNote': 'Area check-ins are shown as area names, never as map pins',
    'journey.placesTitle': 'Places and discoveries', 'journey.approx': 'Approximate location', 'journey.point': 'Discovery',
    'journey.external': 'Place data from an external provider', 'journey.nothingHere': 'Nothing to show for this filter',
    'journey.member': 'GERARAI member', 'journey.listMore': 'Show more'
  };
  let registered = false;
  function t(key, vars = {}) {
    const I = window.GerarAII18n;
    if (I && !registered) { I.add('th', I18N_TH); I.add('en', I18N_EN); registered = true; }
    const raw = I ? I.t(key, vars) : String(I18N_TH[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    return raw === key && I18N_TH[key] ? I18N_TH[key] : raw;
  }
  const lang = () => (window.GerarAII18n ? window.GerarAII18n.lang() : 'th');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const remote = () => window.GerarAIRemote;
  const isId = v => !!remote()?.isId?.(v);
  const fmt = n => Number(n || 0).toLocaleString(lang() === 'en' ? 'en-US' : 'th-TH');
  const ISO = /^[A-Z]{2}$/;
  // D4: locally bundled flag images (assets/flags/<cc>.svg, Twemoji v14.0.1, CC-BY 4.0 — see assets/flags/LICENSE.txt). If an image
  // is missing or fails, the code itself is shown in the same circle (no emoji, no external request).
  const flag = (cc, cls = 'journey-flag-img') => ISO.test(cc)
    ? `<img class="${cls}" src="assets/flags/${cc.toLowerCase()}.svg" alt="" width="64" height="64" loading="lazy" decoding="async" data-journey-cc="${cc}">` : '';
  document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.journeyCc) return;
    const span = document.createElement('span'); span.className = 'journey-flag-code ' + img.className; span.textContent = img.dataset.journeyCc;
    img.replaceWith(span);
  }, true);
  function countryName(cc) {
    try { return new Intl.DisplayNames([lang() === 'en' ? 'en' : 'th'], { type: 'region' }).of(cc) || cc; } catch { return cc; }
  }
  const excluded = () => (typeof state !== 'undefined' ? (state.reported || []).map(x => x.id).filter(isId).slice(0, 1000) : []);
  const rpc = (name, args) => {
    if (typeof window.GerarAIJourneyRpc !== 'function') return Promise.reject(new Error('journey_unavailable'));
    return window.GerarAIJourneyRpc(name, args);
  };
  const category = code => window.GerarAIDiscovery?.category?.(code) || { label: t('journey.point'), color: '#4c8967', code: 'other' };

  /* ---------------------------------------------------------------- Leaflet (configured OSM tiles; never Google here) */
  function makeMap(el, { interactive = true } = {}) {
    const L = window.L; if (!L) throw new Error('leaflet_missing');
    const cfg = window.GERARAI_CONFIG?.map || {};
    const map = L.map(el, { worldCopyJump: true, zoomControl: interactive, scrollWheelZoom: interactive, attributionControl: true }).setView([15, 100], 3);
    L.tileLayer(cfg.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18,
      attribution: cfg.attribution || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
    return map;
  }
  function popupHtml(r) {
    const open = Array.isArray(r.post_ids) && isId(r.post_ids[0]) ? `<a href="#post/${esc(r.post_ids[0])}" class="journey-pop-link">${esc(t('journey.openStory'))}</a>` : '';
    if (r.kind === 'venue') {
      return `<div class="journey-pop"><strong>📍 ${esc(r.place_name || '')}</strong>${r.country_code ? `<small>${flag(r.country_code, 'journey-flag-img inline-flag')} ${esc(countryName(r.country_code))}</small>` : ''}`
        + `<small>${esc(t('journey.stories', { n: fmt(r.story_count) }))}</small>${r.origin === 'external' ? `<small class="journey-pop-src">${esc(t('journey.external'))}</small>` : ''}${open}</div>`;
    }
    const c = category(r.category_code);
    return `<div class="journey-pop"><strong>${esc(c.label)}</strong>${r.loc_precision === 'approximate' ? `<small>${esc(t('journey.approx'))}</small>` : ''}${open}</div>`;
  }
  /* screen-space clustering (shared with the Discovery map: GerarAIDiscovery.clusters); redrawn on zoom */
  function drawMarkers(map, layer, rows) {
    const L = window.L; layer.clearLayers();
    const pts = rows.filter(r => (r.kind === 'venue' || r.kind === 'point') && Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
    const groups = window.GerarAIDiscovery?.clusters ? window.GerarAIDiscovery.clusters(pts, (la, ln) => map.latLngToContainerPoint([la, ln]), 56) : pts.map(p => [p]);
    groups.forEach(g => {
      const lat = g.reduce((s, x) => s + x.latitude, 0) / g.length, lng = g.reduce((s, x) => s + x.longitude, 0) / g.length;
      if (g.length > 1) {
        const m = L.marker([lat, lng], { keyboard: true, title: String(g.length), icon: L.divIcon({ className: 'journey-marker', html: `<span class="journey-cluster">${g.length}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] }) }).addTo(layer);
        m.on('click', () => map.setView([lat, lng], Math.min(17, map.getZoom() + 2)));
        return;
      }
      const r = g[0], venue = r.kind === 'venue', c = category(r.category_code);
      const html = venue ? '<span class="journey-pin venue"><b aria-hidden="true">📍</b></span>' : `<span class="journey-pin point" style="--pin:${esc(c.color)}"><b aria-hidden="true">${window.GerarAIDiscovery?.markerSvg ? window.GerarAIDiscovery.markerSvg(c.code) : '•'}</b></span>`;
      const m = L.marker([r.latitude, r.longitude], { keyboard: true, title: venue ? (r.place_name || '') : c.label, alt: venue ? (r.place_name || '') : c.label,
        icon: L.divIcon({ className: 'journey-marker', html, iconSize: [34, 40], iconAnchor: [17, 38] }) }).addTo(layer);
      m.bindPopup(popupHtml(r));
    });
  }
  function fit(map, rows) {
    const pts = rows.filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude)).map(r => [r.latitude, r.longitude]);
    if (!pts.length) { map.setView([15, 100], 3); return; }              // neutral region view; never a guessed home
    if (pts.length === 1) { map.setView(pts[0], 10); return; }
    map.fitBounds(window.L.latLngBounds(pts), { padding: [28, 28], maxZoom: 12 });
  }

  /* ---------------------------------------------------------------- profile section */
  let active = null;
  function clear() {
    if (!active) return;
    active.abort = true; if (active.map) { try { active.map.remove(); } catch { /* gone */ } }
    if (active.io) active.io.disconnect(); active.host.replaceChildren(); active = null;
  }
  function statCard(icon, n, label, unit, tone) {
    return `<div class="journey-stat ${tone}"><span class="journey-stat-icon" aria-hidden="true">${icon}</span><strong>${fmt(n)}</strong><span>${esc(label)}</span><small>${esc(unit)}</small></div>`;
  }
  function flagsHtml(id, list, limit) {
    if (!list.length) return `<p class="journey-muted">${esc(t('journey.noCountry'))}</p>`;
    const shown = list.slice(0, limit);
    return `<div class="journey-flags" role="list">${shown.map(c => `<button type="button" class="journey-flag" role="listitem" data-journey-country="${esc(c.code)}" data-journey-of="${esc(id)}" title="${esc(countryName(c.code))}">`
      + `<span class="journey-flag-disc" aria-hidden="true">${flag(c.code)}</span><span class="journey-flag-name">${esc(countryName(c.code))}</span><small title="${esc(t('journey.stories', { n: fmt(c.stories) }))}">(${fmt(c.stories)})</small></button>`).join('')}`
      + (list.length > limit ? `<button type="button" class="journey-flag more" data-journey-full="${esc(id)}"><span class="journey-flag-disc" aria-hidden="true">+</span><span class="journey-flag-name">+${fmt(list.length - limit)}</span><small>${esc(t('journey.countriesUnit'))}</small></button>` : '')
      + '</div>';
  }
  // The full Journey shell ALWAYS renders (also at zero): mini map / empty-map preview, the three summary cards, "ประเทศที่เคยไป" with
  // its empty state, and the "ดูแผนที่เต็ม" control (disabled while there is nothing to show). Zero is the viewer-aware count, so it
  // never hints at hidden content. Before the summary arrives only the header + a loading line are shown.
  function fullBtn(id, enabled, cls) {
    return `<button type="button" class="journey-full-btn${cls ? ' ' + cls : ''}" data-journey-full="${esc(id)}"${enabled ? '' : ` disabled aria-disabled="true" title="${esc(t('journey.noMapPoints'))}"`}>🗺️ <span>${esc(t('journey.fullMap'))}</span> ›</button>`;
  }
  function sectionHtml(id, data, own, name) {
    const sub = own ? t('journey.subOwn') : t('journey.subOther', { name: esc(name) });
    const has = !!(data && data.discoveries > 0);
    const head = `<header class="journey-head"><div><span class="journey-kicker">${esc(t('journey.kicker'))}</span><h2>${esc(t('journey.title'))}</h2><p>${sub}</p></div>`
      + (data ? fullBtn(id, has) : '') + '</header>';
    if (!data) return head;
    const stats = statCard('⛰️', data.places, t('journey.places'), t('journey.placesUnit'), 'green') + statCard('📍', data.discoveries, t('journey.discoveries'), t('journey.discoveriesUnit'), 'rose')
      + statCard('🌏', data.countries, t('journey.countries'), t('journey.countriesUnit'), 'sky');   // Collections: no backend → no card
    const overlay = has ? (data.markers ? '' : `<p class="journey-map-empty">${esc(t('journey.noMapPoints'))}</p>`)
      : own ? `<div class="journey-map-empty journey-map-invite"><strong>${esc(t('journey.emptyOwnTitle'))}</strong><span>${esc(t('journey.emptyOwnText'))}</span><button type="button" class="primary" data-action="compose">${esc(t('journey.emptyOwnAction'))}</button></div>`
      : `<p class="journey-map-empty">${esc(t('journey.emptyOther'))}</p>`;
    return head + `<div class="journey-grid" data-journey-state="${has ? 'data' : 'empty'}"><div class="journey-mini"><div class="journey-map" data-journey-map></div>${overlay}</div>`
      + `<div class="journey-side"><div class="journey-card"><h3>🎒 ${esc(own ? t('journey.statsOwn') : t('journey.statsOther', { name }))}</h3><div class="journey-stats">${stats}</div>`
      + `<blockquote class="journey-quote">${esc(t('journey.quote'))}</blockquote></div>`
      + `<div class="journey-countries"><div class="journey-row"><h3>🗺️ ${esc(t('journey.visited'))}</h3>${data.country_list.length ? `<button type="button" class="text-button" data-journey-full="${esc(id)}">${esc(t('journey.seeAll'))} ›</button>` : ''}</div>${flagsHtml(id, data.country_list, 5)}</div></div></div>`
      + fullBtn(id, has, 'bottom');
  }
  // D3: flags show visible Stories per country, so they are also ordered by Stories (then ISO code) — one metric everywhere.
  const byStories = list => list.slice().sort((a, b) => b.stories - a.stories || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  function validSummary(d, id) {
    return d && d.version === 1 && d.profile_user_id === id && ['places', 'discoveries', 'countries', 'markers', 'areas'].every(k => Number.isSafeInteger(d[k]) && d[k] >= 0)
      && d.places <= d.discoveries && Array.isArray(d.country_list) && d.country_list.every(c => ISO.test(c.code) && Number.isSafeInteger(c.places) && Number.isSafeInteger(c.stories))
      && d.country_list.length === d.countries;
  }
  function mount(force = false) {
    if (document.hidden) { clear(); return; }
    const host = document.querySelector('[data-journey-profile]');
    if (!host || !remote()?.enabled) { clear(); return; }
    if (!force && active?.host === host) return;
    clear();
    const id = host.dataset.journeyProfile; if (!isId(id)) return;
    const own = remote().user?.id === id, name = host.dataset.journeyName || t('journey.member');
    const cur = active = { host, id, abort: false, epoch: remote().epoch, map: null, io: null };
    host.innerHTML = `<section class="journey" aria-label="${esc(t('journey.title'))}">${sectionHtml(id, null, own, name)}<div class="journey-body" aria-live="polite"><p class="journey-muted">${esc(t('journey.loading'))}</p></div></section>`;
    const stale = () => cur !== active || cur.abort || !host.isConnected || cur.epoch !== remote().epoch;
    rpc('profile_journey', { p_profile_id: id, p_exclude: excluded() }).then(data => {
      if (stale()) return;
      if (data === null) data = { version: 1, profile_user_id: id, places: 0, discoveries: 0, countries: 0, country_list: [], markers: 0, areas: 0 };
      if (!validSummary(data, id)) throw new Error('invalid_journey');
      data = { ...data, country_list: byStories(data.country_list) };
      host.querySelector('.journey').innerHTML = sectionHtml(id, data, own, name);
      const el = host.querySelector('[data-journey-map]');
      if (!el) return;
      const start = () => {                                         // lazy: the map and its points load only when on screen
        if (stale() || cur.map) return;
        try { cur.map = makeMap(el, { interactive: true }); } catch { el.innerHTML = `<p class="journey-map-empty">${esc(t('journey.mapFailed'))}</p>`; return; }
        const layer = window.L.layerGroup().addTo(cur.map);
        if (!data.markers) { fit(cur.map, []); return; }             // empty-map preview: neutral region view, no points request
        rpc('profile_journey_points', { p_profile_id: id, p_exclude: excluded(), p_limit: 150 }).then(rows => {
          if (stale() || !Array.isArray(rows)) return;
          fit(cur.map, rows); drawMarkers(cur.map, layer, rows);
          cur.map.on('zoomend', () => drawMarkers(cur.map, layer, rows));
        }).catch(() => {});
      };
      if ('IntersectionObserver' in window) { cur.io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { cur.io.disconnect(); start(); } }); cur.io.observe(el); }
      else start();
    }).catch(() => {
      if (stale()) return;
      const body = host.querySelector('.journey-body') || host.querySelector('.journey');
      body.innerHTML = `<p>${esc(t('journey.error'))}</p><button type="button" class="secondary" data-journey-retry>${esc(t('journey.retry'))}</button>`;
    });
  }

  /* ---------------------------------------------------------------- Full Journey Map (#journey/<id>[/<CC>]) */
  let full = null;
  function clearFull() { if (full) { full.abort = true; if (full.map) { try { full.map.remove(); } catch { /* gone */ } } full = null; } }
  function renderFull(main, id, cc, displayName) {
    clearFull();
    if (!isId(id) || (cc && !ISO.test(cc))) { main.innerHTML = `<div class="journey-full"><p>${esc(t('journey.nothingHere'))}</p></div>`; return; }
    const own = remote()?.user?.id === id, cur = full = { id, cc: cc || null, name: displayName || '', abort: false, epoch: remote()?.epoch, map: null };
    const back = own ? 'profile' : 'u/' + id;
    main.innerHTML = `<div class="journey-full"><button class="back-link" data-nav="${esc(back)}">‹ ${esc(t('journey.back'))}</button>`
      + `<header class="journey-full-head"><span class="journey-kicker">${esc(t('journey.kicker'))}</span><h1 data-journey-full-title>${esc(t('journey.title'))}</h1></header>`
      + `<div class="journey-full-grid"><div class="journey-full-map" data-journey-full-map></div><aside class="journey-full-side" data-journey-full-side><p class="journey-muted">${esc(t('journey.loading'))}</p></aside></div></div>`;
    const stale = () => cur !== full || cur.abort || cur.epoch !== remote()?.epoch || !document.querySelector('[data-journey-full-map]');
    const mapEl = main.querySelector('[data-journey-full-map]');
    try { cur.map = makeMap(mapEl, { interactive: true }); } catch { mapEl.innerHTML = `<p class="journey-map-empty">${esc(t('journey.mapFailed'))}</p>`; }
    const layer = cur.map ? window.L.layerGroup().addTo(cur.map) : null;
    const name = String(displayName || '').slice(0, 80);
    Promise.all([rpc('profile_journey', { p_profile_id: id, p_exclude: excluded() }),
                 rpc('profile_journey_points', { p_profile_id: id, p_country: cur.cc, p_exclude: excluded(), p_limit: 1000 })]).then(([sum, rows]) => {
      if (stale()) return;
      if (sum !== null && !validSummary(sum, id)) throw new Error('invalid_journey');
      rows = Array.isArray(rows) ? rows : [];
      const title = main.querySelector('[data-journey-full-title]');
      if (title) title.textContent = own ? t('journey.fullTitleOwn') : (name ? t('journey.fullTitleOther', { name }) : t('journey.title'));
      const list = sum ? byStories(sum.country_list) : [];
      const chips = `<div class="journey-filter" role="group"><button type="button" class="chip ${cur.cc ? '' : 'active'}" data-journey-filter="" data-journey-of="${esc(id)}" aria-pressed="${!cur.cc}">${esc(t('journey.filterAll'))}</button>`
        + list.map(c => `<button type="button" class="chip ${cur.cc === c.code ? 'active' : ''}" data-journey-filter="${esc(c.code)}" data-journey-of="${esc(id)}" aria-pressed="${cur.cc === c.code}">${flag(c.code, 'journey-flag-img chip-flag')} ${esc(countryName(c.code))} (${fmt(c.stories)})</button>`).join('') + '</div>';
      const totals = sum ? `<div class="journey-stats compact">${statCard('⛰️', sum.places, t('journey.places'), t('journey.placesUnit'), 'green')}${statCard('📍', sum.discoveries, t('journey.discoveries'), t('journey.discoveriesUnit'), 'rose')}${statCard('🌏', sum.countries, t('journey.countries'), t('journey.countriesUnit'), 'sky')}</div>` : '';
      const markers = rows.filter(r => r.kind !== 'area'), areas = rows.filter(r => r.kind === 'area');
      const item = r => r.kind === 'venue'
        ? `<li><button type="button" class="journey-item" data-journey-focus="${esc(r.latitude)},${esc(r.longitude)}">📍 <b>${esc(r.place_name || '')}</b><small>${r.country_code ? flag(r.country_code, 'journey-flag-img inline-flag') + ' ' : ''}${esc(t('journey.stories', { n: fmt(r.story_count) }))}</small></button></li>`
        : `<li><button type="button" class="journey-item" data-journey-focus="${esc(r.latitude)},${esc(r.longitude)}">${esc(category(r.category_code).label)}<small>${r.loc_precision === 'approximate' ? esc(t('journey.approx')) : esc(t('journey.point'))}</small></button></li>`;
      const side = main.querySelector('[data-journey-full-side]');
      side.innerHTML = totals + chips
        + (markers.length ? `<h3>${esc(t('journey.placesTitle'))}</h3><ul class="journey-list">${markers.slice(0, 60).map(item).join('')}</ul>` : '')
        + (areas.length ? `<h3>${esc(t('journey.areasTitle'))}</h3><p class="journey-muted">${esc(t('journey.areasNote'))}</p><ul class="journey-list">${areas.map(a => `<li><a class="journey-item" href="#post/${esc(a.post_ids[0])}">🏙️ <b>${esc(a.area_label || '')}</b><small>${a.country_code ? flag(a.country_code, 'journey-flag-img inline-flag') + ' ' : ''}${esc(t('journey.stories', { n: fmt(a.story_count) }))}</small></a></li>`).join('')}</ul>` : '')
        + (!markers.length && !areas.length ? `<p class="journey-muted">${esc(sum && sum.discoveries ? t('journey.nothingHere') : (own ? t('journey.emptyOwnText') : t('journey.emptyOther')))}</p>` : '');
      if (cur.map) {
        if (!markers.length) mapEl.insertAdjacentHTML('beforeend', `<p class="journey-map-empty overlay">${esc(t('journey.noMapPoints'))}</p>`);
        fit(cur.map, markers); drawMarkers(cur.map, layer, markers);
        cur.map.on('zoomend', () => drawMarkers(cur.map, layer, markers));
        requestAnimationFrame(() => cur.map && cur.map.invalidateSize());
      }
    }).catch(() => {
      if (stale()) return;
      const side = main.querySelector('[data-journey-full-side]');
      if (side) side.innerHTML = `<p>${esc(t('journey.error'))}</p><button type="button" class="secondary" data-journey-refull="${esc(id)}">${esc(t('journey.retry'))}</button>`;
    });
  }

  /* ---------------------------------------------------------------- events */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-journey-full],[data-journey-country],[data-journey-filter],[data-journey-focus],[data-journey-retry],[data-journey-refull]');
    if (!b) return;
    if (b.dataset.journeyRetry !== undefined) { e.preventDefault(); mount(true); return; }
    if (b.dataset.journeyRefull) { e.preventDefault(); renderFull(document.getElementById('main'), b.dataset.journeyRefull, full?.cc, full?.name); return; }
    if (b.dataset.journeyFocus) { e.preventDefault(); const [la, ln] = b.dataset.journeyFocus.split(',').map(Number); if (full?.map && Number.isFinite(la) && Number.isFinite(ln)) full.map.setView([la, ln], Math.max(full.map.getZoom(), 14)); return; }
    const id = b.dataset.journeyFull || b.dataset.journeyOf; if (!isId(id)) return;
    e.preventDefault();
    const cc = b.dataset.journeyCountry ?? b.dataset.journeyFilter ?? '';
    location.hash = 'journey/' + id + (ISO.test(cc) ? '/' + cc : '');
  });
  window.addEventListener('gerarai:identity-changing', () => { clear(); clearFull(); });
  window.addEventListener('hashchange', () => { clear(); if (!/^#journey\//.test(location.hash)) clearFull(); });
  window.addEventListener('focus', () => mount(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); else mount(true); });
  new MutationObserver(() => mount()).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
  window.GerarAIJourney = Object.freeze({ renderFull, mount, t });
  mount();
})();
