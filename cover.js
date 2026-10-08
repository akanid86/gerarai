'use strict';
/* GERARAI — Profile Cover Upload v0.1 (v0.6.5-dev)
 * Client side only: validate → decode (bounded) → crop/position preview → export 1500×500 JPEG.
 * Storage: bucket 'profile-covers' at <user_id>/<uuid>.jpg · DB: profiles.cover_path (see migration 20260930120000).
 * Canvas re-encoding drops EXIF/GPS and all other metadata from the original file.
 */
(function () {
  const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_INPUT = 15 * 1024 * 1024;       // original file
  const MAX_SIDE = 12000;                   // px, either side
  const MAX_PIXELS = 40e6;                  // 40 MP decoded ≈ 160 MB RGBA — beyond this we refuse before decoding
  const MIN_W = 600, MIN_H = 200;           // smaller cannot fill a 3:1 cover sensibly
  const SHARP_W = 1200;                     // below this: warn "may not be sharp"
  const WORK_MAX_W = 3000;                  // decoded image is downscaled once to this working size
  const OUT_W = 1500, OUT_H = 500;          // saved cover (3:1)
  const QUALITIES = [0.82, 0.72, 0.62];
  const MAX_OUTPUT = 1024 * 1024;           // = bucket file_size_limit
  const MOBILE_RATIO = 1.8;                 // phones show roughly the central 1.8:1 area
  const ZOOM_MAX = 3;

  const err = (code, msg = code) => Object.assign(new Error(msg), { code });

  /* ---------- header sniffing: real format + pixel size before any decode ---------- */
  function sniffBytes(b) {
    const u16be = i => (b[i] << 8) | b[i + 1];
    const u32be = i => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
    const u24le = i => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
    if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      return { type: 'image/png', width: u32be(16), height: u32be(20) };
    }
    if (b.length > 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
      const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
      if (chunk === 'VP8X') return { type: 'image/webp', width: u24le(24) + 1, height: u24le(27) + 1 };
      if (chunk === 'VP8L') { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { type: 'image/webp', width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
      if (chunk === 'VP8 ') return { type: 'image/webp', width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
      return null;
    }
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xff) { i++; continue; }
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        const len = u16be(i + 2);
        if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
          return { type: 'image/jpeg', width: u16be(i + 7), height: u16be(i + 5) };
        }
        if (m === 0xda || len < 2) break;
        i += 2 + len;
      }
      return { type: 'image/jpeg', width: 0, height: 0 };   // SOF not found in the scanned prefix
    }
    return null;
  }

  async function validate(file) {
    if (!file) throw err('cover_none');
    if (!TYPES.includes(file.type)) throw err('cover_type');
    if (file.size > MAX_INPUT) throw err('cover_size');
    const head = new Uint8Array(await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer());
    const info = sniffBytes(head);
    if (!info) throw err('cover_type');                 // the bytes are not PNG/JPEG/WebP whatever the name says
    if (!info.width || !info.height) throw err('cover_decode');
    if (info.width > MAX_SIDE || info.height > MAX_SIDE || info.width * info.height > MAX_PIXELS) throw err('cover_pixels');
    if (info.width < MIN_W || info.height < MIN_H) throw err('cover_small');
    return info;
  }

  /* Decode once, downscale to a working canvas (≤ 3000 px wide) and release the full-size bitmap. */
  async function load(file) {
    const info = await validate(file);
    let source, release = () => {};
    try {
      if (window.createImageBitmap) { source = await createImageBitmap(file); release = () => source.close?.(); }
      else {
        const url = URL.createObjectURL(file);
        source = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; });
        release = () => URL.revokeObjectURL(url);
      }
    } catch { throw err('cover_decode'); }
    const w = source.width, h = source.height;
    if (!w || !h || w * h > MAX_PIXELS) { release(); throw err(w * h > MAX_PIXELS ? 'cover_pixels' : 'cover_decode'); }
    const k = Math.min(1, WORK_MAX_W / w);
    const work = document.createElement('canvas');
    work.width = Math.max(1, Math.round(w * k)); work.height = Math.max(1, Math.round(h * k));
    const ctx = work.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, work.width, work.height);
    release();
    return { canvas: work, width: work.width, height: work.height, original: { width: w, height: h, type: info.type }, lowRes: w < SHARP_W };
  }

  /* ---------- crop state: zoom (1..3) + centre in working-canvas pixels ---------- */
  function view(img, st, frameW, frameH) {
    const base = Math.max(frameW / img.width, frameH / img.height);
    const scale = base * st.zoom;
    const sw = frameW / scale, sh = frameH / scale;
    const cx = Math.min(Math.max(st.cx, sw / 2), img.width - sw / 2);
    const cy = Math.min(Math.max(st.cy, sh / 2), img.height - sh / 2);
    st.cx = cx; st.cy = cy;
    return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh, scale };
  }

  function createCropper(canvas, img, onChange = () => {}) {
    const st = { zoom: 1, cx: img.width / 2, cy: img.height / 2 };
    const ctx = canvas.getContext('2d');
    const draw = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(300, Math.round((r.width || 600) * dpr)), H = Math.round(W / 3);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const v = view(img, st, W, H);
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img.canvas, v.sx, v.sy, v.sw, v.sh, 0, 0, W, H);
      onChange(st);
    };
    const moveBy = (dxCss, dyCss) => {   // drag distance on screen → source pixels
      const r = canvas.getBoundingClientRect();
      const v = view(img, st, r.width || 600, (r.width || 600) / 3);
      st.cx -= dxCss / v.scale; st.cy -= dyCss / v.scale; draw();
    };
    const setZoom = z => { st.zoom = Math.min(ZOOM_MAX, Math.max(1, Number(z) || 1)); draw(); };
    let drag = null;
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); canvas.classList.add('dragging'); e.preventDefault(); });
    canvas.addEventListener('pointermove', e => { if (!drag) return; moveBy(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; });
    const end = () => { drag = null; canvas.classList.remove('dragging'); };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', e => { e.preventDefault(); setZoom(st.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const step = (canvas.getBoundingClientRect().width || 600) * 0.04;
      const k = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (k) { e.preventDefault(); moveBy(k[0], k[1]); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(st.zoom + 0.1); }
      else if (e.key === '-') { e.preventDefault(); setZoom(st.zoom - 0.1); }
    });
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    draw();
    return {
      state: st, draw, setZoom, moveBy,
      reset() { st.zoom = 1; st.cx = img.width / 2; st.cy = img.height / 2; draw(); },
      destroy() { window.removeEventListener('resize', onResize); },
      exportBlob: () => exportCover(img, st)
    };
  }

  /* Exactly the previewed area, 1500×500 JPEG, stepping quality down until ≤ 1 MB. */
  async function exportCover(img, st) {
    const out = document.createElement('canvas');
    out.width = OUT_W; out.height = OUT_H;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.imageSmoothingQuality = 'high';
    const v = view(img, { ...st }, OUT_W, OUT_H);
    ctx.drawImage(img.canvas, v.sx, v.sy, v.sw, v.sh, 0, 0, OUT_W, OUT_H);
    for (const q of QUALITIES) {
      const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', q));
      if (!blob) throw err('cover_decode');
      if (blob.size <= MAX_OUTPUT) return { blob, width: OUT_W, height: OUT_H, bytes: blob.size, mime: 'image/jpeg', quality: q };
    }
    throw err('cover_output');
  }

  function errorText(e) {
    switch (e?.code) {
      case 'cover_type': return 'ใช้ได้เฉพาะภาพ JPG, PNG หรือ WebP';
      case 'cover_size': return 'ไฟล์ใหญ่เกินไป (ไม่เกิน 15 MB)';
      case 'cover_pixels': return `ภาพมีขนาดพิกเซลใหญ่ผิดปกติ (ไม่เกิน ${MAX_SIDE.toLocaleString('th-TH')} px ต่อด้าน และ 40 ล้านพิกเซล) ลองย่อภาพก่อน`;
      case 'cover_small': return `ภาพเล็กเกินไปสำหรับหน้าปก (อย่างน้อย ${MIN_W}×${MIN_H} px)`;
      case 'cover_decode': return 'เปิดไฟล์ภาพนี้ไม่ได้ ลองเลือกภาพอื่น';
      case 'cover_output': return 'บีบอัดภาพให้ไม่เกิน 1 MB ไม่ได้ ลองเลือกภาพอื่น';
      default: return null;
    }
  }

  window.GerarAICover = Object.freeze({
    TYPES, MAX_INPUT, MAX_SIDE, MAX_PIXELS, MIN_W, MIN_H, OUT_W, OUT_H, MAX_OUTPUT, MOBILE_RATIO,
    sniffBytes, validate, load, createCropper, exportCover, errorText
  });
})();
