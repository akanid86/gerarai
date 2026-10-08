'use strict';
/* Provider-independent Discovery contract. No identity or precise-location cache. */
(function (root) {
  const categories = [
    ['food','อาหาร','🍜','#cf7447'], ['cafe','คาเฟ่','☕','#946847'],
    ['nature','ธรรมชาติ / วิว','🌲','#4c8967'], ['animal','สัตว์','🐾','#aa7950'],
    ['music_event','ดนตรี / กิจกรรม','♫','#9269a7'], ['life','ช่วงเวลาชีวิต','✦','#ce7395'],
    ['strange','สิ่งแปลก / ค้นพบ','?','#6879b7'], ['toilet','ห้องน้ำ','🚽','#428da4'],
    ['shower','ห้องอาบน้ำ','🚿','#4b9ca2'], ['other','อื่น ๆ','◆','#778477']
  ].map(([code,label,icon,color]) => Object.freeze({code,label,icon,color}));
  const category = code => categories.find(c => c.code === code) || categories[9];
  const longitude = n => ((n + 180) % 360 + 360) % 360 - 180;
  function normalize(value) {
    if (!value) return null;
    if (!categories.some(c => c.code === value.category_code)) throw new Error('เลือกหมวด Discovery');
    const precision = value.location_precision;
    if (!['exact','approximate','hidden'].includes(precision)) throw new Error('เลือกความละเอียดตำแหน่ง');
    let lat = value.latitude, lng = value.longitude;
    if (precision === 'hidden') return {category_code:value.category_code,location_precision:precision,latitude:null,longitude:null};
    if (lat === '' || lng === '' || lat == null || lng == null) throw new Error('แตะแผนที่หรือกรอกพิกัดก่อนบันทึก');
    lat = Number(lat); lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) throw new Error('พิกัดไม่ถูกต้อง');
    if (precision === 'approximate') { lat = Math.floor(lat*100+0.5)/100; lng = Math.floor(lng*100+0.5)/100; }
    return {category_code:value.category_code,location_precision:precision,latitude:lat,longitude:lng};
  }
  function bounds(south,west,north,east) {
    return {south:Math.max(-90,south),north:Math.min(90,north),west:east-west>=360?-180:longitude(west),east:east-west>=360?180:longitude(east)};
  }
  function inside(d,b) { return d.location_precision !== 'hidden' && d.latitude != null && d.longitude != null && d.latitude>=b.south && d.latitude<=b.north && (b.west<=b.east ? d.longitude>=b.west&&d.longitude<=b.east : d.longitude>=b.west||d.longitude<=b.east); }
  function clusters(rows, project, size=64) {
    const groups = new Map();
    rows.forEach(d => {const p=project(d.latitude,d.longitude), key=Math.floor(p.x/size)+':'+Math.floor(p.y/size); if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(d);});
    return [...groups.values()];
  }
  // Original vector pixel glyphs, independent of platform emoji fonts.
  const glyphs={
    food:['..#.#.#.....','..#.#.#.....','............','.##########.','..########..','...######...','....####....','...######...'],
    cafe:['..#..#......','.#..#.......','............','.#########..','.#######.##.','.#######.##.','..######....','.#########..'],
    nature:['.....##.....','....####....','...######...','..########..','...######...','.##########.','.....##.....','.....##.....'],
    animal:['..##....##..','.####..####.','..##....##..','....####....','...######...','..########..','..###..###..','...#....#...'],
    music_event:['.....######.','.....##..##.','.....##..##.','.....##..##.','..#####..##.','.######.###.','.#####.####.','..###...##..'],
    life:['.....##.....','.....##.....','....####....','############','############','....####....','.....##.....','.....##.....'],
    strange:['...######...','..##....##..','........##..','......###...','.....##.....','............','.....##.....','.....##.....'],
    toilet:['.#####......','.#####......','.#####......','.##########.','..########..','...######...','....####....','...######...'],
    shower:['....######..','...##....##.','...##.......','.######.....','............','.#.#.#......','..#.#.#.....','.#.#.#......'],
    other:['....####....','...######...','..########..','..########..','...######...','....####....','.....##.....','.....##.....']
  };
  function markerSvg(code){if(root.GerarAICategoryIcons)return root.GerarAICategoryIcons.render(category(code).code);const cells=(glyphs[code]||glyphs.other).flatMap((row,y)=>[...row].map((c,x)=>c==='#'?`<rect x="${x+2}" y="${y+4}" width="1" height="1"/>`:'')).join('');return `<svg viewBox="0 0 16 16" width="30" height="30" aria-hidden="true" fill="currentColor" shape-rendering="crispEdges">${cells}</svg>`;}
  const api = {categories,category,normalize,bounds,inside,clusters,longitude,markerSvg};
  root.GerarAIDiscovery = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
