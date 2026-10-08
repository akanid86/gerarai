'use strict';
/* GERARAI — การเชื่อมต่อ Supabase (ระยะ 2)
 * ทำงานเมื่อ config.js ตั้ง backend: 'supabase' และมี url + anonKey เท่านั้น
 * app.js เรียกผ่าน window.GerarAIRemote — ไฟล์นี้ไม่แตะ DOM
 *
 * ข้อมูลที่โหลดเก็บใน Remote.data:
 *   posts        — โพสต์ที่เผยแพร่ (RLS กรองโพสต์ของคนที่บล็อกกันออกให้แล้ว)
 *   liked/saved  — id โพสต์ที่ผู้ใช้ถูกใจ/บันทึก
 *   savedPlaces  — slug สถานที่ที่บันทึก
 *   following    — user id ที่ติดตาม
 *   blocked      — [{id, name}] ผู้ใช้ที่บล็อก
 */
(function () {
  const CFG = window.GERARAI_CONFIG;
  const BUCKET = 'post-media';
  const AVATAR_BUCKET = 'avatars';
  const COVER_BUCKET = 'profile-covers';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const POST_SELECT = 'id,title,body,tags,status,created_at,updated_at,author_id,' +
    'author:profiles!posts_author_id_fkey(display_name,handle,avatar_path,avatar_type,pixel_avatar_data),' +
    // M2 Place Disclosure: no place embed — public presentation comes from story_checkins() only
    'post_media(position,media(path,width,height)),' +
    'likes(count),comments(count)';

  const blank = () => ({ posts: [], liked: [], saved: [], savedPlaces: [], following: [], blocked: [] });
  const R = {
    enabled: CFG.backend === 'supabase',   // โหมดสมาชิกเปิดตาม backend เสมอ — ถ้าตั้งค่าผิดจะแจ้ง error ไม่ถอยไปโหมดต้นแบบ
    status: 'starting',                     // starting | ready | error
    configProblem: null,
    ready: false,
    user: null,
    profile: null,
    data: blank(),
    placeIds: {},
    classProgress: [],
    classCatalog: [],
    progression: { available: false, state: null, badges: [], catalog: [], summary: null },
    onChange: () => {},
    isId: id => UUID.test(String(id))
  };
  let sb = null;

  function check(res) { if (res.error) throw res.error; return res.data; }
  const uid = () => R.user?.id;
  function needUser() { if (!uid()) throw Object.assign(new Error('ต้องเข้าสู่ระบบก่อน'), { code: 'auth' }); return uid(); }
  const isDuplicate = e => e && (e.code === '23505' || /duplicate/i.test(e.message || ''));

  /* ---------- time ---------- */
  function relTime(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'เมื่อสักครู่';
    if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
    if (s < 86400) return `${Math.floor(s / 3600)} ชม. ที่แล้ว`;
    if (s < 172800) return 'เมื่อวาน';
    if (s < 604800) return `${Math.floor(s / 86400)} วันที่แล้ว`;
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  R.relTime = relTime;

  function publicUrl(path) { return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; }
  function avatarUrl(path) { return path ? sb.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : ''; }
  R.avatarUrl = avatarUrl;

  function mapPost(r) {
    const media = (r.post_media || []).slice().sort((a, b) => a.position - b.position)[0]?.media;
    const name = r.author?.display_name || 'Explorer';
    const liked = R.data.liked.includes(r.id);
    const city = '';                       // filled by the public-safe story_checkins() projection
    return {
      id: r.id, remote: true,
      authorId: r.author_id, author: name, handle: r.author?.handle || '', avatar: name[0], authorAvatar: avatarUrl(r.author?.avatar_path),
      authorAvatarType: r.author?.avatar_type || (r.author?.avatar_path ? 'photo' : 'initial'), authorPixelAvatar: r.author?.pixel_avatar_data || null,
      city, location: '',
      time: relTime(r.created_at), createdAt: r.created_at,
      edited: new Date(r.updated_at) - new Date(r.created_at) > 2000,
      place: '', placeName: '', placeDisclosure: 'private', ownPlace: null,
      image: media ? publicUrl(media.path) : '',
      title: r.title, body: r.body, tags: r.tags || [],
      likes: (r.likes?.[0]?.count || 0) - (liked ? 1 : 0),   // app.js บวกของผู้ใช้เองตอนแสดงผล
      comments: r.comments?.[0]?.count || 0,
      own: r.author_id === uid(), following: false
    };
  }

  /* ---------- lifecycle ---------- */
  function validateConfig() {
    const url = String(CFG.supabase?.url || ''), key = String(CFG.supabase?.anonKey || '');
    if (!url || !key) return 'ยังไม่ได้ใส่ Supabase URL หรือ publishable key ใน config.js';
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) return 'Supabase URL ใน config.js ไม่ถูกรูปแบบ (ต้องเป็น https://xxxx.supabase.co)';
    if (/^sb_secret_/i.test(key) || /service_role/i.test(key)) return 'config.js มี secret/service_role key — ห้ามใช้ในหน้าเว็บ ให้เปลี่ยนเป็น publishable key';
    if (!/^sb_publishable_/.test(key) && !/^eyJ/.test(key)) return 'publishable key ใน config.js ไม่ถูกรูปแบบ';
    return null;
  }
  R.configProblem = R.enabled ? validateConfig() : null;

  R.init = async function () {
    if (!R.enabled) return;
    try { await initInner(); R.status = 'ready'; }
    catch (err) { R.status = 'error'; throw err; }
  };
  async function initInner() {
    if (R.configProblem) throw Object.assign(new Error(R.configProblem), { code: 'config' });
    if (!window.supabase?.createClient) throw Object.assign(new Error('โหลดไลบรารี Supabase ไม่สำเร็จ'), { code: 'lib' });
    sb = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey, {
      auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
    });
    const { data: { session } } = await sb.auth.getSession();
    R.user = session?.user || null;
    sb.auth.onAuthStateChange((event, s) => {
      const prev = R.user?.id;
      R.user = s?.user || null;
      if (prev === R.user?.id) return;
      R.epoch = (R.epoch || 0) + 1;
      window.dispatchEvent(new Event('gerarai:identity-changing'));
      // ห้าม await คำสั่ง Supabase ใน callback นี้โดยตรง (อาจค้าง) — เลื่อนไปทำรอบถัดไป
      setTimeout(() => R.reload().then(() => R.onChange(event)).catch(e => R.onChange('error', e)), 0);
    });
    await R.reload();
    R.ready = true;
  }

  R.reload = async function () {
    const places = check(await sb.from('places').select('id,slug,name,city,country,category,lat,lng,address,hours,description,source,is_sample').eq('status', 'published'));
    R.placeIds = Object.fromEntries(places.map(p => [p.slug, p.id]));
    // P3: member mode never offers or shows sample/mock places — only real published GERARAI places
    R.places = places.filter(p => !p.is_sample).map(p => ({ id: p.slug, placeId: p.id, name: p.name, city: p.city, country: p.country || 'TH',
      category: p.category, coords: [p.lat, p.lng], address: p.address || '', hours: p.hours || '', description: p.description || '',
      source: p.source, is_sample: false, image: '' }));
    const slugOf = Object.fromEntries(places.map(p => [p.id, p.slug]));
    const d = blank();
    const me = uid();
    if (me) {
      const [profile, likes, saved, savedPlaces, follows, blocks] = await Promise.all([
        sb.from('profiles').select('*').eq('id', me).maybeSingle().then(check),
        sb.from('likes').select('post_id').eq('user_id', me).then(check),
        sb.from('saved_posts').select('post_id').eq('user_id', me).then(check),
        sb.from('saved_places').select('place_id').eq('user_id', me).then(check),
        sb.from('follows').select('followee_id').eq('follower_id', me).then(check),
        sb.from('blocks').select('blocked_id,who:profiles!blocks_blocked_id_fkey(display_name,avatar_path,avatar_type,pixel_avatar_data)').eq('blocker_id', me).then(check)
      ]);
      R.profile = profile;
      d.liked = likes.map(x => x.post_id);
      d.saved = saved.map(x => x.post_id);
      d.savedPlaces = savedPlaces.map(x => slugOf[x.place_id]).filter(Boolean);
      d.following = follows.map(x => x.followee_id);
      d.blocked = blocks.map(x => ({ id: x.blocked_id, name: x.who?.display_name || 'ผู้ใช้', avatarUrl: avatarUrl(x.who?.avatar_path), avatarType: x.who?.avatar_type || (x.who?.avatar_path ? 'photo' : 'initial'), pixelSpec: x.who?.pixel_avatar_data || null }));
      try {
        const catalog = await sb.from('life_classes').select('code,name_th,name_en,icon,description_th,sort_order').eq('active', true).order('sort_order', { ascending: true });
        if (!catalog.error) R.classCatalog = catalog.data || [];
      } catch { R.classCatalog = []; }
      await R.refreshProgression().catch(() => {});
    } else {
      R.profile = null; R.classProgress = []; R.classCatalog = []; R.progression = blankProgression();
    }
    R.data = d;
    await R.loadOnboarding().catch(err => { R.onboarding = { available: null, status: null, error: err }; console.warn('[GERARAI] onboarding status:', err?.code, err?.message); });
    await R.refreshPosts();
  };

  /* ---------- progression (read-only; computed by the server from Discovery evidence) ---------- */
  function blankProgression() { return { available: false, state: null, badges: [], catalog: [], summary: null }; }
  const PROGRESS_COLS = 'total_xp,level,title_key,primary_class_code,rule_version,updated_at';
  // Returns what changed since the last load ({xp, levelUp, newBadges}) so the UI can celebrate it.
  R.refreshProgression = async function () {
    const me = uid();
    if (!me) { R.progression = blankProgression(); R.classProgress = []; return null; }
    const before = R.progression.available ? { xp: Number(R.progression.state?.total_xp || 0), level: Number(R.progression.state?.level || 1), badges: new Set(R.progression.badges.map(b => b.badge_code)) } : null;
    const [cls, st, bd, cat] = await Promise.all([
      sb.from('user_class_progress').select('class_code,level,xp,unlocked_at').eq('user_id', me).order('unlocked_at', { ascending: true }),
      sb.from('user_progression').select(PROGRESS_COLS).eq('user_id', me).maybeSingle(),
      sb.from('user_badges').select('badge_code,awarded_at').eq('user_id', me),
      sb.from('badge_catalog').select('code,name_th,name_en,description_th,description_en,pixel_asset_key,rarity,sort_order,available').order('sort_order', { ascending: true })
    ]);
    if (uid() !== me) return null;
    R.classProgress = cls.error ? [] : (cls.data || []);
    if (st.error || bd.error || cat.error) { R.progression = blankProgression(); return null; }   // progression migration not run yet
    R.progression = { available: true, state: st.data || null, badges: bd.data || [], catalog: cat.data || [], summary: null };
    if (!before) return null;
    const after = R.progression.state;
    return {
      xp: Number(after?.total_xp || 0) - before.xp,
      levelUp: Number(after?.level || 1) > before.level ? Number(after.level) : 0,
      newBadges: R.progression.badges.map(b => b.badge_code).filter(c => !before.badges.has(c))
    };
  };
  R.loadProgressionSummary = async function () {
    needUser();
    if (!R.progression.available) return null;
    R.progression.summary = check(await sb.rpc('my_progression_summary'));
    return R.progression.summary;
  };
  R.setPrimaryClass = async function (code) {
    needUser();
    check(await sb.rpc('set_primary_class', { p_code: code }));
    await R.refreshProgression();
    return R.progression.state?.primary_class_code;
  };
  // Public, read-only snapshot for someone else's profile card (level, title, primary class, badges).
  R.publicProgression = async function (userId) {
    if (!R.isId(userId)) return null;
    const [st, bd] = await Promise.all([
      sb.from('user_progression').select('total_xp,level,title_key,primary_class_code').eq('user_id', userId).maybeSingle(),
      sb.from('user_badges').select('badge_code').eq('user_id', userId)
    ]);
    if (st.error || bd.error || !st.data) return null;
    return { state: st.data, badges: (bd.data || []).map(b => b.badge_code) };
  };

  R.refreshPosts = async function () {
    const rows = check(await sb.from('posts').select(POST_SELECT).eq('status', 'published')
      .order('created_at', { ascending: false }).limit(60));
    R.data.posts = rows.map(mapPost);
    await R.attachDiscoveries(R.data.posts);
  };

  /* M2 Place Disclosure (PD-2): what each Story may show about its place, as decided by the server (story_places).
   * Others get a row only when something is disclosed (area = city/country, venue = the place itself); the author also
   * gets their own link. Missing RPC (older database) → nothing is shown (fail closed). */
  R.placeDisclosureAvailable = null;
  const COUNTRY = { TH: 'Thailand' };
  R.countryName = code => COUNTRY[code] || code || '';
  R.attachPlaces = async function (posts) {
    const ids = [...new Set(posts.map(p => p.id).filter(R.isId))];
    const rows = [];
    for (let i = 0; i < ids.length; i += 100) {
      const res = await sb.rpc('story_places', { p_post_ids: ids.slice(i, i + 100) });
      if (res.error) { R.placeDisclosureAvailable = false; if (!R._placeWarned) { R._placeWarned = true; console.warn('[GERARAI] story_places unavailable — places are not shown', res.error.message || res.error.code); } return; }
      rows.push(...(res.data || []));
    }
    R.placeDisclosureAvailable = true;
    const by = new Map(rows.map(r => [r.post_id, r]));
    posts.forEach(p => {
      const r = by.get(p.id);
      const shown = r && (r.disclosure === 'area' || r.disclosure === 'venue');
      p.placeDisclosure = r?.disclosure || 'private';
      p.city = shown ? (r.area_city || '') : '';
      p.location = p.city ? `${p.city}, ${R.countryName(r.area_country)}` : 'GERARAI';
      p.place = r?.disclosure === 'venue' ? (r.place_slug || '') : '';
      p.placeName = r?.disclosure === 'venue' ? (r.place_name || '') : '';
      p.ownPlace = r?.own ? { id: r.own_place_id, slug: r.own_place_slug, name: r.own_place_name, city: r.own_place_city, status: r.own_place_status,
        disclosure: r.own_disclosure || 'private', precision: r.own_precision || 'none', venueConfirmed: !!r.own_venue_confirmed } : null;
    });
  };
  R.setPlaceDisclosure = async function (postId, level, confirmVenue) {
    needUser();
    return check(await sb.rpc('set_story_place_disclosure', { p_post_id: postId, p_disclosure: level, p_confirm_venue: !!confirmVenue }));
  };
  // Stories that disclose this place as a venue (+ the author's own); returns mapped posts.
  R.placeStories = async function (placeSlug) {
    const placeId = R.placeIds[placeSlug]; if (!placeId) return [];
    const ids = check(await sb.rpc('place_stories', { p_place_id: placeId, p_limit: 50 })).map(r => r.post_id);
    if (!ids.length) return [];
    const rows = check(await sb.from('posts').select(POST_SELECT).in('id', ids));
    const posts = rows.map(mapPost);
    await R.attachDiscoveries(posts);
    posts.forEach(p => { const i = R.data.posts.findIndex(x => x.id === p.id); if (i < 0) R.data.posts.push(p); else R.data.posts[i] = p; });
    return posts;
  };
  // G10: the id to write for the place chosen in a form — a catalogue place, or the Story's current link kept as is
  function placeIdFor(placeSlug, keep) {
    if (!placeSlug) return null;
    if (keep && keep.slug === placeSlug && keep.id) return keep.id;
    return R.placeIds[placeSlug] || null;
  }

  R.discoveryAvailable = false;
  R.attachDiscoveries = async function (posts) {
    const epoch=R.epoch||0, C=window.GerarAICheckinRead;
    posts.forEach(p=>C.apply(p,null));
    const rows=[];
    try {
      for(let i=0;i<posts.length;i+=100)rows.push(...check(await sb.rpc('story_checkins',{p_post_ids:posts.slice(i,i+100).map(p=>p.id)})));
      if(epoch!==(R.epoch||0))throw new DOMException('Identity changed','AbortError');
      const by=new Map(rows.map(r=>[r.post_id,r]));posts.forEach(p=>C.apply(p,by.get(p.id)));
      R.discoveryAvailable=true;R.placeDisclosureAvailable=true;
    } catch(error) {R.discoveryAvailable=false;R.placeDisclosureAvailable=false;throw error;}
  };
  R.searchAreas = async function (term='') {
    const rows=check(await sb.from('areas').select('id,display_name').eq('status','published').ilike('display_name','%'+term.slice(0,100)+'%').order('display_name').limit(12));
    return rows;
  };
  R.exploreStories = async function ({areaId=null,query='',cursor=null,exclude=[]}={}) {
    const epoch=R.epoch||0;
    const result=check(await sb.rpc('explore_stories',{p_area_id:areaId,p_query:query,p_before:cursor?.created_at||null,p_before_id:cursor?.id||null,p_limit:20,p_exclude:exclude.filter(R.isId).slice(0,1000)}));
    const ids=result.rows.map(x=>x.id);
    const rows=ids.length?check(await sb.from('posts').select(POST_SELECT).in('id',ids).eq('status','published')):[];
    const by=new Map(rows.map(r=>[r.id,mapPost(r)])),posts=ids.map(id=>by.get(id)).filter(Boolean);
    await R.attachDiscoveries(posts);
    if(epoch!==(R.epoch||0))throw new DOMException('Identity changed','AbortError');
    posts.forEach(p=>{const i=R.data.posts.findIndex(x=>x.id===p.id);if(i<0)R.data.posts.push(p);else R.data.posts[i]=p;});
    return {posts,total:result.total,next:result.next};
  };
  R.fetchPost = async function (id) {
    const epoch = R.epoch || 0;
    const row = check(await sb.from('posts').select(POST_SELECT).eq('id', id).eq('status','published').maybeSingle());
    if (!row) return null;
    const post = mapPost(row);
    await R.attachDiscoveries([post]);
    if (epoch !== (R.epoch || 0)) return null;
    const i=R.data.posts.findIndex(p=>p.id===id);
    if(i<0)R.data.posts.push(post);else R.data.posts[i]=post;
    return post;
  };
  R.discoveriesInViewport = async function (bounds, category, after, exclude, signal) {
    const epoch=R.epoch || 0;
    const rows=check(await sb.rpc('discoveries_in_viewport', {
      p_south:bounds.south,p_west:bounds.west,p_north:bounds.north,p_east:bounds.east,
      p_category:category==='all'?null:category,p_after:after || null,p_limit:200,
      p_exclude:exclude.filter(R.isId)
    }).abortSignal(signal));
    if(!rows.length)return {rows:[],next:null};
    const posts=check(await sb.from('posts').select(POST_SELECT).in('id',rows.map(d=>d.post_id)).eq('status','published').abortSignal(signal));
    if(epoch!==(R.epoch || 0))throw new DOMException('Identity changed','AbortError');
    const mapped=posts.map(mapPost);await R.attachDiscoveries(mapped);
    if(epoch!==(R.epoch||0))throw new DOMException('Identity changed','AbortError');
    const byId=new Map(mapped.map(p=>[p.id,p]));
    return {rows:rows.filter(d=>byId.get(d.post_id)?.discovery?.id===d.id).map(d=>({...byId.get(d.post_id).discovery,post:byId.get(d.post_id)})),next:rows.length===200?rows[rows.length-1].id:null};
  };

  /* ---------- auth ---------- */
  R.sendLink = async function (email) {
    const redirect = location.origin + location.pathname;
    check(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } }));
  };
  R.verifyCode = async function (email, token) {
    check(await sb.auth.verifyOtp({ email, token, type: 'email' }));
  };
  R.signOut = async function () { check(await sb.auth.signOut()); };

  /* ---------- profile ---------- */
  R.updateProfile = async function ({ display_name, bio, handle }) {
    const me = needUser();
    const row = check(await sb.from('profiles').update({ display_name, bio, handle: handle || null })
      .eq('id', me).select('*').single());
    R.profile = row;
    R.data.posts.forEach(p => { if (p.own) { p.author = row.display_name; p.avatar = row.display_name[0]; p.handle = row.handle || ''; } });
    return row;
  };
  /* ---------- photo avatar ---------- */
  function applyOwnAvatar() {
    const url = avatarUrl(R.profile?.avatar_path);
    R.data.posts.forEach(p => { if (p.own) { p.authorAvatar = url; p.authorAvatarType = R.profile?.avatar_type || (url ? 'photo' : 'initial'); p.authorPixelAvatar = R.profile?.pixel_avatar_data || null; } });
  }
  R.uploadAvatar = async function (prepared) {
    const me = needUser();
    const old = R.profile?.avatar_path || null;
    const path = `${me}/${crypto.randomUUID()}.jpg`;
    check(await sb.storage.from(AVATAR_BUCKET).upload(path, prepared.blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
    try {
      R.profile = check(await sb.from('profiles').update({ avatar_path: path, avatar_type: 'photo' }).eq('id', me).select('*').single());
    } catch (err) { await sb.storage.from(AVATAR_BUCKET).remove([path]); throw err; }
    if (old) { const { error } = await sb.storage.from(AVATAR_BUCKET).remove([old]); if (error) console.warn('[GERARAI] ลบรูปโปรไฟล์เดิมไม่สำเร็จ', error); }
    applyOwnAvatar();
    return avatarUrl(path);
  };
  R.removeAvatar = async function () {
    const me = needUser();
    const old = R.profile?.avatar_path || null;
    if (!old) return;
    const nextType = R.profile?.pixel_avatar_data ? 'pixel' : 'initial';
    R.profile = check(await sb.from('profiles').update({ avatar_path: null, avatar_type: nextType }).eq('id', me).select('*').single());
    const { error } = await sb.storage.from(AVATAR_BUCKET).remove([old]);
    if (error) console.warn('[GERARAI] ลบไฟล์รูปโปรไฟล์ไม่สำเร็จ', error);
    applyOwnAvatar();
  };


  /* ---------- profile cover (v0.6.5) — bucket 'profile-covers', profiles.cover_path ---------- */
  R.coverUrl = path => path ? sb.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl : '';
  // Older databases (migration 20260930120000 not run) have no cover_path column.
  R.coverAvailable = () => !!R.profile && Object.prototype.hasOwnProperty.call(R.profile, 'cover_path');
  const coverMigration = e => (/cover_path|bucket not found|profile-covers/i.test(String(e?.message || '')) || e?.code === 'PGRST204')
    ? Object.assign(new Error('ฐานข้อมูลยังไม่มีระบบภาพหน้าปก — รัน migration 20260930120000_profile_covers.sql ก่อน'), { code: 'cover_migration', cause: e }) : e;
  R.uploadCover = async function (prepared) {
    const me = needUser();
    if (!R.coverAvailable()) throw coverMigration({ code: 'PGRST204' });
    const old = R.profile?.cover_path || null;
    const path = `${me}/${crypto.randomUUID()}.jpg`;
    // cacheControl 1 h: a removed cover must not stay on the CDN for long (uuid file names, so no stale images)
    try { check(await sb.storage.from(COVER_BUCKET).upload(path, prepared.blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })); }
    catch (err) { throw coverMigration(err); }
    try {
      R.profile = check(await sb.from('profiles').update({ cover_path: path }).eq('id', me).select('*').single());
    } catch (err) { await sb.storage.from(COVER_BUCKET).remove([path]); throw coverMigration(err); }
    if (old && old !== path) { const { error } = await sb.storage.from(COVER_BUCKET).remove([old]); if (error) console.warn('[GERARAI] ลบภาพหน้าปกเดิมไม่สำเร็จ', error); }
    return R.coverUrl(path);
  };
  R.removeCover = async function () {
    const me = needUser();
    const old = R.profile?.cover_path || null;
    if (!old) return;
    try { R.profile = check(await sb.from('profiles').update({ cover_path: null }).eq('id', me).select('*').single()); }
    catch (err) { throw coverMigration(err); }
    const { error } = await sb.storage.from(COVER_BUCKET).remove([old]);
    if (error) console.warn('[GERARAI] ลบไฟล์ภาพหน้าปกไม่สำเร็จ', error);
  };

  R.setPixelAvatar = async function (spec) {
    const me = needUser();
    const Character = window.GerarAICharacter;
    const clean = Character ? Character.normalizeSpec(spec) : spec;
    R.profile = check(await sb.from('profiles').update({ avatar_type: 'pixel', pixel_avatar_data: clean }).eq('id', me).select('*').single());
    applyOwnAvatar();
    return R.profile;
  };
  R.usePhotoAvatar = async function () {
    const me = needUser();
    if (!R.profile?.avatar_path) throw Object.assign(new Error('ยังไม่มีรูปโปรไฟล์'), { code: 'avatar_none' });
    R.profile = check(await sb.from('profiles').update({ avatar_type: 'photo' }).eq('id', me).select('*').single());
    applyOwnAvatar();
    return R.profile;
  };
  R.useInitialAvatar = async function () {
    const me = needUser();
    R.profile = check(await sb.from('profiles').update({ avatar_type: 'initial' }).eq('id', me).select('*').single());
    applyOwnAvatar();
    return R.profile;
  };

  /* ---------- public profile (v0.6.6) — read-only view of another member ---------- */
  // Only public columns: never select('*') here, so private/auth fields added later cannot leak into the view.
  const PUBLIC_PROFILE_COLS = 'id,handle,display_name,bio,avatar_path,avatar_type,pixel_avatar_data,created_at';
  // Share cards need identity only: never fetch posts, locations, bio, email or private owner fields.
  R.profileCard = async function (userId) {
    if (!R.isId(userId)) return null;
    const row = check(await sb.from('profiles').select('id,handle,display_name,avatar_path,avatar_type,pixel_avatar_data').eq('id', userId).maybeSingle());
    if (!row) return null;
    const progression = await R.publicProgression(userId).catch(() => null);
    return { profile: row, progression };
  };
  R.publicProfile = async function (userId) {
    if (!R.isId(userId)) return null;
    let res = await sb.from('profiles').select(PUBLIC_PROFILE_COLS + ',cover_path').eq('id', userId).maybeSingle();
    if (res.error) res = await sb.from('profiles').select(PUBLIC_PROFILE_COLS).eq('id', userId).maybeSingle();   // DB without cover migration
    const row = check(res);
    if (!row) return null;
    const [prog, posts, stats] = await Promise.all([
      R.publicProgression(userId).catch(() => null),
      R.userPosts(userId),
      R.statsFor(userId).catch(() => null)
    ]);
    return { profile: row, progression: prog, posts, stats };
  };
  // Published Stories of one member; RLS already removes Stories hidden by a block in either direction.
  R.userPosts = async function (userId) {
    const rows = check(await sb.from('posts').select(POST_SELECT).eq('author_id', userId).eq('status', 'published')
      .order('created_at', { ascending: false }).limit(60));
    const posts = rows.map(mapPost);
    await R.attachDiscoveries(posts);
    return posts;
  };
  R.statsFor = async function (userId) {
    const count = q => q.then(r => { if (r.error) throw r.error; return r.count || 0; });
    const [followers, following, posts] = await Promise.all([
      count(sb.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId)),
      count(sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)),
      count(sb.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', userId).eq('status', 'published'))
    ]);
    return { followers, following, posts };
  };
  // Profile report through the existing reports table (exactly one target: profile_id).
  R.reportProfile = async function (profileId, reason, note) {
    const me = needUser();
    const { error } = await sb.from('reports').insert({ reporter_id: me, profile_id: profileId, reason, note: note || '' });
    if (error && !isDuplicate(error)) throw error;
  };

  R.stats = async function () {
    const me = needUser();
    const count = q => q.then(r => { if (r.error) throw r.error; return r.count || 0; });
    const [followers, following, posts] = await Promise.all([
      count(sb.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', me)),
      count(sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', me)),
      count(sb.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', me).eq('status', 'published'))
    ]);
    return { followers, following, posts };
  };

  /* ---------- likes / saves / follows ---------- */
  const TOGGLES = {
    liked: { table: 'likes', col: 'post_id', key: id => id },
    saved: { table: 'saved_posts', col: 'post_id', key: id => id },
    savedPlaces: { table: 'saved_places', col: 'place_id', key: slug => R.placeIds[slug] }
  };
  R.toggle = async function (kind, id, on) {
    const me = needUser(), t = TOGGLES[kind], key = t.key(id);
    if (!key) throw new Error('ไม่พบข้อมูลนี้ในฐานข้อมูล');
    if (on) {
      const { error } = await sb.from(t.table).insert({ [t.col]: key, user_id: me });
      if (error && !isDuplicate(error)) throw error;
    } else {
      check(await sb.from(t.table).delete().eq(t.col, key).eq('user_id', me));
    }
  };
  R.follow = async function (userId, on) {
    const me = needUser();
    if (on) {
      const { error } = await sb.from('follows').insert({ follower_id: me, followee_id: userId });
      if (error && !isDuplicate(error)) throw error;
    } else {
      check(await sb.from('follows').delete().eq('follower_id', me).eq('followee_id', userId));
    }
  };

  /* ---------- posts ---------- */
  async function dataUrlToBlob(dataUrl) { return (await fetch(dataUrl)).blob(); }

  // Slice 4: media staging is independent; Story associations commit only through the trusted RPC.
  R.stageStoryMedia = async function(image, ticket) {
    const me=needUser();
    ticket.id ||= crypto.randomUUID(); ticket.path ||= `${me}/${ticket.id}.jpg`;
    if(ticket.owner && ticket.owner!==me)throw new Error('identity_changed');ticket.owner=me;
    if(ticket.ready)return ticket.id;
    const blob=await dataUrlToBlob(image.dataUrl);
    const upload=await sb.storage.from(BUCKET).upload(ticket.path,blob,{contentType:'image/jpeg',upsert:false});
    if(upload.error && !/already exists|duplicate/i.test(upload.error.message||''))throw upload.error;
    const record=await sb.from('media').insert({id:ticket.id,owner_id:me,bucket:BUCKET,path:ticket.path,mime:'image/jpeg',width:image.width,height:image.height,bytes:blob.size});
    if(record.error && !isDuplicate(record.error))throw record.error;
    const saved=check(await sb.from('media').select('id,owner_id,path').eq('id',ticket.id).single());
    if(saved.owner_id!==me||saved.path!==ticket.path)throw new Error('invalid_media');
    ticket.ready=true;return ticket.id;
  };
  R.storyCheckinForEdit = async function(id) {
    needUser();const epoch=R.epoch||0;
    const state=check(await sb.rpc('story_checkin_for_edit',{p_post_id:id}));
    const row=check(await sb.from('posts').select('id,title,body,tags,post_media(media_id,position,media(path,width,height))').eq('id',id).single());
    if(epoch!==(R.epoch||0))throw new Error('identity_changed');
    return {...state,content:row,media:(row.post_media||[]).sort((a,b)=>a.position-b.position).map(m=>({id:m.media_id,url:publicUrl(m.media.path)}))};
  };
  R.mutateStoryCheckin = async function(request) {
    needUser();const epoch=R.epoch||0;
    const result=check(await sb.rpc('mutate_story_checkin',request));
    if(epoch!==(R.epoch||0))throw new Error('identity_changed');
    return result;
  };
  R.searchCheckinVenues = async function(term='') {
    return check(await sb.from('places').select('id,name,city,source').eq('status','published').eq('is_sample',false).ilike('name','%'+term.slice(0,100)+'%').order('name').limit(12));
  };
  // Obsolete callers cannot restore multi-step writes or infer source from an old place/coordinate.
  R.createPost = R.updatePost = async function(){throw new Error('use_checkin_composer');};

  R.deletePost = async function (id) {
    needUser();
    const links = check(await sb.from('post_media').select('media(id,path)').eq('post_id', id));
    check(await sb.from('posts').delete().eq('id', id));
    const media = links.map(l => l.media).filter(Boolean);
    if (media.length) {
      await sb.from('media').delete().in('id', media.map(m => m.id));
      const rm = await sb.storage.from(BUCKET).remove(media.map(m => m.path));
      if (rm.error || (rm.data && rm.data.length < media.length)) console.warn('[GERARAI] ลบไฟล์ภาพของเรื่องราวไม่ครบ', rm.error || rm.data);
    }
    R.data.posts = R.data.posts.filter(p => p.id !== id);
    ['liked', 'saved'].forEach(k => { R.data[k] = R.data[k].filter(x => x !== id); });
  };

  /* ---------- comments ---------- */
  R.comments = async function (postId) {
    const rows = check(await sb.from('comments')
      .select('id,body,created_at,author_id,who:profiles!comments_author_id_fkey(display_name,avatar_path,avatar_type,pixel_avatar_data)')
      .eq('post_id', postId).order('created_at', { ascending: true }).limit(200));
    return rows.map(c => ({ id: c.id, body: c.body, time: relTime(c.created_at), author: c.who?.display_name || 'Explorer', avatarUrl: avatarUrl(c.who?.avatar_path), avatarType: c.who?.avatar_type || (c.who?.avatar_path ? 'photo' : 'initial'), pixelSpec: c.who?.pixel_avatar_data || null, own: c.author_id === uid() }));
  };
  R.addComment = async function (postId, body) {
    const me = needUser();
    check(await sb.from('comments').insert({ post_id: postId, author_id: me, body }));
    const p = R.data.posts.find(x => x.id === postId);
    if (p) p.comments += 1;
  };
  R.deleteComment = async function (postId, commentId) {
    needUser();
    check(await sb.from('comments').delete().eq('id', commentId));
    const p = R.data.posts.find(x => x.id === postId);
    if (p) p.comments = Math.max(0, p.comments - 1);
  };

  /* ---------- trust & safety ---------- */
  R.report = async function (postId, reason, note) {
    const me = needUser();
    const { error } = await sb.from('reports').insert({ reporter_id: me, post_id: postId, reason, note: note || '' });
    if (error && !isDuplicate(error)) throw error;
  };
  R.block = async function (userId, name) {
    const me = needUser();
    const { error } = await sb.from('blocks').insert({ blocker_id: me, blocked_id: userId });
    if (error && !isDuplicate(error)) throw error;
    if (!R.data.blocked.some(b => b.id === userId)) R.data.blocked.push({ id: userId, name });
    R.data.following = R.data.following.filter(x => x !== userId);
    await sb.from('follows').delete().eq('follower_id', me).eq('followee_id', userId);
    await R.refreshPosts();
  };
  R.unblock = async function (userId) {
    const me = needUser();
    check(await sb.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId));
    R.data.blocked = R.data.blocked.filter(b => b.id !== userId);
    await R.refreshPosts();
  };

  /* ---------- Emergency Discovery v0.1 (v0.7.0-dev) ---------- */
  // Everything is written through RPCs; the browser never sends source_type/official fields.
  R.emergency = { available: null, rules: null, settings: null, serverOffsetMs: 0 };
  const EMERGENCY_MISSING = e => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(e?.code) || /emergency_(rules|reports|settings)|create_emergency_report|emergency_in_viewport/i.test(String(e?.message || ''));
  R.loadEmergencyConfig = async function (force = false) {
    if (R.emergency.available !== null && !force) return R.emergency;
    const [rules, settings] = await Promise.all([
      sb.from('emergency_rules').select('type_code,icon,label_th,label_en,ttl_minutes,aging_minutes,allowed_precisions,sort_order,active').eq('active', true).order('sort_order', { ascending: true }),
      sb.from('emergency_settings').select('key,value')
    ]);
    if (rules.error || settings.error) {
      if (EMERGENCY_MISSING(rules.error || settings.error)) { R.emergency.available = false; return R.emergency; }
      throw rules.error || settings.error;
    }
    R.emergency.available = true;
    R.emergency.rules = rules.data;
    R.emergency.settings = Object.fromEntries((settings.data || []).map(r => [r.key, r.value]));
    return R.emergency;
  };
  R.emergencyNow = () => Date.now() + (R.emergency.serverOffsetMs || 0);
  R.createEmergency = async function ({ title, body, image, report }) {
    const me = needUser();
    let path = null, mediaId = null;
    try {
      if (image) {
        path = `${me}/${crypto.randomUUID()}.jpg`;
        const blob = await dataUrlToBlob(image.dataUrl);
        check(await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
        mediaId = check(await sb.from('media').insert({ owner_id: me, bucket: BUCKET, path, mime: 'image/jpeg', width: image.width, height: image.height, bytes: blob.size }).select('id').single()).id;
      }
      const clean = {};   // whitelist: nothing about source/official is ever sent
      ['type_code', 'latitude', 'longitude', 'location_precision', 'reported_at', 'water_depth', 'vehicle_access', 'need_code', 'people_count', 'severity', 'note']
        .forEach(k => { if (report[k] !== undefined && report[k] !== null && report[k] !== '') clean[k] = report[k]; });
      const postId = check(await sb.rpc('create_emergency_report', { p_title: title, p_body: body, p_media_id: mediaId, p_report: clean }));
      return await R.fetchPost(postId);
    } catch (err) {
      if (mediaId) await sb.from('media').delete().eq('id', mediaId);
      if (path) await sb.storage.from(BUCKET).remove([path]);
      throw err;
    }
  };
  R.updateEmergency = async function (reportId, update) {
    needUser();
    const clean = {};
    ['emergency_status', 'water_depth', 'vehicle_access', 'need_code', 'people_count', 'severity', 'note', 'reported_at']
      .forEach(k => { if (update[k] !== undefined) clean[k] = update[k] === null ? '' : update[k]; });
    check(await sb.rpc('update_emergency_report', { p_report_id: reportId, p_update: clean }));
  };
  R.emergencyHistory = async function (reportId) {
    return check(await sb.from('emergency_updates').select('id,action,emergency_status,water_depth,vehicle_access,need_code,people_count,note,reported_at,created_at')
      .eq('report_id', reportId).order('id', { ascending: true }).limit(50));
  };
  R.emergencyInViewport = async function (bounds, { types = null, includeHistory = false, after = null } = {}, signal) {
    const epoch = R.epoch || 0;
    const sent = Date.now();
    const req = sb.rpc('emergency_in_viewport', {
      p_south: bounds.south, p_west: bounds.west, p_north: bounds.north, p_east: bounds.east,
      p_types: types && types.length ? types : null, p_include_history: !!includeHistory, p_after: after, p_limit: 200
    });
    const rows = check(await (signal ? req.abortSignal(signal) : req));
    if (rows.length && rows[0].server_now) R.emergency.serverOffsetMs = Date.parse(rows[0].server_now) - Math.round((sent + Date.now()) / 2);
    if (!rows.length) return { rows: [], next: null };
    const posts = check(await sb.from('posts').select(POST_SELECT).in('id', rows.map(r => r.post_id)).eq('status', 'published'));
    if (epoch !== (R.epoch || 0)) throw new DOMException('Identity changed', 'AbortError');
    const byId = new Map(posts.map(p => [p.id, mapPost(p)]));
    return { rows: rows.filter(r => byId.has(r.post_id)).map(r => ({ ...r, post: byId.get(r.post_id) })), next: rows.length === 200 ? rows[rows.length - 1].id : null };
  };
  // Feed/Profile cards: attach the emergency row to Stories tagged "emergency" (ignored on older databases).
  R.attachEmergencies = async function (posts) {
    const ids = posts.filter(p => (p.tags || []).includes('emergency')).map(p => p.id);
    if (!ids.length || R.emergency.available === false) return;
    const res = await sb.from('emergency_reports').select('*').in('post_id', ids);
    if (res.error) { if (EMERGENCY_MISSING(res.error)) R.emergency.available = false; return; }
    const byPost = new Map(res.data.map(e => [e.post_id, e]));
    posts.forEach(p => { if (byPost.has(p.id)) p.emergency = byPost.get(p.id); });
  };
  const baseAttachDiscoveries = R.attachDiscoveries;
  R.attachDiscoveries = async function (posts) { await baseAttachDiscoveries(posts); await R.attachEmergencies(posts).catch(() => {}); };

  /* ---------- Identity & Onboarding (M1 / S4) ---------- */
  // The server decides everything (versions, hashes, timestamps, user). The browser only sends what the member ticked and
  // the SHA-256 of the exact text it displayed; a stale text is refused with policy_version_changed.
  // Fallback: when M1 is not installed the RPC is missing → available=false and the app behaves exactly as before.
  R.onboarding = { available: null, status: null };
  const ONB_MISSING = e => ['PGRST202', 'PGRST205', '42883', '42P01'].includes(e?.code) || /onboarding_status|policy_documents/i.test(String(e?.message || ''));
  const docCache = new Map();
  R.loadOnboarding = async function () {
    const res = await sb.rpc('onboarding_status');
    if (res.error) {
      if (ONB_MISSING(res.error)) { R.onboarding = { available: false, status: null }; return R.onboarding; }
      throw res.error;
    }
    R.onboarding = { available: true, status: res.data || null };
    return R.onboarding;
  };
  R.onboardingDoc = async function (type, version) {
    const locale = R.onboarding.status?.locale || 'th-TH', key = `${type}|${version}|${locale}`;
    if (docCache.has(key)) return docCache.get(key);
    const doc = check(await sb.from('policy_documents').select('policy_type,version,locale,title,content,content_hash,summary_th,route,effective_at,material')
      .eq('policy_type', type).eq('version', version).eq('locale', locale).maybeSingle());
    if (!doc) throw Object.assign(new Error('policy_document_missing'), { code: 'P0001' });
    doc.shownHash = await R.sha256Hex(doc.content);   // hash of what this browser will display
    docCache.set(key, doc);
    return doc;
  };
  R.sha256Hex = async function (text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  };
  R.completeOnboarding = async function ({ ageConfirmed, accept, acknowledge, seen }) {
    needUser();
    const status = check(await sb.rpc('complete_onboarding', { p_age_confirmed: ageConfirmed === true, p_accept: accept, p_acknowledge: acknowledge, p_seen: seen }));
    R.onboarding = { available: true, status };
    return status;
  };
  R.acknowledgePolicy = async function (type, seenHash) {
    needUser();
    check(await sb.rpc('acknowledge_policy', { p_type: type, p_seen_hash: seenHash }));
    return R.loadOnboarding();
  };
  R.correctMyAge = async function () {
    needUser();
    check(await sb.rpc('correct_my_age_attestation'));
    return R.loadOnboarding();
  };
  R.forgetOnboardingDocs = () => docCache.clear();
  R.onboardingCode = function (e) {   // P0001 codes raised by M1 (gate triggers and RPCs)
    const m = String(e?.message || '');
    return ['age_confirmation_required', 'age_review_required', 'policy_required', 'policy_version_changed', 'onboarding_config_missing', 'invalid_policy_type', 'policy_document_missing'].find(c => m === c || m.startsWith(c)) || null;
  };

  /* ---------- error text ---------- */
  R.errorText = function (e) {
    const m = String(e?.message || e || '');
    switch (R.onboardingCode(e)) {
      case 'age_confirmation_required': return 'ยืนยันอายุก่อนเริ่มโพสต์หรือโต้ตอบ';
      case 'age_review_required': return 'บัญชีนี้อยู่ระหว่างตรวจสอบอายุ ยังโพสต์หรือโต้ตอบไม่ได้ชั่วคราว';
      case 'policy_required': return /emergency_notice/.test(String(e?.details || '')) ? 'อ่านข้อควรรู้ก่อนรายงานสถานการณ์' : 'ยอมรับข้อกำหนดฉบับล่าสุดก่อนโพสต์หรือโต้ตอบ';
      case 'policy_version_changed': return 'เอกสารเพิ่งมีการปรับปรุง โปรดอ่านและยืนยันอีกครั้ง';
      case 'onboarding_config_missing': return 'ระบบกำลังปรับปรุงเงื่อนไขการใช้งาน ยังโพสต์ไม่ได้ชั่วคราว';
      case 'policy_document_missing': return 'ยังโหลดเอกสารนี้ไม่ได้ ลองใหม่อีกครั้ง';
      case 'invalid_policy_type': return 'คำขอไม่ถูกต้อง ลองโหลดหน้าใหม่';
    }
    if (e?.code === 'auth') return 'ต้องเข้าสู่ระบบก่อน';
    if (e?.code === 'lib') return 'โหลดระบบสมาชิกไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ต';
    if (e?.code === 'config') return m;
    if (e?.code === 'cover_migration') return m;
    if (/Location precision .* not allowed/i.test(m)) return 'ความละเอียดตำแหน่งนี้ใช้กับรายงานประเภทนี้ไม่ได้';
    if (/reported_at is in the future/i.test(m)) return 'เวลาที่เห็นต้องไม่อยู่ในอนาคต';
    if (/reported_at is too old|already be expired/i.test(m)) return 'เวลาที่เห็นเก่าเกินไปสำหรับรายงานสถานการณ์ปัจจุบัน';
    if (/Not your editable emergency report/i.test(m)) return 'แก้ไขได้เฉพาะรายงานของคุณเอง';
    if (/create_emergency_report|emergency_rules|emergency_in_viewport/i.test(m)) return 'ฐานข้อมูลยังไม่มีระบบรายงานสถานการณ์ — รัน migration 20261001090000_emergency_reports.sql ก่อน';
    if (/bucket not found/i.test(m)) return 'ยังไม่ได้เปิดที่เก็บรูปโปรไฟล์ในฐานข้อมูล (ต้องรัน migration 002)';
    if (e?.code === '23514' && /avatar/i.test(m)) return 'ตำแหน่งไฟล์รูปโปรไฟล์ไม่ถูกต้อง';
    if (e?.code === '42703' || e?.code === 'PGRST204' || /avatar_type|pixel_avatar_data|user_class_progress|life_classes/i.test(m)) return 'ฐานข้อมูลยังไม่มี Character Identity / Life Class — รัน migration 20260929162000_character_identity_life_class.sql ก่อน';
    if (/set_primary_class|my_progression_summary|user_progression|badge_catalog/i.test(m) || e?.code === 'PGRST202') return 'ฐานข้อมูลยังไม่มีระบบเลเวล/เหรียญ — รัน migration 20260930090000_progression_foundation.sql ก่อน';
    if (/Life Class is not unlocked/i.test(m)) return 'ยังไม่ได้ปลดล็อกอาชีพนี้';
    if (e?.code === 'over_email_send_rate_limit' || /email rate limit/i.test(m)) return 'ระบบส่งอีเมลของ GERARAI ถึงขีดจำกัดต่อชั่วโมงแล้ว ยังไม่ได้ส่งอีเมล — ลองใหม่ภายหลัง หรือใช้รหัส/ลิงก์จากอีเมลที่ได้รับก่อนหน้า';
    { const sec = m.match(/after (\d+) seconds?/i); if (sec) return `ขอได้อีกครั้งในอีก ${sec[1]} วินาที`; }
    if (e?.code === 'over_request_rate_limit' || /rate limit|too many|security purposes/i.test(m)) return 'ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่';
    if (/expired|invalid.*(token|otp)|otp.*invalid/i.test(m)) return 'รหัสไม่ถูกต้องหรือหมดอายุ ขอรหัสใหม่อีกครั้ง';
    if (/email.*invalid|invalid.*email/i.test(m)) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่';
    if (e?.code === '23505') return 'ข้อมูลนี้ถูกใช้แล้ว';
    if (e?.code === '23514') return 'ข้อมูลไม่ตรงตามเงื่อนไข';
    if (e?.code === '42501' || /row-level security/i.test(m)) return 'ไม่มีสิทธิ์ทำรายการนี้';
    return 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
  };

  // Always uses the active Supabase session; profile id is a subject, never a viewer.
  R.journeySummary = async function (profileId, { exclude = [], signal } = {}) {
    if (!sb || !R.isId(profileId)) throw new Error('Journey unavailable');
    const epoch = R.epoch;
    const ids = [...new Set(exclude.filter(R.isId))];
    if (ids.length > 1000) throw new Error('Too many exclusions');
    const request = sb.rpc('journey_summary', { p_profile_id: profileId, p_exclude: ids });
    if (signal) request.abortSignal(signal);
    const data = check(await request);
    if (epoch !== R.epoch || signal?.aborted) throw new Error('Journey identity changed');
    if (!data || data.version !== 1 || data.scope !== 'public_footprint' || data.profile_user_id !== profileId ||
      !Number.isSafeInteger(data.discoveries) || data.discoveries < 0 ||
      !Number.isSafeInteger(data.places) || data.places < 0 || data.places > data.discoveries ||
      data.places_state !== 'partial' || data.countries !== null || data.cities !== null || data.geography_state !== 'unverified') {
      throw new Error('Invalid journey response');
    }
    return { discoveries: data.discoveries, places: data.places };
  };
  window.GerarAIRemote = R;
})();
