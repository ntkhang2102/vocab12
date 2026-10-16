/* =========================================================
   7. VIẾT — chỉ sắp xếp từ thành câu và dịch Việt → Anh (câu đơn, câu ghép)
   có gợi ý 3 bậc; không viết tự do.
   ========================================================= */
const Write = {
  mode: 'order', i: 0, st: null, trap: false, unit: null,
  items() { return this.mode === 'order' ? U.vocab.filter(v => { const n = v.ex.split(' ').length; return n >= 6 && n <= 14 }) : U.vocab.filter(v => v.ex && v.tr) },
  newState(v) {
    if (this.mode === 'order') {
      const toks = v.ex.split(' ');
      const cand = this.trap ? shuffle(U.vocab.filter(x => x.id !== v.id && x.cloze && !toks.map(t => t.toLowerCase()).includes(x.cloze.split(' ')[0].toLowerCase()))) : [];
      const trap = cand.length ? [cand[0].cloze.split(' ')[0].toLowerCase()] : [];
      return { pool: shuffle(toks.map((t, k) => ({ t, k })).concat(trap.map((t, k) => ({ t, k: 100 + k })))), ans: [], checked: null }
    }
    return { hints: 0, val: '', result: null }
  },
  check(val, v) {
    const a = norm(val), b = norm(v.ex);
    if (!a) return { ok: false, empty: true };
    if (a === b) return { ok: true, exact: true, score: 1 };
    const m = lcsMarks(v.ex, val);
    const usesTarget = norm(val).includes(norm(v.cloze).split(' ')[0].slice(0, 4));
    return { ok: false, score: m.score, hit: m.hit, usesTarget };
  },
  resultHTML(r, v, val) {
    if (r.empty) return `<div class="verdict no">Bạn chưa viết câu nào.</div>`;
    if (r.ok) return `<div class="verdict ok">Chính xác, khớp đáp án mẫu.</div><div class="small">${esc(v.ex)}</div>`;
    const pct = Math.round(r.score * 100);
    return `<div class="verdict ${pct >= 80 ? 'mid' : 'no'}">${pct >= 80 ? 'Gần đúng' : 'Chưa đúng'} · trùng ${pct}% với đáp án mẫu${r.usesTarget ? '' : ' · chưa dùng từ mục tiêu'}</div>
   <div class="small muted">Đáp án mẫu (từ xanh là phần bạn đã viết đúng, từ gạch đỏ là phần thiếu hoặc khác):</div>
   <div class="diff">${diffHTML(v.ex, r.hit)}</div>
   <div class="small muted">Một câu tiếng Việt có thể dịch đúng nhiều cách. Nếu câu của bạn khác đáp án mẫu nhưng bạn nghĩ vẫn đúng, hãy hỏi AI.</div>
   <div class="row">${aiBtn(`Bạn là giáo viên tiếng Anh chấm bài dịch của học sinh lớp 12.\nCâu tiếng Việt: "${v.tr}"\nĐáp án mẫu: "${v.ex}"\nTừ cần dùng: "${v.word}" (${v.meaning})\nCâu học sinh viết: "${val || ''}"\nHãy cho biết câu của học sinh đúng, gần đúng hay sai (chấp nhận cách dịch khác đáp án mẫu nếu đúng nghĩa và ngữ pháp), chỉ ra lỗi bằng tiếng Việt và viết lại câu đã sửa.`, 'Nhờ AI chấm câu này')}</div>`;
  },
  render(el) {
    if (this.unit !== U.id) { this.unit = U.id; this.i = 0; this.st = null }
    const items = this.items(); if (this.i >= items.length) this.i = 0;
    const v = items[this.i];
    if (!this.st || this.st.id !== v.id || this.st.mode !== this.mode) { this.st = Object.assign(this.newState(v), { id: v.id, mode: this.mode }) }
    const st = this.st;
    let body;
    if (this.mode === 'order') {
      body = `<div class="label">Ghép các mảnh thành câu hoàn chỉnh</div><div class="tr">${esc(v.tr)}</div>
     <div class="tray answer" id="ansT" aria-label="Câu của bạn">${st.ans.map((x, k) => `<button class="tok" type="button" data-back="${k}">${esc(x.t)}</button>`).join('') || '<span class="muted small">Chạm vào các mảnh bên dưới theo đúng thứ tự</span>'}</div>
     <div class="tray" id="poolT">${st.pool.map((x, k) => `<button class="tok ${st.ans.includes(x) ? 'used' : ''}" type="button" data-tok="${k}">${esc(x.t)}</button>`).join('')}</div>
     <label class="row small"><input type="checkbox" id="trap" ${this.trap ? 'checked' : ''}> Thêm 1 mảnh bẫy (khó hơn)</label>
     ${st.checked !== null ? (st.checked ? `<div class="verdict ok">Chính xác!</div>` : `<div class="verdict no">Chưa đúng thứ tự.</div><div class="small"><b>Đáp án:</b> ${esc(v.ex)}</div>`) : ''}
     <div class="row"><button class="btn ghost" type="button" id="clr">Xếp lại</button><span class="grow"></span>${st.checked === null ? `<button class="btn" type="button" id="chk" ${st.ans.length ? '' : 'disabled'}>Kiểm tra</button>` : `<button class="btn" type="button" id="wNext">Câu tiếp ›</button>`}</div>`;
    } else {
      const words = v.ex.split(' ');
      const hints = [
        `<div><b>Từ khoá bắt buộc:</b> ${esc(v.cloze)}${v.colloc ? ` · collocation: ${esc(v.colloc)}` : ''}</div>`,
        `<div><b>Chữ cái đầu (${words.length} từ):</b> ${esc(words.map(w => w.replace(/^([^A-Za-z]*[A-Za-z])[A-Za-z'-]*/, '$1_')).join(' '))}</div>`,
        `<div><b>Nửa đầu câu:</b> ${esc(words.slice(0, Math.ceil(words.length / 2)).join(' '))} …</div>`];
      const maxPts = [10, 8, 6, 4][st.hints];
      const kindLbl = /,|;|\b(and|but|so|or|because|although|while|when|if|who|which|that)\b/i.test(v.ex) ? 'Câu ghép / câu phức' : 'Câu đơn';
      body = `<div class="row"><span class="label">Dịch sang tiếng Anh</span><span class="tag src2">${kindLbl}</span></div><div class="vn">${esc(v.tr)}</div><div class="small muted">Dùng từ: <b>${esc(v.word)}</b> (${esc(v.meaning)})</div>
     ${st.hints ? `<div class="hintbox">${hints.slice(0, st.hints).join('')}</div>` : ''}
     <textarea class="input" id="wIn" placeholder="Viết câu tiếng Anh của bạn" autocapitalize="sentences" ${st.result ? 'disabled' : ''}>${esc(st.val)}</textarea>
     <div class="row"><button class="btn ghost" type="button" id="hint" ${st.hints >= 3 || st.result ? 'disabled' : ''}>Gợi ý ${st.hints + 1 <= 3 ? st.hints + 1 + '/3' : ''}</button><span class="small muted">Điểm tối đa: ${maxPts}/10</span><span class="grow"></span>${st.result ? `<button class="btn" type="button" id="wNext">Câu tiếp ›</button>` : `<button class="btn" type="button" id="wChk">Kiểm tra</button>`}</div>
     ${st.result ? this.resultHTML(st.result, v, st.val) : ''}`;
    }
    el.innerHTML = `<section class="sec"><div class="sec-h"><div><h2>Luyện viết</h2><p>Viết lại câu ví dụ trong sách: sắp xếp từ hoặc dịch Việt → Anh, có gợi ý từng bậc.</p></div></div>
   <div class="seg"><button class="chip" type="button" data-wm="order" aria-pressed="${this.mode === 'order'}">Sắp xếp từ thành câu</button><button class="chip" type="button" data-wm="trans" aria-pressed="${this.mode === 'trans'}">Dịch Việt → Anh</button></div>
   <div class="panel" style="display:grid;gap:12px"><div class="row"><span class="label">Câu ${this.i + 1} / ${items.length}</span><span class="grow"></span><button class="btn ghost" type="button" id="wPrev" aria-label="Câu trước">‹</button><button class="btn ghost" type="button" id="wSkip" aria-label="Câu sau">›</button></div>${body}</div></section>`;
    this.bind(el, v, items);
  },
  bind(el, v, items) {
    const st = this.st;
    el.querySelectorAll('[data-wm]').forEach(b => b.onclick = () => { this.mode = b.dataset.wm; this.i = 0; this.st = null; this.render(el) });
    const next = d => { this.i = (this.i + d + items.length) % items.length; this.st = null; this.render(el) };
    el.querySelector('#wPrev').onclick = () => next(-1); el.querySelector('#wSkip').onclick = () => next(1);
    const wn = el.querySelector('#wNext'); if (wn) wn.onclick = () => next(1);
    const logWrong = (val) => { addWrong({ key: U.id + '|wr|' + v.id, unit: U.id, kind: 'wr', wid: v.id, mode: this.mode, src: 'Viết', group: this.mode === 'order' ? 'Viết: trật tự câu' : 'Viết: dịch câu', chosen: val }); renderStrip() };
    if (this.mode === 'order') {
      el.querySelectorAll('[data-tok]').forEach(b => b.onclick = () => { if (st.checked !== null) return; const x = st.pool[+b.dataset.tok]; if (!st.ans.includes(x)) { st.ans.push(x); this.render(el) } });
      el.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { if (st.checked !== null) return; st.ans.splice(+b.dataset.back, 1); this.render(el) });
      el.querySelector('#clr').onclick = () => { st.ans = []; st.checked = null; this.render(el) };
      el.querySelector('#trap').onchange = e => { this.trap = e.target.checked; this.st = null; this.render(el) };
      const c = el.querySelector('#chk'); if (c) c.onclick = () => { const val = st.ans.map(x => x.t).join(' '); st.checked = norm(val) === norm(v.ex); if (!st.checked) logWrong(val); this.render(el) };
    } else {
      const inp = el.querySelector('#wIn'); inp.oninput = () => st.val = inp.value;
      el.querySelector('#hint').onclick = () => { st.hints++; this.render(el) };
      const c = el.querySelector('#wChk'); if (c) c.onclick = () => { st.val = inp.value; st.result = this.check(st.val, v); if (!st.result.ok && !st.result.empty) logWrong(st.val); this.render(el) };
    }
  }
};
