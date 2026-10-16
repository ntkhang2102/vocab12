/* =========================================================
   6. NÓI — đọc từ, đọc câu (shadowing), dịch nói Việt → Anh.
   ========================================================= */
const Speak = {
  mode: 'word', i: 0, res: null, unit: null,
  items() { return this.mode === 'word' ? U.vocab : U.vocab.filter(v => v.ex && v.ex.split(' ').length <= 16) },
  render(el) {
    if (this.unit !== U.id) { this.unit = U.id; this.i = 0; this.res = null }
    const items = this.items(); if (this.i >= items.length) this.i = 0;
    const v = items[this.i];
    const target = this.mode === 'word' ? v.word : v.ex;
    let prompt;
    if (this.mode === 'word') prompt = `<div class="target">${esc(v.word)}</div>${v.ipa ? `<div class="ipa">${esc(v.ipa)}</div>` : ''}<div class="muted small">${esc(v.meaning)}</div>`;
    else if (this.mode === 'shadow') prompt = `<div class="target" style="font-size:19px">${highlight(v.ex, v.cloze)}</div><div class="tr">${esc(v.tr)}</div>`;
    else prompt = `<div class="label">Nói câu này bằng tiếng Anh</div><div class="vn">${esc(v.tr)}</div><div class="muted small">Dùng: <b>${esc(v.word)}</b></div>`;
    const listen = this.mode === 'translate' ? (this.res && !this.res.listening ? `<div class="row">${spkBtn(target, 'Nghe đáp án mẫu')}</div>` : '') : `<div class="row">${spkBtn(target, 'Nghe mẫu')} ${spkBtn(target, 'Nghe chậm', 'en-US', 0.6)}${this.mode === 'word' ? ' ' + spkBtn(target, 'UK', 'en-GB') : ''}</div>`;
    let result = '';
    if (this.res && !this.res.listening) {
      if (this.res.err) result = `<div class="notice">${esc(this.res.err)}</div>`;
      else {
        const m = this.res.m, pct = Math.round(m.score * 100), ok = pct >= 85, mid = pct >= 60;
        result = `<div class="panel" style="display:grid;gap:8px;background:var(--paper)">
        <div class="row"><span class="verdict ${ok ? 'ok' : mid ? 'mid' : 'no'}">${ok ? 'Tốt' : 'Cần luyện thêm'} · khớp ${pct}%</span></div>
        <div class="small muted">App nghe được: “${esc(this.res.heard)}”</div>
        <div class="diff">${diffHTML(target, m.hit)}</div>
        ${ok ? '' : `<div class="small muted">Chữ gạch đỏ là phần app chưa nghe ra hoặc bạn đọc chưa rõ. ${this.res.pushed ? 'Từ này đã được đưa lại vào lịch ôn hôm nay.' : ''}</div>`}
        ${this.mode === 'translate' ? `<div class="small"><b>Đáp án mẫu:</b> ${esc(v.ex)}</div><div class="small muted">Câu nói khác đáp án mẫu vẫn có thể đúng. ${aiBtn(`Mình là học sinh lớp 12. Câu tiếng Việt: "${v.tr}". Mình nói (qua nhận dạng giọng nói): "${this.res.heard}". Đáp án mẫu: "${v.ex}". Câu của mình có đúng nghĩa và ngữ pháp không? Giải thích ngắn bằng tiếng Việt và sửa giúp mình.`, 'Hỏi AI')}</div>` : ''}</div>`
      }
    }
    const support = SRC ? '' : `<div class="notice"><b>Chưa dùng được micro ở đây.</b> ${esc(MIC_HELP)} Phần nghe mẫu vẫn dùng được.</div>`;
    const rec = Mic.rec && this.res && this.res.listening;
    el.innerHTML = `<section class="sec"><div class="sec-h"><div><h2>Luyện nói</h2><p>Nghe mẫu, bấm micro và đọc. App so từng từ bạn nói với câu gốc.</p></div></div>
   <div class="seg"><button class="chip" type="button" data-sm="word" aria-pressed="${this.mode === 'word'}">Đọc từ</button><button class="chip" type="button" data-sm="shadow" aria-pressed="${this.mode === 'shadow'}">Đọc câu (shadowing)</button><button class="chip" type="button" data-sm="translate" aria-pressed="${this.mode === 'translate'}">Dịch nói Việt → Anh</button></div>
   ${support}
   <div class="panel" style="display:grid;gap:12px"><div class="row"><span class="label">${this.i + 1} / ${items.length}</span><span class="grow"></span><button class="btn ghost" type="button" id="sPrev" aria-label="Câu trước">‹</button><button class="btn ghost" type="button" id="sNext" aria-label="Câu sau">›</button></div>
    ${prompt}${listen}
    <button class="mic ${rec ? 'rec' : ''}" type="button" id="mic" aria-label="${rec ? 'Dừng ghi âm' : 'Bấm để nói'}">${MIC_SVG}</button>
    <div class="small muted" style="text-align:center">${rec ? 'Đang nghe… nói xong app tự dừng' : 'Bấm micro rồi đọc to, rõ ràng'}</div>
    ${result}</div></section>`;
    el.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => { Mic.stop(); this.mode = b.dataset.sm; this.i = 0; this.res = null; this.render(el) });
    el.querySelector('#sPrev').onclick = () => { Mic.stop(); this.i = (this.i - 1 + items.length) % items.length; this.res = null; this.render(el) };
    el.querySelector('#sNext').onclick = () => { Mic.stop(); this.i = (this.i + 1) % items.length; this.res = null; this.render(el) };
    el.querySelector('#mic').onclick = () => Mic.start(target, {}, res => {
      this.res = res;
      if (res.m && res.m.score < 0.6 && this.mode !== 'translate') { const w = S.words[v.id]; if (w) { w.due = today(); save(); res.pushed = true; renderStrip() } }
      if (tab === 'speak') this.render(el)
    });
  }
};
