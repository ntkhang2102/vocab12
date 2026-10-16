/* =========================================================
   4. BÀI TẬP TRONG SÁCH — Reflex Quiz, Reading 1–6.
   Luyện tập: chấm từng câu + lời giải chi tiết. Thi thử: tính giờ, nộp bài mới chấm.
   (Tab này còn chứa mục "Kiểm tra từ vựng" — xem quiz.js)
   ========================================================= */
function passageText(md, curN) {
  let h = inl(md);
  h = h.replace(/\((\d+)\)\s?_{2,}/g, (m, n) => `<span class="blank ${+n === curN ? 'cur' : ''}" data-b="${n}">(${n}) ______</span>`);
  h = h.replace(/\[(I{1,3}|IV|V|VI)\]/g, '<span class="ins">[$1]</span>');
  return h;
}
function passageHTML(set, pi, curN, open) {
  const P = set.passages && set.passages[pi]; if (!P) return '';
  const many = P.paras.length > 1 && set.type === 'reading';
  const body = P.paras.map((p, i) => `<p>${many ? `<span class="pn">${i + 1}</span>` : ''}${passageText(p, curN)}</p>`).join('');
  return `<details class="passage" ${open ? 'open' : ''}><summary>${set.type === 'reading' ? 'Bài đọc' : 'Đoạn văn'}: ${esc(P.title)}</summary><div class="passage-body">${body}${P.src ? `<p class="src">${esc(P.src)}</p>` : ''}</div></details>`;
}
function passagePlain(set, pi) { const P = set.passages && set.passages[pi]; return P ? P.title + '\n' + P.paras.map(plain).join('\n') : '' }
function questionBody(q) {
  let h = '';
  if (q.head) h += `<div class="qhead">${inl(q.head)}</div>`;
  if (q.items) h += `<div class="items">${q.items.map(([k, t]) => `<div><span class="k">${esc(k)}.</span><span>${inl(t)}</span></div>`).join('')}</div>`;
  if (q.tail) h += `<div class="qhead">${inl(q.tail)}</div>`;
  if (q.quote) h += `<div class="q-stem" style="font-family:var(--f-word)">“${inl(q.quote)}”</div>`;
  return h;
}
const Practice = {
  st: null, view: 'book', unit: null, topicId: null,
  open(setId, mode) { this.view = 'book'; this.init(setId, mode) },
  openTopic(tid, setId, mode) { this.view = 'topic'; this.topicId = tid; this.st = null; this.init(setId, mode || 'practice') },
  D() { return this.view === 'topic' ? UNITS[this.topicId] : U },
  init(set, mode) { const D = this.D(); this.st = { unit: D ? D.id : U.id, set, mode, i: 0, ans: {}, submitted: false, start: Date.now() } },
  set() { const D = this.D(); return D.setById[this.st.set] || D.sets[0] },
  render(el) {
    clearInterval(this.timer);
    const tps = availableTopics();
    const top = `<div class="seg"><button type="button" class="chip" data-view="book" aria-pressed="${this.view === 'book'}">Bài tập trong sách</button>${tps.length ? `<button type="button" class="chip" data-view="topic" aria-pressed="${this.view === 'topic'}">Tài liệu chủ đề</button>` : ''}<button type="button" class="chip" data-view="test" aria-pressed="${this.view === 'test'}">Kiểm tra từ vựng</button></div>`;
    if (this.view === 'test') {
      el.innerHTML = `<section class="sec">${top}<div id="qz"></div></section>`;
      this.bindTop(el); Quiz.render(el.querySelector('#qz')); return;
    }
    if (this.view === 'topic') {
      if (!this.topicId || !tps.some(t => t.id === this.topicId)) this.topicId = tps[0] && tps[0].id;
      if (!UNITS[this.topicId]) {
        el.innerHTML = `<section class="sec">${top}<p class="muted">Đang tải tài liệu…</p></section>`; this.bindTop(el);
        loadUnit(this.topicId).then(() => { if (tab === 'practice' && this.view === 'topic') this.render(el) }).catch(() => { el.querySelector('p').textContent = 'Không tải được tài liệu. Kiểm tra mạng rồi thử lại.' });
        return;
      }
    }
    const D = this.D();
    if (!D.sets || !D.sets.length) { el.innerHTML = `<section class="sec">${top}<div class="panel muted">Chưa có bài tập.</div></section>`; this.bindTop(el); return }
    if (!this.st || this.st.unit !== D.id || !D.setById[this.st.set]) this.init(D.sets[0].id, this.st ? this.st.mode : 'practice');
    const st = this.st, set = this.set();
    const isTopic = this.view === 'topic';
    const head = `${top}<div class="sec-h"><div><h2>${isTopic ? esc(D.title) : 'Bài tập trong sách'}</h2><p>${isTopic ? 'Tài liệu rèn đọc hiểu theo chủ đề, có đáp án và lời giải chi tiết.' : 'Câu hỏi, đáp án và lời giải lấy đúng từ tài liệu.'}</p></div></div>
   ${isTopic && tps.length > 1 ? `<div class="seg">${tps.map(t => `<button type="button" class="chip" data-tp="${t.id}" aria-pressed="${t.id === this.topicId}">${esc(t.title)}</button>`).join('')}</div>` : ''}
   <div class="seg">${D.sets.map(s => `<button type="button" class="chip" data-set="${s.id}" aria-pressed="${st.set === s.id}">${esc(s.short || s.name)} · ${s.qs.length} câu</button>`).join('')}</div>
   <div class="seg"><button type="button" class="chip" data-mode="practice" aria-pressed="${st.mode === 'practice'}">Luyện tập: chấm từng câu</button><button type="button" class="chip" data-mode="exam" aria-pressed="${st.mode === 'exam'}">Thi thử: tính giờ</button></div>
   ${set.intro ? `<p class="small muted" style="margin:0">${inl(set.intro)}</p>` : ''}`;
    const body = st.mode === 'practice' ? this.practiceHTML(set) : this.examHTML(set);
    el.innerHTML = `<section class="sec">${head}${body}</section>`;
    this.bindTop(el);
    el.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { this.topicId = b.dataset.tp; this.st = null; this.render(el) });
    el.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { this.init(b.dataset.set, st.mode); this.render(el) });
    el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { this.init(st.set, b.dataset.mode); this.render(el) });
    this.bind(el, set);
  },
  bindTop(el) { el.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { this.view = b.dataset.view; this.st = null; this.render(el); window.scrollTo({ top: 0 }) }) },
  qPanel(set, q, idx, total, chosen, show) {
    const ctx = set.type === 'reading' ? 'Câu hỏi về bài đọc "' + (set.passages[q.p || 0] || {}).title + '":\n' + passagePlain(set, q.p || 0) : set.type === 'cloze' ? 'Đoạn văn có chỗ trống (' + q.n + ').' : '';
    return `<div class="panel" style="display:grid;gap:12px" data-qi="${idx}">
   <div class="row"><span class="label">Question ${q.n}</span><span class="grow"></span>${total ? `<span class="label">${idx + 1}/${total}</span>` : ''}</div>
   <div class="q-stem">${set.type === 'cloze' ? `<span class="small muted">Chỗ trống (${q.n}):</span> ` : ''}${inl(q.stem)}</div>${questionBody(q)}${mcHTML(q.opts, 'pq')}
   ${show ? `<div class="verdict ${chosen === q.ans ? 'ok' : 'no'}">${chosen === q.ans ? 'Chính xác' : chosen == null ? 'Chưa làm · Đáp án đúng: ' + 'ABCD'[q.ans] : 'Chưa đúng · Đáp án đúng: ' + 'ABCD'[q.ans]}</div>${explHTML(q.lines, q.ans)}<div class="row">${aiBtn(aiPromptQuestion(q, chosen, ctx), 'Hỏi AI thêm')}</div>` : ''}</div>`;
  },
  practiceHTML(set) {
    const st = this.st, q = set.qs[st.i], ch = st.ans[st.i];
    const done = Object.keys(st.ans).length, right = set.qs.filter((x, i) => st.ans[i] === x.ans).length;
    const pass = set.passages ? passageHTML(set, q.p || 0, set.type === 'cloze' ? q.n : null, true) : '';
    return `<div class="row small muted"><span>Đã làm ${done}/${set.qs.length} · đúng ${right}</span></div>
   <div class="progress"><i style="width:${done / set.qs.length * 100}%"></i></div>
   ${pass}
   ${this.qPanel(set, q, st.i, set.qs.length, ch, ch !== undefined)}
   <div class="row"><button class="btn ghost" type="button" id="pPrev" ${st.i ? '' : 'disabled'}>‹ Câu trước</button><span class="grow"></span><button class="btn" type="button" id="pNext" ${st.i < set.qs.length - 1 ? '' : 'disabled'}>Câu sau ›</button></div>`;
  },
  examHTML(set) {
    const st = this.st;
    const blocks = (show) => {
      if (!set.passages) return set.qs.map((q, i) => this.qPanel(set, q, i, 0, st.ans[i], show)).join('');
      return set.passages.map((P, pi) => passageHTML(set, pi, null, true) + set.qs.map((q, i) => (q.p || 0) === pi ? this.qPanel(set, q, i, 0, st.ans[i], show) : '').join('')).join('');
    };
    if (!st.submitted) {
      return `<div class="panel row" style="position:sticky;top:var(--hdr,120px);z-index:3"><b id="clock" class="clock">00:00</b><span class="muted small">/ ${set.min}:00</span><span class="grow"></span><span class="small muted" id="cnt">${Object.keys(st.ans).length}/${set.qs.length}</span><button class="btn" type="button" id="submit">Nộp bài</button></div>
     ${blocks(false)}`;
    }
    const right = set.qs.filter((x, i) => st.ans[i] === x.ans).length, secs = Math.round((st.end - st.start) / 1000);
    const wrongN = set.qs.filter((x, i) => st.ans[i] !== undefined && st.ans[i] !== x.ans).length, blank = set.qs.length - Object.keys(st.ans).length;
    return `<div class="panel" style="display:grid;gap:6px"><h3 style="font-size:20px">Kết quả: ${right}/${set.qs.length} câu đúng · ${(right / set.qs.length * 10).toFixed(1)} điểm</h3><p class="muted small" style="margin:0">Thời gian làm bài ${Math.floor(secs / 60)} phút ${secs % 60} giây${secs > set.min * 60 ? ' (quá giờ)' : ''}. ${wrongN} câu sai đã được ghi vào Sổ câu sai${blank ? `, ${blank} câu bỏ trống` : ''}.</p><div class="row"><button class="btn ghost" type="button" id="redo">Làm lại đề</button><button class="btn" type="button" data-go="notebook">Mở Sổ câu sai</button></div></div>
   ${blocks(true)}`;
  },
  bind(el, set) {
    const st = this.st;
    const D = this.D();
    const logWrong = (q, i) => addWrong({ key: D.id + '|' + set.id + '|' + q.n, unit: D.id, kind: 'q', set: set.id, n: q.n, src: (D.kind === 'topic' ? (unitMeta(D.id).topic || 'Chủ đề') + ' · ' : '') + (set.short || set.name), group: q.group, chosen: plain(q.opts[i]) });
    if (st.mode === 'practice') {
      const q = set.qs[st.i];
      if (st.ans[st.i] !== undefined) lockMC(el, 'pq', st.ans[st.i], q.ans);
      el.querySelectorAll('[data-pq]').forEach(b => b.onclick = () => { if (st.ans[st.i] !== undefined) return; const i = +b.dataset.pq; st.ans[st.i] = i; if (i !== q.ans) { logWrong(q, i); renderStrip() } this.render(el) });
      el.querySelector('#pPrev').onclick = () => { st.i--; this.render(el) };
      el.querySelector('#pNext').onclick = () => { st.i++; this.render(el); const p = el.querySelector('[data-qi]'); if (p && set.passages) p.scrollIntoView({ block: 'nearest' }) };
    } else if (!st.submitted) {
      el.querySelectorAll('[data-qi]').forEach(p => {
        const qi = +p.dataset.qi;
        if (st.ans[qi] !== undefined) p.querySelector(`[data-pq="${st.ans[qi]}"]`).classList.add('sel');
        p.querySelectorAll('[data-pq]').forEach(b => b.onclick = () => { st.ans[qi] = +b.dataset.pq; p.querySelectorAll('[data-pq]').forEach(x => x.classList.toggle('sel', x === b)); el.querySelector('#cnt').textContent = Object.keys(st.ans).length + '/' + set.qs.length })
      });
      const clock = el.querySelector('#clock');
      const tick = () => { const s = Math.floor((Date.now() - st.start) / 1000); clock.textContent = fmtClock(s); clock.style.color = s > set.min * 60 ? 'var(--bad)' : '' };
      tick(); this.timer = setInterval(tick, 1000);
      el.querySelector('#submit').onclick = () => {
        const left = set.qs.length - Object.keys(st.ans).length;
        if (left && !st.confirm) { st.confirm = true; toast(`Còn ${left} câu chưa làm. Bấm Nộp bài lần nữa để nộp.`); return }
        clearInterval(this.timer); st.submitted = true; st.end = Date.now();
        set.qs.forEach((q, i) => { if (st.ans[i] !== undefined && st.ans[i] !== q.ans) logWrong(q, st.ans[i]) });
        const right = set.qs.filter((x, i) => st.ans[i] === x.ans).length;
        S.tests.push({ kind: 'book', unit: D.id, set: set.id, name: set.short || set.name, right, total: set.qs.length, secs: Math.round((st.end - st.start) / 1000), day: today() }); S.tests = S.tests.slice(-50); save();
        renderStrip(); this.render(el); window.scrollTo({ top: 0 })
      };
    } else {
      el.querySelectorAll('[data-qi]').forEach(p => { const qi = +p.dataset.qi; lockMC(p, 'pq', st.ans[qi] ?? -1, set.qs[qi].ans) });
      el.querySelector('#redo').onclick = () => { this.init(st.set, 'exam'); this.render(el) };
    }
  }
};
