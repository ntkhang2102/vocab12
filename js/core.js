/* =========================================================
   Vocabulary 12 — lõi dùng chung
   (trạng thái, tải nội dung, âm thanh, micro, Hỏi AI, tiện ích)
   ========================================================= */
'use strict';
const APP_VERSION = '0.1.0';
const STORE_KEY = 'v12-state';
const INTERVALS = [0, 1, 3, 7, 14, 30];

/* ---------- tiện ích ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]] } return a };
const pick = (arr, n, ex) => shuffle(arr.filter(x => !ex.includes(x))).slice(0, n);
const norm = s => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pad2 = n => String(n).padStart(2, '0');
const fmtClock = s => pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);

/* Chữ trong sách: **đậm**, __gạch chân__, *nghiêng*. Luôn escape trước. */
function inl(s) {
  let h = esc(s).replace(/_{3,}/g, '\u0001'); // chỗ trống "______" không phải gạch chân
  h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  h = h.replace(/__(.+?)__/g, '<u>$1</u>');
  h = h.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>');
  return h.replace(/\u0001/g, '______');
}
const plain = s => String(s ?? '').replace(/\*\*|__/g, '').replace(/(^|[^*])\*([^*]+)\*/g, '$1$2');

/* ---------- trạng thái học (lưu trên máy) ---------- */
function freshState() {
  return { v: 2, created: Date.now(), dayOff: 0, words: {}, rate: {}, wrong: [], mine: [], tests: [],
    seen: { app: null, units: {} }, settings: { ai: 'claude' }, cur: null };
}
let S = (() => {
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.v === 2) return Object.assign(freshState(), s) } catch (e) { }
  return freshState();
})();
let saveFail = false;
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); saveFail = false }
  catch (e) { if (!saveFail) { saveFail = true; toast('Không lưu được tiến độ trên máy này (bộ nhớ đầy hoặc đang ở chế độ riêng tư).') } }
}
/* Ngày học: tính theo giờ địa phương; dayOff chỉ dùng trong chế độ giáo viên để giả lập. */
function today() { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5) + (S.dayOff || 0) }
function dayLabel(n) { const d = new Date((n - (S.dayOff || 0)) * 864e5); return pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) }

/* ---------- nội dung: danh mục + từng Unit ---------- */
let CATALOG = null, GLOSS = {};
const UNITS = {};
let U = null; // Unit đang học

async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}
async function loadCatalog() {
  try { CATALOG = await fetchJSON('content/catalog.json'); try { localStorage.setItem('v12-catalog', JSON.stringify(CATALOG)) } catch (e) { } }
  catch (e) { try { CATALOG = JSON.parse(localStorage.getItem('v12-catalog')) } catch (_) { } }
  if (!CATALOG) throw new Error('Không tải được danh mục nội dung. Kiểm tra kết nối mạng rồi mở lại app.');
  try { GLOSS = await fetchJSON('content/gloss.json') } catch (e) { GLOSS = {} }
}
function allUnits() { return CATALOG.parts.flatMap(p => p.units.map(u => Object.assign({ part: p.part, level: p.level }, u))) }
function unitMeta(id) { return allUnits().find(u => u.id === id) }
function availableUnits() { return allUnits().filter(u => u.ready) }
function unitLabel(id, short) { const m = unitMeta(id); if (!m) return id; return short ? `P${m.part}·U${m.unit}` : `Part ${m.part} · Unit ${m.unit}` }

async function loadUnit(id) {
  if (UNITS[id]) return UNITS[id];
  const raw = await fetchJSON('content/' + id + '.json');
  return (UNITS[id] = prepareUnit(raw));
}
function prepareUnit(d) {
  d.vocab.forEach(v => { v.id = d.id + ':' + (v.key || slug(v.word)); v.unit = d.id });
  d.byId = Object.fromEntries(d.vocab.map(v => [v.id, v]));
  d.WORDS = d.vocab.filter(v => v.type === 'word');
  d.PHR = d.vocab.filter(v => v.type === 'phrase');
  d.setById = Object.fromEntries((d.sets || []).map(s => [s.id, s]));
  return d;
}
function wordById(id) { const u = UNITS[id.split(':')[0]]; return u ? u.byId[id] : null }

