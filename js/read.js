/* =========================================================
   3. ĐỌC BÀI — đọc toàn bài, quét dịch Từ/Cụm/Câu/Đoạn, nghe cả bài,
   song ngữ, đọc theo bằng micro. Bản dịch do Claude soạn được gắn nhãn.
   ========================================================= */
/* Các dạng gốc có thể của một từ (số nhiều, quá khứ, -ing, so sánh hơn…) — khớp với tools/ khi kiểm tra độ phủ từ điển */
function wordForms(w) {
  let lw = w.toLowerCase().replace(/[’]/g, "'");
  const out = [lw], add = x => { if (x && x.length >= 2 && !out.includes(x)) out.push(x) };
  lw = lw.replace(/'s$/, ''); add(lw);
  if (/s'$/.test(lw)) { lw = lw.slice(0, -1); add(lw) }
  [['ies', 'y'], ['ied', 'y'], ['ier', 'y'], ['iest', 'y'], ['ily', 'y']].forEach(([s, r]) => { if (lw.endsWith(s)) add(lw.slice(0, -s.length) + r) });
  ['es', 's', 'ed', 'd', 'ing', 'er', 'est', 'ly', 'r', 'st'].forEach(s => {
    if (lw.endsWith(s) && lw.length - s.length >= 2) {
      const b = lw.slice(0, -s.length); add(b);
      if (['ed', 'ing', 'er', 'est'].includes(s)) { add(b + 'e'); if (b.length >= 3 && b[b.length - 1] === b[b.length - 2]) add(b.slice(0, -1)) }
    }
  });
  return out;
}
let _G = null, _GU = null;
function glossOf(w) {
  if (!_G || _GU !== (U && U.id)) { _G = Object.assign({}, GLOSS); Object.entries(U.gloss || {}).forEach(([k, v]) => _G[k.toLowerCase()] = v); _GU = U && U.id }
  for (const f of wordForms(w)) if (_G[f]) return _G[f];
  return null;
}
function unitWordOf(w) {
  const lw = w.toLowerCase().replace(/'s$/, '');
  if (lw.length < 3) return null;
  return U.WORDS.find(v => { if (v.word.includes(' ')) return false; const st = v.word.slice(0, Math.max(4, v.word.length - 3)).toLowerCase(); return lw.startsWith(st) && lw.length <= v.word.length + 3 }) || null;
}
const cleanWord = s => s.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ'’-]+$/g, '');
const Reader = {
  t: 0, mode: 'word', sel: null, showVi: false, playing: null, mic: null, rate: 0.9, unit: null, lib: 'book', topicId: null,
  D() { return this.lib === 'topic' ? UNITS[this.topicId] : U },
  text() { return this.D().texts[this.t] },
  hasMT(T) { return T.paras.some(p => p.some(s => s.by !== 'gv')) },
  render(el) {
    const tps = availableTopics();
    if (this.lib === 'book' && this.unit !== U.id) { this.unit = U.id; this.t = 0; this.sel = null; this.mic = null }
    const libSeg = tps.length ? `<div class="seg"><button type="button" class="chip" data-lib="book" aria-pressed="${this.lib === 'book'}">Bài đọc trong sách</button><button type="button" class="chip" data-lib="topic" aria-pressed="${this.lib === 'topic'}">Tài liệu theo chủ đề</button></div>` : '';
    const bindLib = () => el.querySelectorAll('[data-lib]').forEach(b => b.onclick = () => { this.stop(); Mic.stop(); this.lib = b.dataset.lib; this.t = 0; this.sel = null; this.mic = null; this.render(el) });
    if (this.lib === 'topic') {
      if (!this.topicId || !tps.some(t => t.id === this.topicId)) this.topicId = tps[0] && tps[0].id;
      if (!this.topicId) this.lib = 'book';
      else if (!UNITS[this.topicId]) {
        el.innerHTML = `<section class="sec">${libSeg}<p class="muted">Đang tải tài liệu…</p></section>`; bindLib();
        loadUnit(this.topicId).then(() => { if (tab === 'read' && this.lib === 'topic') this.render(el) }).catch(() => { el.querySelector('p').textContent = 'Không tải được tài liệu. Kiểm tra mạng rồi thử lại.' });
        return;
      }
    }
    const D = this.D();
    if (!D.texts || !D.texts.length) { el.innerHTML = `<section class="sec">${libSeg}<div class="sec-h"><div><h2>Đọc toàn bài</h2></div></div><div class="panel muted">Chưa có bài đọc.</div></section>`; bindLib(); return }
    if (this.t >= D.texts.length) this.t = 0;
    const T = this.text();
    const modes = [['word', 'Từ'], ['chunk', 'Cụm'], ['sent', 'Câu'], ['para', 'Đoạn']];
    const paras = T.paras.map((p, pi) => {
      const sents = p.map((s, si) => {
        const chunks = (s.chunks && s.chunks.length ? s.chunks : [[s.en, s.vi || '']]).map((c, ci) => {
          const words = c[0].split(/(\s+)/).map((tok, k) => /\s+/.test(tok) ? tok : `<span class="w" data-w="${pi}.${si}.${ci}.${k}">${esc(tok)}</span>`).join('');
          return `<span class="ck" data-c="${pi}.${si}.${ci}">${words}</span>`
        }).join(' ');
        return `<span class="st" data-s="${pi}.${si}">${chunks}</span>`
      }).join(' ');
      const vi = this.showVi ? `<p class="pvi">${esc(p.map(s => s.vi || '…').join(' '))}</p>` : '';
      return `<div class="para" data-p="${pi}"><p><span class="pn">${pi + 1}</span>${sents}</p>${vi}</div>`
    }).join('');
    const mt = this.hasMT(T) ? `<div style="margin-bottom:10px"><span class="mt-tag" title="Bản dịch câu và cụm do Claude soạn, giáo viên sẽ duyệt lại">Bản dịch do Claude soạn · chờ GV duyệt</span></div>` : '';
    el.innerHTML = `<section class="sec reader">
   ${libSeg}
   <div class="sec-h"><div><h2>${this.lib === 'topic' ? esc(D.title) : 'Đọc toàn bài'}</h2><p>Chạm vào bài để xem nghĩa theo từ, cụm, câu hoặc cả đoạn. Nghe mẫu rồi bấm micro để đọc theo.</p></div></div>
   ${this.lib === 'topic' && tps.length > 1 ? `<div class="seg">${tps.map(t => `<button type="button" class="chip" data-tp="${t.id}" aria-pressed="${t.id === this.topicId}">${esc(t.title)}</button>`).join('')}</div>` : ''}
   <div class="seg">${D.texts.map((x, i) => `<button type="button" class="chip" data-t="${i}" aria-pressed="${i === this.t}">${esc(x.label)}</button>`).join('')}</div>
   <div class="panel" style="display:grid;gap:10px">
     <div class="row"><span class="label">Quét dịch theo</span><div class="tabs" role="tablist">${modes.map(([k, l]) => `<button type="button" role="tab" data-m="${k}" aria-selected="${this.mode === k}">${l}</button>`).join('')}</div></div>
     <div class="row"><button class="btn ${this.playing ? '' : 'soft'}" type="button" id="playAll">${this.playing ? '■ Dừng đọc' : '▶ Nghe cả bài'}</button>
       <label class="row small"><input type="checkbox" id="slow" ${this.rate < 0.8 ? 'checked' : ''}> Đọc chậm</label><span class="grow"></span>
       <label class="row small"><input type="checkbox" id="showVi" ${this.showVi ? 'checked' : ''}> Song ngữ</label></div>
   </div>
   <article class="doc mode-${this.mode}"><h3 class="doc-t">${esc(T.title)}</h3>${mt}${paras}<p class="src">${esc(T.src || '')}</p>
    ${T.set ? `<div class="row" style="margin-top:12px"><button class="btn ghost" type="button" id="toQs">Làm câu hỏi ${esc(T.label)} ›</button></div>` : ''}</article>
   ${this.mine()}
  </section>${this.sheet()}`;
    document.body.classList.toggle('sheet-open', !!this.sel);
    this.bind(el); this.mark(el); bindLib();
    el.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { this.stop(); this.topicId = b.dataset.tp; this.t = 0; this.sel = null; this.render(el) });
  },
  mine() {
    const L = (S.mine || []).filter(x => !x.unit || x.unit === this.D().id); if (!L.length) return '';
    return `<div class="panel" style="display:grid;gap:6px"><div class="label">Sổ từ của tôi (${L.length})</div>${L.slice().reverse().map(x => `<div class="small"><b>${esc(x.w)}</b> · ${esc(x.vi)} <span class="muted">— ${esc(x.ctx)}</span></div>`).join('')}</div>`
  },
  parts(key) { const [pi, si, ci, k] = key.split('.').map(Number); const T = this.text(); const s = T.paras[pi] && T.paras[pi][si]; const chunks = s ? (s.chunks && s.chunks.length ? s.chunks : [[s.en, s.vi || '']]) : []; return { pi, si, ci, k, p: T.paras[pi], s, c: chunks[ci] } },
  wordAt(P) { return cleanWord(P.c[0].split(/\s+/)[P.k / 2] || '') },
  sheet() {
    if (!this.sel) return '';
    const { kind, key } = this.sel, P = this.parts(key);
    const noVi = '<span class="muted">Câu này chưa có bản dịch.</span>';
    let en = '', body = '', head = '';
    if (kind === 'word') {
      const w = this.wordAt(P);
      const g = glossOf(w), u = this.lib === 'book' ? unitWordOf(w) : null; en = w;
      head = `<div class="row"><span class="sheet-w">${esc(w)}</span>${spkBtn(w, 'Nghe')} ${spkBtn(w, 'Chậm', 'en-US', 0.55)}</div>`;
      body = `${g ? `<div class="sheet-vi">${esc(g)} <span class="mt-tag">nghĩa tra nhanh · máy soạn</span></div>` : '<div class="small muted">Tên riêng hoặc từ chưa có trong từ điển bài đọc.</div>'}
      ${u ? `<div class="unitw"><span class="tag src2">Từ trong ${esc(unitLabel(U.id))}</span> <b>${esc(u.word)}</b> ${u.ipa ? `<span class="ipa">${esc(u.ipa)}</span>` : ''} · ${esc(u.meaning)}</div>` : ''}
      <div class="small"><span class="muted">Trong cụm:</span> ${esc(P.c[0])} → <i>${P.c[1] ? esc(P.c[1]) : '…'}</i></div>
      <div class="row">${u ? `<button class="btn soft" type="button" id="addRv">${S.words[u.id] && S.words[u.id].due <= today() ? 'Đã có trong ôn tập hôm nay' : 'Đưa vào ôn tập hôm nay'}</button>` : g ? `<button class="btn soft" type="button" id="addMine">Lưu vào Sổ từ</button>` : ''}</div>`;
    } else if (kind === 'chunk') {
      en = P.c[0]; head = `<div class="row"><span class="label">Cụm từ</span>${spkBtn(en, 'Nghe')} ${spkBtn(en, 'Chậm', 'en-US', 0.6)}</div>`;
      body = `<div class="sheet-en">${esc(en)}</div><div class="sheet-vi">${P.c[1] ? esc(P.c[1]) : noVi}</div>`;
    } else if (kind === 'sent') {
      en = P.s.en; head = `<div class="row"><span class="label">Câu ${P.si + 1} · đoạn ${P.pi + 1}</span>${spkBtn(en, 'Nghe')} ${spkBtn(en, 'Chậm', 'en-US', 0.65)}</div>`;
      body = `<div class="sheet-en">${esc(en)}</div><div class="sheet-vi">${P.s.vi ? esc(P.s.vi) : noVi}</div>
      ${P.s.chunks && P.s.chunks.length > 1 ? `<details class="chunks"><summary class="small">Xem nghĩa từng cụm</summary>${P.s.chunks.map(c => `<div class="small"><b>${esc(c[0])}</b> → ${esc(c[1])}</div>`).join('')}</details>` : ''}
      <div class="row">${aiBtn(`Mình là học sinh lớp 12. Hãy giải thích ngắn gọn bằng tiếng Việt cấu trúc ngữ pháp và các cụm từ quan trọng trong câu sau (trích bài "${T_title(this)}"), rồi dịch lại sát nghĩa:\n"${en}"`, 'Hỏi AI về câu này')}</div>`;
    } else {
      en = P.p.map(s => s.en).join(' '); head = `<div class="row"><span class="label">Đoạn ${P.pi + 1}</span>${spkBtn(en, 'Nghe cả đoạn')}</div>`;
      body = `<div class="sheet-vi">${esc(P.p.map(s => s.vi || '…').join(' '))}</div>`;
    }
    return `<aside class="sheet" aria-label="Nghĩa và luyện đọc"><div class="sheet-in">
    <div class="row">${head}<span class="grow"></span><button class="speak" type="button" id="closeSheet" aria-label="Đóng">✕</button></div>
    ${body}
    <div class="row"><button class="speak mic-sm ${this.mic && this.mic.listening ? 'rec' : ''}" type="button" id="rMic">${MIC_SVG}${kind === 'para' ? 'Đọc cả đoạn' : 'Đọc theo'}</button><span class="small muted">${kind === 'para' ? 'Đọc xong bấm micro lần nữa để chấm' : 'Nghe mẫu rồi đọc lại'}</span></div>${Mic.html(this.mic, en)}
  </div></aside>`;
  },
  mark(el) {
    el.querySelectorAll('.on').forEach(x => x.classList.remove('on', 'play'));
    if (this.playing) { const s = el.querySelector(`[data-s="${this.playing.key}"]`); if (s) s.classList.add('on', 'play') }
    if (!this.sel) return;
    const { kind, key } = this.sel, [pi, si, ci] = key.split('.');
    const sel = kind === 'word' ? `[data-w="${key}"]` : kind === 'chunk' ? `[data-c="${pi}.${si}.${ci}"]` : kind === 'sent' ? `[data-s="${pi}.${si}"]` : `[data-p="${pi}"]`;
    const t = el.querySelector(sel); if (t) t.classList.add('on');
  },
  bind(el) {
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { this.stop(); Mic.stop(); this.t = +b.dataset.t; this.sel = null; this.mic = null; this.render(el) });
    el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { this.mode = b.dataset.m; this.sel = null; this.mic = null; this.render(el) });
    el.querySelector('#showVi').onchange = e => { this.showVi = e.target.checked; this.render(el) };
    el.querySelector('#slow').onchange = e => { this.rate = e.target.checked ? 0.7 : 0.9 };
    el.querySelector('#playAll').onclick = () => { this.playing ? (this.stop(), this.render(el)) : this.playFrom(el, 0, 0) };
    const tq = el.querySelector('#toQs'); if (tq) tq.onclick = () => { if (this.lib === 'topic') Practice.openTopic(this.topicId, this.text().set, 'practice'); else Practice.open(this.text().set, 'practice'); go('practice') };
    el.querySelector('.doc').onclick = e => {
      const w = e.target.closest('.w'); if (!w) return;
      const key = w.dataset.w; const [pi, si, ci] = key.split('.');
      this.stop(); Mic.stop(); this.sel = { kind: this.mode, key: this.mode === 'word' ? key : this.mode === 'chunk' ? `${pi}.${si}.${ci}.0` : this.mode === 'sent' ? `${pi}.${si}.0.0` : `${pi}.0.0.0` }; this.mic = null;
      if (this.mode === 'word') { const raw = cleanWord(w.textContent); if (raw) speak(raw) }
      this.render(el);
    };
    const cs = document.getElementById('closeSheet'); if (cs) cs.onclick = () => { Mic.stop(); this.sel = null; this.mic = null; this.render(el) };
    const rm = document.getElementById('rMic');
    if (rm) rm.onclick = () => {
      const { kind, key } = this.sel, P = this.parts(key);
      const target = kind === 'word' ? this.wordAt(P) : kind === 'chunk' ? P.c[0] : kind === 'sent' ? P.s.en : P.p.map(s => s.en).join(' ');
      Mic.start(target, { long: kind === 'para' }, res => { this.mic = res; if (tab === 'read') this.render(el) })
    };
    const ar = document.getElementById('addRv');
    if (ar) ar.onclick = () => {
      const u = unitWordOf(this.wordAt(this.parts(this.sel.key)));
      const r = S.words[u.id] || (S.words[u.id] = { box: 0, due: today(), reviews: 0 }); r.due = today(); save(); renderStrip(); toast('Đã đưa “' + u.word + '” vào ôn tập hôm nay'); this.render(el)
    };
    const am = document.getElementById('addMine');
    if (am) am.onclick = () => {
      const P = this.parts(this.sel.key); const w = this.wordAt(P);
      S.mine = S.mine || []; if (!S.mine.some(x => x.w.toLowerCase() === w.toLowerCase())) { S.mine.push({ w, vi: glossOf(w), ctx: P.c[0], unit: this.D().id }); save(); toast('Đã lưu “' + w + '” vào Sổ từ') } else toast('Từ này đã có trong Sổ từ'); this.render(el)
    };
  },
  stop() { if (this.playing) { this.playing = null; try { speechSynthesis.cancel() } catch (e) { } } },
  playFrom(el, pi, si) {
    const T = this.text();
    if (pi >= T.paras.length) { this.playing = null; this.render(el); return }
    if (si >= T.paras[pi].length) { this.playFrom(el, pi + 1, 0); return }
    const s = T.paras[pi][si]; const token = { key: pi + '.' + si }; this.playing = token; this.sel = null; this.render(el);
    const node = el.querySelector(`[data-s="${token.key}"]`); if (node) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    try {
      const u = new SpeechSynthesisUtterance(s.en); u.lang = 'en-US'; u.rate = this.rate;
      const v = pickVoice('en-US'); if (v) u.voice = v;
      u.onend = () => { if (this.playing === token && tab === 'read') this.playFrom(el, pi, si + 1) };
      u.onerror = () => { if (this.playing === token) { this.playing = null; if (tab === 'read') this.render(el) } };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { this.playing = null; toast('Thiết bị này chưa hỗ trợ đọc'); this.render(el) }
  }
};
function T_title(R) { return R.text().title }
