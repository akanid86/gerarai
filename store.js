'use strict';
/* GERARAI — ชั้นข้อมูล (data layer)
 * app.js คุยกับข้อมูลผ่าน window.GerarAIStore เท่านั้น เพื่อให้สลับไปใช้ Supabase ได้ในระยะ 2
 * โดยไม่ต้องแก้หน้าจอทั้งหมด
 *
 * สัญญา (contract) ของ adapter ทุกตัว:
 *   kind                 — 'local' | 'supabase'
 *   isShared             — true เมื่อข้อมูลผู้ใช้คนอื่นเห็นได้ (local = false)
 *   load()      -> state  — โหลดสถานะผู้ใช้ปัจจุบัน
 *   save(state) -> bool   — บันทึก คืน false ถ้าบันทึกไม่ได้
 *   reset()               — ล้างข้อมูลผู้ใช้บนเครื่อง
 *   prepareImage(file) -> Promise<{dataUrl,width,height,mime,bytes}> — ตรวจชนิด/ขนาดและย่อภาพ
 *
 * โครงสร้าง state ตรงกับตารางใน supabase/schema.sql:
 *   posts ↔ posts(+media), liked ↔ likes, saved ↔ saved_posts, savedPlaces ↔ saved_places,
 *   comments ↔ comments, following ↔ follows, profile ↔ profiles,
 *   blocked ↔ blocks, reported ↔ reports
 */
(function () {
  const CFG = window.GERARAI_CONFIG;
  const STORAGE = 'gerarai-phase3-v1';

  function freshState() {
    return {
      liked: [], saved: [], savedPlaces: [], posts: [], comments: {}, following: [],
      blocked: [],   // ↔ blocks (ชื่อผู้เขียนในโหมด local, user id ในโหมด supabase)
      reported: [],  // ↔ reports {id, reason, note, at}
      profile: { name: 'Baitoey', bio: 'Let’s collect good moments around the world 🌍\nถ่ายรูป กินของอร่อย และพบเจอผู้คนใหม่ ๆ' }
    };
  }

  const localAdapter = {
    kind: 'local',
    isShared: false,
    load() {
      const state = freshState();
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE) || 'null');
        if (stored && Array.isArray(stored.posts)) {
          return { ...state, ...stored, profile: { ...state.profile, ...stored.profile } };
        }
      } catch { /* storage blocked or corrupt → start fresh */ }
      return state;
    },
    save(state) {
      try { localStorage.setItem(STORAGE, JSON.stringify(state)); return true; } catch { return false; }
    },
    reset() { try { localStorage.removeItem(STORAGE); } catch { /* ignore */ } },
    prepareImage: file => prepareImage(file)
  };

  /* ตรวจชนิด รับต้นฉบับไม่เกิน maxInputBytes แล้วย่อให้ด้านยาวไม่เกิน maxDimension และผลลัพธ์ไม่เกิน maxUploadBytes (ใช้ทั้งโหมด local และก่อนอัปโหลดจริง) */
  function prepareImage(file) {
    const m = CFG.media;
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('ไม่มีไฟล์'));
      if (!m.allowedTypes.includes(file.type)) return reject(new Error('type'));
      if (file.size > m.maxInputBytes) return reject(new Error('size'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, m.maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.round(img.naturalWidth * scale), height = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); // PNG โปร่งใส → พื้นขาวเมื่อแปลงเป็น JPEG
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/jpeg', m.jpegQuality);
        const bytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
        if (bytes > m.maxUploadBytes) return reject(new Error('size'));
        resolve({ dataUrl, width, height, mime: 'image/jpeg', bytes });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  /* โหมด supabase ยังใช้ localAdapter เก็บค่าบนเครื่อง (รายการที่ซ่อนจากการรายงาน, เรื่องราวก่อนเข้าสู่ระบบ)
     ส่วนข้อมูลสมาชิกทั้งหมดอยู่ใน remote.js */
  function pickAdapter() { return localAdapter; }

  window.GerarAIStore = Object.freeze({ ...pickAdapter(), freshState });
})();