/* ---------- lịch ôn và Sổ câu sai ---------- */
const learnedIds = (unit) => Object.keys(S.words).filter(id => !unit || id.startsWith(unit + ':'));
const dueIds = (unit) => learnedIds(unit).filter(id => S.words[id].due <= today());
const openWrong = (unit) => S.wrong.filter(w => !w.done && (!unit || w.unit === unit));

function grade(id, ok) {
  const w = S.words[id] || (S.words[id] = { box: 0, due: today(), reviews: 0 });
  w.reviews++; w.last = today();
  if (ok) { w.box = Math.min(w.box + 1, 5); w.due = today() + INTERVALS[w.box] }
  else { w.box = 1; w.due = today() + 1 }
  save();
}
function addWrong(e) {
  const ex = S.wrong.find(w => w.key === e.key && !w.done);
  if (ex) { ex.chosen = e.chosen; ex.day = today(); ex.streak = 0; ex.times = (ex.times || 1) + 1 }
  else S.wrong.push(Object.assign({ streak: 0, done: false, day: today(), times: 1 }, e));
  save();
}

/* ---------- giọng đọc của trình duyệt ---------- */
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() } catch (e) { } }
try { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices } catch (e) { }
function pickVoice(lang) {
  const vs = voices.filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase()));
  return vs.find(v => /natural|enhanced|premium|google|samantha|daniel|serena|karen|arthur/i.test(v.name)) || vs[0] || null;
}
function speak(text, lang = 'en-US', rate = 0.92, onend) {
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = rate;
    const v = pickVoice(lang); if (v) u.voice = v;
    if (onend) { u.onend = onend; u.onerror = onend }
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    return u;
  } catch (e) { toast('Thiết bị này chưa hỗ trợ đọc phát âm') }
}
const ICON_SPK = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>';
const spkBtn = (text, label, lang, rate) => `<button class="speak" type="button" data-say="${esc(text)}" data-lang="${lang || 'en-US'}" data-rate="${rate || 0.92}">${ICON_SPK}${label}</button>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) speak(b.dataset.say, b.dataset.lang, +b.dataset.rate) });

let tt; function toast(m, ms) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, ms || 2600) }

/* ---------- hiển thị dùng chung ---------- */
function highlight(ex, frag) {
  if (!frag) return esc(ex);
  const i = ex.toLowerCase().indexOf(frag.toLowerCase());
  if (i < 0) return esc(ex);
  return esc(ex.slice(0, i)) + '<mark>' + esc(ex.slice(i, i + frag.length)) + '</mark>' + esc(ex.slice(i + frag.length));
}
function explHTML(lines, ans) {
  return '<div class="expl">' + lines.map(l => {
    const m = l.match(/^([A-D])\.\s(.*)$/);
    if (m) { const right = 'ABCD'.indexOf(m[1]) === ans; return `<p class="${right ? 'right' : ''}"><b>${m[1]}.</b> ${inl(m[2])}</p>` }
    const k = l.match(/^([^:]{2,24}):\s(.*)$/);
    if (k) return `<p><b>${esc(k[1])}:</b> ${inl(k[2])}</p>`;
    return `<p>${inl(l)}</p>`;
  }).join('') + '</div>';
}
function mcHTML(opts, name) { return '<div class="opts">' + opts.map((o, i) => `<button type="button" class="opt" data-${name}="${i}"><span class="k">${'ABCD'[i]}</span><span>${inl(o)}</span></button>`).join('') + '</div>' }
function lockMC(root, attr, chosen, ans) {
  root.querySelectorAll(`[data-${attr}]`).forEach(b => { const i = +b.dataset[attr]; b.disabled = true; if (i === ans) b.classList.add('ok'); else if (i === chosen) b.classList.add('no') });
}

/* ---------- so khớp lời nói ---------- */
function lcsMarks(target, said) {
  const a = norm(target).split(' ').filter(Boolean), b = norm(said).split(' ').filter(Boolean);
  const dp = [...Array(a.length + 1)].map(() => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)for (let j = b.length - 1; j >= 0; j--)dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Set(); let i = 0, j = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { hit.add(i); i++; j++ } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++ }
  return { hit, total: a.length, score: a.length ? hit.size / a.length : 0 };
}
function diffHTML(target, hit) {
  let k = 0; return target.split(/\s+/).map(w => { const has = norm(w); if (!has) return esc(w); const cls = hit.has(k++) ? 'hit' : 'miss'; return `<span class="${cls}">${esc(w)}</span>` }).join(' ');
}

/* ---------- micro (Học từ, Đọc bài, Nói) ---------- */
const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
const MIC_SVG = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const MIC_HELP = 'Micro chưa dùng được trên trình duyệt này. Trên iPhone: mở app bằng Safari, vào Cài đặt > Safari > Micro và cho phép; bật Siri & Đọc chính tả nếu được hỏi.';
const Mic = {
  rec: null,
  start(target, opts, done) {
    if (this.rec) { try { this.rec.stop() } catch (e) { } return }
    if (!SRC) { done({ err: MIC_HELP }); return }
    try { speechSynthesis.cancel() } catch (e) { }
    const r = new SRC(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 5; r.continuous = !!(opts && opts.long);
    this.rec = r; let heard = []; let alts = []; let err = null;
    r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) { heard.push(e.results[i][0].transcript); if (!r.continuous) alts = [...e.results[i]].map(x => x.transcript) } } };
    r.onerror = e => { err = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Micro đang bị chặn. ' + MIC_HELP : e.error === 'no-speech' ? 'Chưa nghe thấy tiếng nói. Thử lại và nói gần micro hơn.' : 'Không nhận dạng được (' + e.error + '). Thử lại nhé.' };
    r.onend = () => {
      this.rec = null;
      if (err) { done({ err }); return }
      const cands = alts.length ? alts : [heard.join(' ')];
      let best = null; cands.forEach(h => { const m = lcsMarks(target, h); if (!best || m.score > best.m.score) best = { m, heard: h } });
      if (!best || !best.heard.trim()) { done({ err: 'Chưa nghe thấy tiếng nói. Thử lại nhé.' }); return }
      done(best);
    };
    try { r.start(); done({ listening: true }) } catch (e) { this.rec = null; done({ err: 'Không mở được micro trên trang này.' }) }
  },
  stop() { if (this.rec) { try { this.rec.abort() } catch (e) { } this.rec = null } },
  html(state, target) {
    if (!state) return '';
    if (state.listening) return `<div class="small muted">Đang nghe… <b>bấm micro lần nữa để dừng</b></div>`;
    if (state.err) return `<div class="notice">${esc(state.err)}</div>`;
    const pct = Math.round(state.m.score * 100), ok = pct >= 85, mid = pct >= 60;
    return `<div class="micres"><span class="verdict ${ok ? 'ok' : mid ? 'mid' : 'no'}">${ok ? 'Tốt' : 'Cần luyện thêm'} · khớp ${pct}%</span>
   <div class="small muted">App nghe được: “${esc(state.heard)}”</div><div class="diff">${diffHTML(target, state.m.hit)}</div></div>`;
  }
};

/* ---------- so khớp nghĩa tiếng Việt ---------- */
const noTone = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const vnorm = s => String(s).toLowerCase().normalize('NFC').replace(/\(.*?\)/g, ' ').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
function meaningScore(input, meaning) {
  const a = vnorm(input); if (!a) return 0;
  const parts = meaning.split(/[,;]/).map(vnorm).filter(Boolean);
  const test = (x, p) => {
    if (x === p || x.includes(p) || (p.includes(x) && x.split(' ').length >= 2)) return true;
    const xs = new Set(x.split(' ')), ps = p.split(' '); return ps.filter(w => xs.has(w)).length / ps.length >= 0.6
  };
  if (parts.some(p => test(a, p))) return 2;
  if (parts.some(p => test(noTone(a), noTone(p)))) return 1;
  return 0;
}

/* =========================================================
   HỎI AI — mặc định: chép câu hỏi + mở ứng dụng AI học sinh chọn (0đ).
   Chừa sẵn chỗ cho khóa API riêng / khóa chung của giáo viên (chưa bật).
   ========================================================= */
const AI_PROVIDERS = {
  claude: { name: 'Claude', url: q => 'https://claude.ai/new?q=' + encodeURIComponent(q) },
  chatgpt: { name: 'ChatGPT', url: q => 'https://chatgpt.com/?q=' + encodeURIComponent(q) },
  gemini: { name: 'Gemini', url: () => 'https://gemini.google.com/app' }
};
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true } catch (e) { }
  try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length); const ok = document.execCommand('copy'); ta.remove(); return ok } catch (e) { return false }
}
const AI = {
  mode() { return 'external' }, // sau này: 'apikey' (khóa riêng) hoặc 'teacher' (khóa chung của giáo viên)
  async ask(prompt) {
    const p = AI_PROVIDERS[S.settings.ai] || AI_PROVIDERS.claude;
    const url = p.url(prompt.length > 1800 ? '' : prompt);
    const cp = copyText(prompt);              // bắt đầu chép ngay trong thao tác chạm
    let w = null;
    try { w = window.open(url, '_blank'); if (w) w.opener = null } catch (e) { } // mở trong cùng thao tác chạm để iPhone không chặn
    const ok = await cp;
    if (!w) { showPrompt(prompt, url); return }
    toast(ok ? `Đã chép câu hỏi. Nếu ${p.name} chưa điền sẵn, chạm giữ ô chat → Dán.` : `Chưa chép được tự động. Quay lại app để chép câu hỏi.`, 4200);
    if (!ok) showPrompt(prompt, url);
  }
};
function showPrompt(prompt, url) {
  openModal(`<div class="modal-h"><h2>Câu hỏi cho AI</h2><button class="btn ghost sm" type="button" data-close>Đóng</button></div>
   <p class="small muted" style="margin:0">Chạm giữ để chọn toàn bộ, chép rồi dán vào ứng dụng AI.</p><textarea class="input" readonly style="min-height:200px">${esc(prompt)}</textarea>
   <div class="row"><button class="btn soft" type="button" id="cpAgain">Chép câu hỏi</button>${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Mở ${esc((AI_PROVIDERS[S.settings.ai] || AI_PROVIDERS.claude).name)}</a>` : ''}</div>`,
    m => { m.querySelector('#cpAgain').onclick = async () => toast(await copyText(prompt) ? 'Đã chép câu hỏi' : 'Hãy chạm giữ vào ô chữ để chép') });
}
const AI_SVG = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
let AIQ = [];
function aiBtn(prompt, label) { AIQ.push(prompt); return `<button class="speak" type="button" data-ai="${AIQ.length - 1}">${AI_SVG}${label || 'Hỏi AI'}</button>` }
document.addEventListener('click', e => { const b = e.target.closest('[data-ai]'); if (b) { const p = AIQ[+b.dataset.ai]; if (p) AI.ask(p) } });
function aiPromptQuestion(q, chosen, ctx) {
  const opts = q.opts.map((o, i) => `${'ABCD'[i]}. ${plain(o)}`).join('\n');
  return `Mình là học sinh lớp 12 đang luyện đề tiếng Anh (${U ? unitLabel(U.id) + ' – ' + U.title : ''}).` +
    (ctx ? `\n${ctx}` : '') +
    `\nCâu hỏi: ${plain(q.stem || q.ctx || '')}\n${opts}\nĐáp án đúng: ${'ABCD'[q.ans]}.` +
    (chosen != null && chosen !== q.ans ? ` Mình đã chọn ${'ABCD'[chosen]}.` : '') +
    `\nHãy giải thích ngắn gọn bằng tiếng Việt vì sao đáp án đúng, vì sao ${chosen != null && chosen !== q.ans ? 'lựa chọn của mình' : 'các phương án khác'} sai, và cho thêm 2 câu ví dụ tương tự để mình luyện.`;
}

/* ---------- hộp thoại dạng tấm trượt ---------- */
function openModal(html, bind) {
  const o = $('#overlay');
  o.innerHTML = `<div class="modal-bg" data-bg><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.style.overflow = 'hidden';
  o.querySelector('[data-bg]').addEventListener('click', e => { if (e.target.dataset.bg !== undefined || e.target.closest('[data-close]')) closeModal() });
  if (bind) bind(o.querySelector('.modal'));
}
function closeModal() { $('#overlay').innerHTML = ''; document.body.style.overflow = '' }
