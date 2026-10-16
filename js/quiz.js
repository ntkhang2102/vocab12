/* =========================================================
   8. KIỂM TRA TỪ VỰNG NGẪU NHIÊN — chọn một hoặc nhiều Unit (mọi Part),
   số câu, dạng câu; tính giờ, chấm điểm; câu sai vào Sổ câu sai.
   ========================================================= */
const QTYPES = [
  ['m2w', 'Nhìn nghĩa, chọn từ'],
  ['w2m', 'Nhìn từ, chọn nghĩa'],
  ['cloze', 'Điền từ vào câu'],
  ['syn', 'Đồng nghĩa / trái nghĩa'],
  ['dict', 'Nghe và viết lại'],
  ['type', 'Gõ từ theo nghĩa']
];
const qtName = k => (QTYPES.find(x => x[0] === k) || [k, k])[1];
function canQT(v, qt) {
  if (qt === 'syn') return !!(v.syn && v.syn.length);
  if (qt === 'cloze') return !!(v.cloze && v.ex && v.ex.toLowerCase().includes(v.cloze.toLowerCase()));
  return true;
}
/* Tạo câu hỏi cho một từ (dùng cho Kiểm tra và khi làm lại trong Sổ câu sai) */
function makeWordQ(v, qt, seed) {
  const UU = UNITS[v.unit], same = UU.vocab.filter(x => x.type === v.type && x.id !== v.id);
  if (qt === 'cloze') {
    const i = v.ex.toLowerCase().indexOf(v.cloze.toLowerCase());
    const stem = esc(v.ex.slice(0, i)) + '______' + esc(v.ex.slice(i + v.cloze.length));
    let ds = shuffle(same.filter(x => v.type === 'phrase' || x.pos === v.pos)).slice(0, 3).map(x => x.cloze);
    if (ds.length < 3) ds = ds.concat(shuffle(same).map(x => x.cloze).filter(x => !ds.includes(x))).slice(0, 3);
    const opts = shuffle([v.cloze, ...ds]);
    return { kind: 'mc', qt, title: 'Điền từ vào câu', stem, sub: '', opts, ans: opts.indexOf(v.cloze), right: v.cloze };
  }
  if (qt === 'syn') {
    const useAnt = (seed ?? Math.random() * 2 | 0) % 2 === 1 && v.ant && v.ant.length;
    const right = shuffle(useAnt ? v.ant : v.syn)[0];
    const pool = shuffle(availableLoadedWords().filter(x => x.syn && x.id !== v.id).flatMap(x => useAnt ? x.syn : (x.ant || []))).filter(x => x !== right && !(useAnt ? v.ant : v.syn).includes(x));
    const opts = shuffle([right, ...[...new Set(pool)].slice(0, 3)]);
    return { kind: 'mc', qt, title: useAnt ? 'Chọn từ TRÁI nghĩa' : 'Chọn từ ĐỒNG nghĩa', stem: `<span class="headword" style="font-size:26px">${esc(v.word)}</span>`, sub: '', opts, ans: opts.indexOf(right), right };
  }
  if (qt === 'w2m') {
    const opts = shuffle([v.meaning, ...shuffle(same).slice(0, 3).map(x => x.meaning)]);
    return { kind: 'mc', qt, title: 'Chọn nghĩa đúng', stem: `<span class="headword" style="font-size:26px">${esc(v.word)}</span>`, sub: '', opts, ans: opts.indexOf(v.meaning), right: v.meaning };
  }
  if (qt === 'dict') return { kind: 'type', qt, title: 'Nghe và viết lại', stem: '', listen: true, right: v.word };
  if (qt === 'type') return { kind: 'type', qt, title: 'Gõ từ theo nghĩa', stem: '“' + esc(v.meaning) + '”', hint: `Bắt đầu bằng “${esc(v.word[0])}”, ${v.word.length} ký tự`, right: v.word };
  const opts = shuffle([v.word, ...shuffle(same).slice(0, 3).map(x => x.word)]);
  return { kind: 'mc', qt: 'm2w', title: 'Chọn từ đúng nghĩa', stem: '“' + esc(v.meaning) + '”', sub: '', opts, ans: opts.indexOf(v.word), right: v.word };
}
function availableLoadedWords() { return Object.values(UNITS).flatMap(u => u.WORDS) }
function wordQHTML(q, v, attr) {
  if (q.kind === 'mc') return `<div class="q-stem">${q.stem}</div>${q.sub ? `<div class="tr">${q.sub}</div>` : ''}<div class="opts">${q.opts.map((o, i) => `<button type="button" class="opt" data-${attr}="${i}"><span class="k">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
  return `${q.listen ? `<div class="row">${spkBtn(v.word, 'Nghe')} ${spkBtn(v.word, 'Nghe chậm', 'en-US', 0.6)}</div>` : `<div class="q-stem">${q.stem}</div><div class="muted small">${q.hint || ''}</div>`}
   <form class="row" data-${attr}f><input class="input" style="flex:1 1 200px" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Gõ từ tiếng Anh"><button class="btn" type="submit">${attr === 'tq' ? 'Trả lời' : 'Kiểm tra'}</button></form>`;
}

