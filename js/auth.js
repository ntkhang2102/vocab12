/* =========================================================
   Đăng nhập bằng mã + giải mã nội dung (dùng chung: app, duyet.html, quan-ly-ma.html)
   - Nội dung content/*.bin = IV(12 byte) + AES-256-GCM(khoá nội dung, JSON).
   - keyring.json: mỗi mã → PBKDF2-SHA256(mã chuẩn hoá, salt, 150000) = 40 byte
       [0..32) khoá bọc · [32..40) mã nhận diện (id, hex); wk = AES-GCM(khoá bọc, khoá nội dung).
   - Sau khi đăng nhập, khoá nội dung được lưu trên máy (localStorage) nên lần sau không phải nhập lại.
   ========================================================= */
'use strict';
const AUTH_STORE = 'v12-auth';
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64e = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s) };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const CODE_ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function genCode(prefix) {
  const r = crypto.getRandomValues(new Uint8Array(10));
  const s = [...r].map(x => CODE_ALPHA[x % CODE_ALPHA.length]).join('');
  return (prefix ? prefix + '-' : '') + s.slice(0, 5) + '-' + s.slice(5);
}

const Auth = {
  key: null, raw: null, ver: null, id: null,
  supported() { return !!(window.crypto && crypto.subtle) },
  async fetchKeyring() {
    const r = await fetch('content/keyring.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('keyring ' + r.status);
    return r.json();
  },
  async derive(code, kr) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normCode(code)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64d(kr.salt), iterations: kr.kdf.iter }, base, 320);
    const kek = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return { kek, id: hex(bits.slice(32, 40)) };
  },
  /* trả về khoá nội dung dạng thô (ArrayBuffer) hoặc null nếu mã sai */
  async unlock(code, kr) {
    const { kek, id } = await this.derive(code, kr);
    const e = kr.entries.find(x => x.id === id);
    if (!e) return null;
    try { const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(e.iv) }, kek, b64d(e.wk)); return { raw, id } } catch (err) { return null }
  },
  async use(rawB64, ver, id) {
    this.key = await crypto.subtle.importKey('raw', b64d(rawB64), 'AES-GCM', false, ['encrypt', 'decrypt']);
    this.raw = rawB64; this.ver = ver; this.id = id;
  },
  async login(code) {
    if (normCode(code).length < 6) return { ok: false, msg: 'Mã quá ngắn. Hãy kiểm tra lại.' };
    let kr; try { kr = await this.fetchKeyring() } catch (e) { return { ok: false, msg: 'Không kết nối được máy chủ. Lần đăng nhập đầu tiên cần có mạng.' } }
    const r = await this.unlock(code, kr);
    if (!r) return { ok: false, msg: 'Mã không đúng hoặc đã bị thu hồi.' };
    const rawB64 = b64e(r.raw);
    await this.use(rawB64, kr.keyVersion, r.id);
    try { localStorage.setItem(AUTH_STORE, JSON.stringify({ k: rawB64, ver: kr.keyVersion, id: r.id, at: Date.now() })) } catch (e) { }
    return { ok: true };
  },
  async restore() {
    let a = null; try { a = JSON.parse(localStorage.getItem(AUTH_STORE)) } catch (e) { }
    if (!a || !a.k) return false;
    try { await this.use(a.k, a.ver, a.id); return true } catch (e) { return false }
  },
  logout() { try { localStorage.removeItem(AUTH_STORE) } catch (e) { } this.key = this.raw = this.ver = this.id = null }
};

/* tải 1 file nội dung đã mã hoá và trả về JSON */
async function fetchEnc(path, key) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw Object.assign(new Error(path + ' ' + r.status), { kind: 'net' });
  const buf = await r.arrayBuffer();
  let pt;
  try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key || Auth.key, buf.slice(12)) }
  catch (e) { throw Object.assign(new Error('Không giải mã được nội dung'), { kind: 'key' }) }
  return JSON.parse(new TextDecoder().decode(pt));
}
/* mã hoá JSON → Uint8Array (IV + bản mã) để xuất file .bin */
async function encJSON(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key || Auth.key, new TextEncoder().encode(JSON.stringify(obj)));
  const out = new Uint8Array(12 + ct.byteLength); out.set(iv, 0); out.set(new Uint8Array(ct), 12); return out;
}
/* tạo một mục keyring cho mã mới */
async function wrapEntry(code, kr, rawBuf) {
  const { kek, id } = await Auth.derive(code, kr);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wk = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, rawBuf);
  return { id, iv: b64e(iv), wk: b64e(wk) };
}
function downloadBlob(name, data, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: type || 'application/octet-stream' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 2000);
}
