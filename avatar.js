'use strict';
/* GERARAI — Avatar provider layer · Character Identity v0.1
 *
 * รองรับ Photo Avatar + Pixel Character + initial fallback
 *   - ไฟล์เก็บใน Storage bucket 'avatars' ที่ <user_id>/<uuid>.jpg
 *   - ฐานข้อมูลเก็บแค่ profiles.avatar_path
 *
 * Photo ยังคงเก็บใน Storage bucket 'avatars'; Pixel Character เก็บเป็น structured JSON ใน profiles.pixel_avatar_data
 * ส่วนอื่นของแอปเรียก GerarAIAvatar.inner(subject) โดยไม่ต้องรู้วิธี render ภายใน
 *
 * subject = { name, photoUrl, avatarType, pixelSpec }
 */
(function () {
  const OUT_SIZE = 512;          // ด้านละ 512 px (สี่เหลี่ยมจัตุรัส)
  const OUT_QUALITY = 0.85;
  const MAX_INPUT = 15 * 1024 * 1024;
  const MAX_OUTPUT = 1024 * 1024; // ตรงกับ file_size_limit ของ bucket
  const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const Character = window.GerarAICharacter;

  /* ลำดับการเลือกวิธีแสดงผล: ตัวแรกที่ match จะถูกใช้ */
  const PROVIDERS = [
    { id: 'pixel', match: s => s.avatarType === 'pixel' && !!Character, html: s => Character.sprite(s.pixelSpec, `ตัวละครของ ${String(s.name || 'สมาชิก GERARAI')}`) },
    { id: 'photo', match: s => s.avatarType !== 'pixel' && !!s.photoUrl, html: s => `<img src="${esc(s.photoUrl)}" alt="" loading="lazy" decoding="async">` },
    { id: 'initial', match: () => true, html: s => esc(String(s.name || '?').trim().charAt(0) || '?') }
  ];

  function inner(subject) {
    const s = subject || {};
    return PROVIDERS.find(p => p.match(s)).html(s);
  }
  function kind(subject) { return PROVIDERS.find(p => p.match(subject || {})).id; }

  /* ครอปกึ่งกลางเป็นจัตุรัส ย่อเป็น 512×512 แล้วแปลงเป็น JPEG (ลบ EXIF/GPS ไปด้วย) */
  function prepare(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(Object.assign(new Error('ไม่มีไฟล์'), { code: 'avatar_none' }));
      if (!TYPES.includes(file.type)) return reject(Object.assign(new Error('type'), { code: 'avatar_type' }));
      if (file.size > MAX_INPUT) return reject(Object.assign(new Error('size'), { code: 'avatar_size' }));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
        const size = Math.min(OUT_SIZE, side);
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (!blob) return reject(Object.assign(new Error('encode'), { code: 'avatar_decode' }));
          if (blob.size > MAX_OUTPUT) return reject(Object.assign(new Error('size'), { code: 'avatar_size' }));
          resolve({ blob, width: size, height: size, bytes: blob.size, mime: 'image/jpeg', previewUrl: URL.createObjectURL(blob) });
        }, 'image/jpeg', OUT_QUALITY);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(Object.assign(new Error('decode'), { code: 'avatar_decode' })); };
      img.src = url;
    });
  }

  function errorText(e) {
    switch (e?.code) {
      case 'avatar_type': return 'ใช้ได้เฉพาะภาพ PNG, JPG หรือ WebP';
      case 'avatar_size': return 'ภาพใหญ่เกินไป (ไม่เกิน 15 MB)';
      case 'avatar_decode': return 'เปิดไฟล์ภาพนี้ไม่ได้ ลองเลือกภาพอื่น';
      default: return null;
    }
  }

  window.GerarAIAvatar = Object.freeze({ inner, kind, prepare, errorText, PROVIDER_IDS: PROVIDERS.map(p => p.id) });
})();