const Quiz = {
  cfg: null, run: null, timer: null,
  defaults() { return { units: [U.id], n: 20, types: ['m2w', 'w2m', 'cloze', 'syn'], perQ: 30 } },
  render(el) {
    clearInterval(this.timer);
    if (!this.cfg) this.cfg = this.defaults();
    if (this.run && this.run.done) return this.resultView(el);
    if (this.run) return this.runView(el);
    this.setupView(el);
  },
  setupView(el) {
    const c = this.cfg, av = availableUnits();
    c.units = c.units.filter(id => av.some(u => u.id === id)); if (!c.units.length) c.units = [U.id];
    const parts = CATALOG.parts.map(p => {
      const us = p.units.filter(u => u.ready);
      return `<div class="part-h"><h3>Part ${p.part} <span class="muted small">(${esc(p.level)})</span></h3>${us.length ? `<button class="btn ghost sm" type="button" data-allpart="${p.part}">Chọn cả Part</button>` : ''}</div>
      <div class="seg">${p.units.map(u => `<button type="button" class="chip" data-u="${u.id}" aria-pressed="${c.units.includes(u.id)}" ${u.ready ? '' : 'disabled'}>Unit ${u.unit}</button>`).join('')}</div>`
    }).join('');
    const hist = (S.tests || []).filter(t => t.kind === 'quiz').slice(-5).reverse();
    el.innerHTML = `<div class="sec-h"><div><h2>Kiểm tra từ vựng</h2><p>Đề ngẫu nhiên từ các Unit bạn chọn. Làm xong mới chấm; câu sai được ghi vào Sổ câu sai.</p></div></div>
    <div class="panel" style="display:grid;gap:10px"><div class="label">1. Chọn Unit</div>${parts}</div>
    <div class="panel" style="display:grid;gap:10px"><div class="label">2. Số câu</div>
      <div class="seg">${[10, 20, 30, 40, 50].map(n => `<button type="button" class="chip" data-n="${n}" aria-pressed="${c.n === n}">${n} câu</button>`).join('')}</div>
      <div class="label" style="margin-top:4px">3. Dạng câu</div>
      <div>${QTYPES.map(([k, l]) => `<label class="chk"><input type="checkbox" data-qt="${k}" ${c.types.includes(k) ? 'checked' : ''}>${l}</label>`).join('')}</div>
      <div class="label" style="margin-top:4px">4. Thời gian</div>
      <div class="seg">${[[20, '20 giây/câu'], [30, '30 giây/câu'], [45, '45 giây/câu'], [0, 'Không giới hạn']].map(([s, l]) => `<button type="button" class="chip" data-t="${s}" aria-pressed="${c.perQ === s}">${l}</button>`).join('')}</div>
    </div>
    <div class="row end"><span class="small muted grow">${c.units.length} Unit · ${c.n} câu${c.perQ ? ' · ' + Math.round(c.n * c.perQ / 60) + ' phút' : ''}</span><button class="btn" type="button" id="qzGo" ${c.units.length && c.types.length ? '' : 'disabled'}>Bắt đầu kiểm tra ›</button></div>
    ${hist.length ? `<div class="panel hist"><div class="label">Lần kiểm tra gần đây</div>${hist.map(t => `<div><span>${dayLabel(t.day)} · ${esc(t.units.map(u => unitLabel(u, true)).join(', '))}</span><b>${t.right}/${t.total} · ${(t.right / t.total * 10).toFixed(1)}đ</b></div>`).join('')}</div>` : ''}`;
    el.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const id = b.dataset.u; c.units = c.units.includes(id) ? c.units.filter(x => x !== id) : c.units.concat(id); this.setupView(el) });
    el.querySelectorAll('[data-allpart]').forEach(b => b.onclick = () => { const p = CATALOG.parts.find(x => x.part === +b.dataset.allpart); const ids = p.units.filter(u => u.ready).map(u => u.id); const all = ids.every(id => c.units.includes(id)); c.units = all ? c.units.filter(x => !ids.includes(x)) : [...new Set(c.units.concat(ids))]; this.setupView(el) });
    el.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { c.n = +b.dataset.n; this.setupView(el) });
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { c.perQ = +b.dataset.t; this.setupView(el) });
    el.querySelectorAll('[data-qt]').forEach(b => b.onchange = () => { const k = b.dataset.qt; c.types = b.checked ? c.types.concat(k) : c.types.filter(x => x !== k); this.setupView(el) });
    el.querySelector('#qzGo').onclick = async () => {
      el.querySelector('#qzGo').disabled = true; el.querySelector('#qzGo').textContent = 'Đang chuẩn bị…';
      try { await Promise.all(c.units.map(loadUnit)) } catch (e) { toast('Không tải được dữ liệu Unit. Kiểm tra mạng.'); this.setupView(el); return }
      this.start(); this.render(el);
    };
  },
  start() {
    const c = this.cfg;
    const pool = shuffle(c.units.flatMap(id => UNITS[id].vocab));
    const qs = [];
    for (const v of pool) {
      if (qs.length >= c.n) break;
      const types = shuffle(c.types.filter(t => canQT(v, t))); if (!types.length) continue;
      qs.push({ wid: v.id, q: makeWordQ(v, types[0]) });
    }
    this.run = { qs, i: 0, ans: [], start: Date.now(), limit: c.perQ ? qs.length * c.perQ : 0, done: false };
  },
  runView(el) {
    const r = this.run, item = r.qs[r.i], v = wordById(item.wid), q = item.q;
    el.innerHTML = `<div class="panel row" style="gap:10px"><b class="clock" id="qzClock">00:00</b>${r.limit ? `<span class="small muted">/ ${fmtClock(r.limit)}</span>` : ''}<span class="grow"></span><span class="label">Câu ${r.i + 1}/${r.qs.length}</span><button class="btn ghost sm" type="button" id="qzStop">Nộp bài</button></div>
    <div class="progress"><i style="width:${r.i / r.qs.length * 100}%"></i></div>
    <div class="panel" style="display:grid;gap:12px"><div class="row"><b>${q.title}</b><span class="tag unit">${esc(unitLabel(v.unit, true))}</span></div>${wordQHTML(q, v, 'tq')}</div>`;
    const next = (val, ok) => { r.ans[r.i] = { val, ok }; r.i++; if (r.i >= r.qs.length) this.finish(); this.render(el); };
    el.querySelectorAll('[data-tq]').forEach(b => b.onclick = () => { const i = +b.dataset.tq; next(q.opts[i], i === q.ans) });
    const f = el.querySelector('[data-tqf]');
    if (f) { const inp = f.querySelector('input'); inp.focus({ preventScroll: true }); if (q.listen) setTimeout(() => speak(v.word), 250); f.onsubmit = e => { e.preventDefault(); next(inp.value, norm(inp.value) === norm(v.word)) } }
    el.querySelector('#qzStop').onclick = e => { if (!r.confirm) { r.confirm = true; e.target.textContent = 'Bấm lần nữa để nộp'; return } this.finish(); this.render(el) };
    const clock = el.querySelector('#qzClock');
    const tick = () => { const s = Math.floor((Date.now() - r.start) / 1000); clock.textContent = fmtClock(s); if (r.limit && s >= r.limit) { clearInterval(this.timer); toast('Hết giờ! Bài đã được nộp.'); this.finish(); this.render(el) } };
    tick(); this.timer = setInterval(tick, 1000);
  },
  finish() {
    const r = this.run; if (r.done) return;
    clearInterval(this.timer); r.done = true; r.end = Date.now();
    r.qs.forEach((it, i) => {
      const a = r.ans[i]; if (!a || a.ok) return;
      const v = wordById(it.wid);
      addWrong({ key: v.unit + '|kt|' + v.id + '|' + it.q.qt, unit: v.unit, kind: 'kt', wid: v.id, qt: it.q.qt, src: 'Kiểm tra', group: v.type === 'phrase' ? 'Phrasal verb' : 'Từ vựng', chosen: a.val });
    });
    const right = r.ans.filter(a => a && a.ok).length;
    S.tests.push({ kind: 'quiz', units: this.cfg.units.slice(), right, total: r.qs.length, secs: Math.round((r.end - r.start) / 1000), day: today() }); S.tests = S.tests.slice(-50); save();
    renderStrip();
  },
  resultView(el) {
    const r = this.run, right = r.ans.filter(a => a && a.ok).length, secs = Math.round((r.end - r.start) / 1000), N = r.qs.length;
    const blank = N - r.ans.filter(Boolean).length;
    const rows = r.qs.map((it, i) => {
      const a = r.ans[i], v = wordById(it.wid);
      if (a && a.ok) return '';
      return `<div class="wrong"><div class="row"><span class="tag">${a ? 'Sai' : 'Bỏ trống'}</span><span class="tag src2">${esc(qtName(it.q.qt))}</span><span class="tag unit">${esc(unitLabel(v.unit, true))}</span></div>
       ${a ? `<div class="small" style="color:var(--bad)">Bạn trả lời: ${esc(a.val || '(trống)')}</div>` : ''}${answerInfoHTML(v)}</div>`
    }).join('');
    el.innerHTML = `<div class="panel" style="display:grid;gap:8px"><div class="label">Kết quả kiểm tra</div><div class="score">${(right / N * 10).toFixed(1)} điểm</div>
     <p class="muted small" style="margin:0">Đúng ${right}/${N} câu${blank ? ` · bỏ trống ${blank}` : ''} · thời gian ${Math.floor(secs / 60)} phút ${secs % 60} giây. Câu sai đã vào Sổ câu sai.</p>
     <div class="row"><button class="btn ghost" type="button" id="qzNew">Đổi đề / cấu hình</button><button class="btn" type="button" id="qzAgain">Làm đề mới cùng cấu hình</button></div></div>
     ${rows || '<div class="panel">Tuyệt vời, bạn không sai câu nào!</div>'}`;
    el.querySelector('#qzNew').onclick = () => { this.run = null; this.render(el) };
    el.querySelector('#qzAgain').onclick = () => { this.start(); this.render(el) };
  }
};
