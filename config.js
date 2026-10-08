'use strict';
/* GERARAI — การตั้งค่า backend
 * backend: 'local'  → เก็บข้อมูลใน localStorage ของเบราว์เซอร์นี้ (ต้นแบบ, ค่าเริ่มต้น)
 * backend: 'supabase' → ระบบสมาชิกจริง (ระยะ 2) — ค่าเริ่มต้นตั้งแต่ v0.5
 * เปิดหน้าเว็บด้วย ?backend=local เพื่อใช้โหมดต้นแบบบนเครื่อง (ใช้ทดสอบ/สาธิตแบบออฟไลน์)
 *
 * ใส่ได้เฉพาะ URL และ anon (publishable) key ของ Supabase ซึ่งออกแบบมาให้อยู่ฝั่ง client ได้
 * Google Maps browser key ก็อยู่ฝั่ง client ได้เฉพาะเมื่อจำกัดโดเมนและ API ใน Google Cloud แล้ว
 * สำหรับ prototype ใช้ Maps Demo Key ได้โดยไม่เปิด Billing แต่มีโควตาและห้ามใช้เป็น production key
 * ห้ามใส่ service_role key, รหัสผ่าน หรือ secret ใด ๆ ในไฟล์นี้เด็ดขาด
 */
window.GERARAI_CONFIG = Object.freeze({
  // Open Beta: gerarai.com always runs the member backend behind the sign-in gate; the ?backend=local offline prototype
  // (sample data, no accounts) is available only on other hosts (development).
  backend: !/(^|\.)gerarai\.com$/i.test(location.hostname) && new URLSearchParams(location.search).get('backend') === 'local' ? 'local' : 'supabase',
  /*
   * Map layers stay separate. Discovery is GERARAI-owned data; Google Places
   * is an optional reference layer and must never be bulk-copied into the
   * discoveries table. Keep the key restricted by origin/API in Google Cloud
   * before enabling it in a deployed build.
   */
  map: {
    /* Production Open Beta (owner decision 2026-10-08): Google Maps/Places OFF. Leaflet/OpenStreetMap is the map.
     * Re-enable later only with a Production-only browser key restricted to https://gerarai.com/* and
     * https://www.gerarai.com/*, only the required Maps APIs, billing/quota controls and a Production Map ID. */
    provider: 'leaflet',
    google: {
      enabled: false,
      apiKey: '',
      mapId: ''
    }
  },
  supabase: {
    url: 'https://fqjceezraqpotjkzgjwo.supabase.co',
    anonKey: 'sb_publishable_7wAGMpR59dBpXor9ADgomA_w8JHE_1m' // publishable key — ใส่ในหน้าเว็บได้ สิทธิ์ถูกจำกัดด้วย RLS
  },
  media: { maxInputBytes: 15 * 1024 * 1024, maxUploadBytes: 2 * 1024 * 1024, maxDimension: 1600, jpegQuality: 0.82, allowedTypes: ['image/png', 'image/jpeg', 'image/webp'] }
});
