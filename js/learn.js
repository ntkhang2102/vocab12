/* =========================================================
   1. HỌC TỪ — tự lật thẻ, nghe US/UK/chậm, đọc theo; từ mới phải
   viết lại đúng từ và nghĩa; sau mỗi nhóm 10 từ kiểm tra 3 bước.
   ========================================================= */
const Learn = {
  st: null,
  groups() {
    const g = [], W = U.WORDS, P = U.PHR;
    for (let i = 0; i < W.length; i += 10) g.push({ items: W.slice(i, i + 10), name: `Từ vựng ${i + 1}–${Math.min(i + 10, W.length)}` });
    for (let i = 0; i < P.length; i += 10) g.push({ items: P.slice(i, i + 10), name: `Phrasal verbs ${i + 1}–${Math.min(i + 10, P.length)}` });
    return g;
  },
  init(gi) { this.st = { unit: U.id, gi, idx: 0, flip: false, phase: 'cards', check: null, heardN: {}, rated: {}, wr: {}, mic: null } },
  cardDone(v) { const st = this.st, r = st.rated[v.id]; if (r === undefined) return false; if (r === 2) return true; const w = st.wr[v.id] || {}; return w.word === true && w.mean > 0 },
  render(el) {
    const groups = this.groups();
    if (!this.st || this.st.unit !== U.id) {
      const first = groups.findIndex(x => x.items.some(v => !S.words[v.id]));
      this.init(first < 0 ? 0 : first);
    }
    const st = this.st, g = groups[st.gi];
    const chips = groups.map((x, i) => { const n = x.items.filter(v => S.words[v.id]).length; return `<button type="button" class="chip" data-g="${i}" aria-pressed="${i === st.gi}"><span class="dot ${n === x.items.length ? 'full' : n ? 'half' : ''}"></span>${x.name}</button>` }).join('');
    let body = '';
    if (st.phase === 'cards') body = this.cardHTML(g);
    else if (st.phase === 'check') body = this.checkHTML(g);
    else body = this.doneHTML(g);
    el.innerHTML = `<section class="sec">
   <div class="sec-h"><div><h2>Học từ mới</h2><p>Tự lật thẻ, nghe và đọc theo bao nhiêu lần tuỳ ý. Từ nào còn mới thì viết lại từ và nghĩa trước khi sang thẻ tiếp.</p></div></div>
   <div class="seg">${chips}</div>${body}</section>`;
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { Mic.stop(); this.init(+b.dataset.g); this.render(el) });
    this.bind(el, g);
  },
  cardHTML(g) {
    const st = this.st, v = g.items[st.idx], r = st.rated[v.id], wr = st.wr[v.id] || {}, N = g.items.length;
    const doneN = g.items.filter(x => this.cardDone(x)).length;
    const face = st.flip
      ? `<span class="face-tag">Mặt sau</span><div class="headword sm">${esc(v.word)}</div><div class="meaning">${esc(v.meaning)}</div>
     <div class="kv">${v.colloc ? `<div><b>Collocation:</b> ${esc(v.colloc)}</div>` : ''}
      <div class="ex">${highlight(v.ex, v.cloze)}</div><div class="tr">${esc(v.tr)}</div>
      ${v.syn ? `<div class="syn"><span class="s">≈ ${esc(v.syn.join(', '))}</span><span class="a">≠ ${esc((v.ant || []).join(', '))}</span></div>` : ''}</div>`
      : `<span class="face-tag">Mặt trước</span><span class="pos">${v.type === 'word' ? esc(v.pos) : 'phrasal verb / collocation'}</span>
     <div class="headword">${esc(v.word)}</div>${v.ipa ? `<div class="ipa">${esc(v.ipa)}</div>` : ''}`;
    const heard = st.heardN[v.id] || 0;
    let writeBox = '';
    if (r === 0 || r === 1) {
      const wOK = wr.word === true, mOK = wr.mean > 0;
      writeBox = `<form class="panel writebox" id="wrF" style="display:grid;gap:10px">
      <div class="row"><b>Từ mới: viết lại từ và nghĩa</b><span class="grow"></span>${wOK && mOK ? '<span class="verdict ok small">Hoàn thành</span>' : ''}</div>
      <p class="small muted" style="margin:0">Mẹo: lật thẻ về mặt trước hoặc che thẻ rồi tự viết. Sai thì xem lại thẻ và viết lại.</p>
      <label class="fld"><span class="label">Từ tiếng Anh</span><input class="input ${wr.word === true ? 'good' : wr.word === false ? 'badf' : ''}" id="wrW" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(wr.wv || '')}" ${wOK ? 'disabled' : ''}></label>
      ${wr.word === false ? `<div class="small" style="color:var(--bad)">Chưa đúng chính tả. Xem lại thẻ rồi viết lại.</div>` : ''}
      <label class="fld"><span class="label">Nghĩa tiếng Việt</span><input class="input ${mOK ? 'good' : wr.mean === 0 ? 'badf' : ''}" id="wrM" autocomplete="off" value="${esc(wr.mv || '')}" ${mOK ? 'disabled' : ''}></label>
      ${wr.mean === 0 ? `<div class="small" style="color:var(--bad)">Nghĩa chưa khớp. Nghĩa trong sách: ${st.flip ? esc(v.meaning) : 'lật thẻ để xem'}.</div>` : wr.mean === 1 ? `<div class="small" style="color:var(--warn)">Đúng nghĩa, nhớ gõ đủ dấu tiếng Việt.</div>` : ''}
      ${wOK && mOK ? '' : `<div class="row end"><button class="btn" type="submit">Kiểm tra</button></div>`}
    </form>`;
    }
    const last = st.idx === N - 1, can = this.cardDone(v);
    return `<div class="row small muted"><span>Thẻ ${st.idx + 1}/${N} · đã xong ${doneN}/${N}</span></div>
   <div class="progress" aria-hidden="true"><i style="width:${doneN / N * 100}%"></i></div>
   <button type="button" class="card fcard ${st.flip ? 'back' : ''}" id="flip" aria-label="Lật thẻ">${face}<span class="flip-hint">${st.flip ? 'Chạm để lật về mặt trước' : 'Chạm để lật xem nghĩa và câu ví dụ'}</span></button>
   <div class="panel" style="display:grid;gap:10px">
     <div class="row"><span class="label">Luyện phát âm</span><span class="grow"></span><span class="small muted" id="heardN">Đã nghe ${heard} lần</span></div>
     <div class="row">${spkBtn(v.word, 'US')} ${spkBtn(v.word, 'UK', 'en-GB')} ${spkBtn(v.word, 'Chậm', 'en-US', 0.55)} ${st.flip ? spkBtn(v.ex, 'Câu ví dụ') : ''}
       <span class="grow"></span><button class="speak mic-sm ${Mic.rec && st.mic && st.mic.listening ? 'rec' : ''}" type="button" id="cMic">${MIC_SVG}Đọc theo</button></div>
     ${Mic.html(st.mic, v.word)}
   </div>
   <div><div class="label" style="margin-bottom:6px">Bạn biết từ này đến mức nào?</div><div class="rate">${['Chưa biết', 'Chưa chắc', 'Đã biết'].map((t, i) => `<button type="button" class="r${i} ${r === i ? 'on' : ''}" data-rate="${i}" aria-pressed="${r === i}">${t}</button>`).join('')}</div></div>
   ${writeBox}
   <div class="row"><button class="btn ghost" type="button" id="prev" ${st.idx ? '' : 'disabled'}>‹ Thẻ trước</button><span class="grow"></span>
    ${last ? `<button class="btn" type="button" id="toCheck" ${doneN === N ? '' : 'disabled'}>Kiểm tra ${N} từ ›</button>` : `<button class="btn" type="button" id="next" ${can ? '' : 'disabled'}>Thẻ tiếp ›</button>`}</div>
   ${!can ? `<p class="small muted" style="margin:0;text-align:right">${r === undefined ? 'Chọn mức độ biết từ để sang thẻ tiếp.' : 'Viết đúng từ và nghĩa để sang thẻ tiếp.'}</p>` : ''}`;
  },
  startCheck(g) { const items = shuffle(g.items); this.st.phase = 'check'; this.st.check = { round: 0, qi: 0, items, res: Object.fromEntries(items.map(v => [v.id, [null, null, null]])), answered: null } },
  checkHTML(g) {
    const c = this.st.check, v = c.items[c.qi], pool = g.items.length >= 4 ? g.items : (v.type === 'word' ? U.WORDS : U.PHR);
    const titles = ['Bước 1 · Nghe rồi chọn nghĩa', 'Bước 2 · Nhìn nghĩa, chọn từ', 'Bước 3 · Tự gõ lại từ'];
    let q = '';
    if (c.round < 2 && !c.opts) { c.opts = shuffle([v, ...pick(pool, 3, [v])]) }
    if (c.round === 0) q = `<div class="row">${spkBtn(v.word, 'Nghe')} ${spkBtn(v.word, 'Nghe chậm', 'en-US', 0.55)}<span class="muted small">Bấm nghe bao nhiêu lần cũng được</span></div>${mcHTML(c.opts.map(o => o.meaning), 'ck')}`;
    else if (c.round === 1) q = `<div class="q-stem">“${esc(v.meaning)}”</div>${mcHTML(c.opts.map(o => o.word), 'ck')}`;
    else q = `<div class="q-stem">“${esc(v.meaning)}”</div><div class="muted small">Gợi ý: bắt đầu bằng “${esc(v.word[0])}”, ${v.word.length} ký tự</div>
     <form id="typeF" class="row"><input class="input grow" id="typeI" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Gõ từ tiếng Anh" style="flex:1 1 200px"><button class="btn" type="submit">Kiểm tra</button></form>`;
    const total = c.items.length * 3, done = c.round * c.items.length + c.qi;
    let fb = '';
    if (c.answered !== null) { const ok = c.answered; fb = `<div class="verdict ${ok ? 'ok' : 'no'}">${ok ? 'Đúng' : 'Chưa đúng. Đáp án: ' + esc(v.word) + ' = ' + esc(v.meaning)}</div><div class="row end"><button class="btn" type="button" id="ckNext">Tiếp ›</button></div>` }
    return `<div class="steps">${[0, 1, 2].map(i => `<span class="${i <= c.round ? 'on' : ''}"></span>`).join('')}</div>
   <div class="panel" style="display:grid;gap:12px"><div class="row"><b>${titles[c.round]}</b><span class="grow"></span><span class="label">${done + 1}/${total}</span></div>${q}${fb}</div>`;
  },
  doneHTML(g) {
    const c = this.st.check;
    const rows = g.items.map(v => { const r = c.res[v.id], ok = r.every(Boolean); return `<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0"><span><b>${esc(v.word)}</b> <span class="muted small">${esc(v.meaning)}</span></span><span class="small" style="color:var(${ok ? '--good' : '--bad'});font-weight:600">${r.map(x => x ? '●' : '○').join('')}</span></div>` }).join('');
    const pass = g.items.filter(v => c.res[v.id].every(Boolean)).length;
    return `<div class="panel" style="display:grid;gap:10px">
   <h3 style="font-size:18px">Xong lượt học: ${pass}/${g.items.length} từ qua đủ 3 bước</h3>
   <p class="muted small" style="margin:0">Từ qua đủ 3 bước được hẹn ôn lại vào ngày mai. Từ còn sai bước nào sẽ xuất hiện ngay trong mục Ôn tập hôm nay.</p>
   <div>${rows}</div>
   <div class="row end"><button class="btn ghost" type="button" id="again">Học lại nhóm này</button><button class="btn" type="button" data-go="review">Sang Ôn tập ›</button></div></div>`;
  },
  bind(el, g) {
    const st = this.st;
    if (st.phase === 'cards') {
      const v = g.items[st.idx];
      el.querySelector('#flip').onclick = () => { st.flip = !st.flip; this.render(el) };
      el.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', () => { st.heardN[v.id] = (st.heardN[v.id] || 0) + 1; const h = el.querySelector('#heardN'); if (h) h.textContent = 'Đã nghe ' + st.heardN[v.id] + ' lần' }));
      el.querySelector('#cMic').onclick = () => Mic.start(v.word, {}, res => { st.mic = res; if (tab === 'learn') this.render(el) });
      el.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => { const r = +b.dataset.rate; st.rated[v.id] = r; S.rate[v.id] = r; save(); this.render(el) });
      const f = el.querySelector('#wrF');
      if (f) f.onsubmit = e => {
        e.preventDefault(); const wr = st.wr[v.id] || (st.wr[v.id] = {});
        const wi = el.querySelector('#wrW'), mi = el.querySelector('#wrM');
        if (wr.word !== true) { wr.wv = wi.value; wr.word = norm(wi.value) === norm(v.word) }
        if (!(wr.mean > 0)) { wr.mv = mi.value; wr.mean = meaningScore(mi.value, v.meaning) }
        this.render(el)
      };
      const goTo = i => { Mic.stop(); st.idx = i; st.flip = false; st.mic = null; this.render(el) };
      el.querySelector('#prev').onclick = () => goTo(st.idx - 1);
      const n = el.querySelector('#next'); if (n) n.onclick = () => goTo(st.idx + 1);
      const tc = el.querySelector('#toCheck'); if (tc) tc.onclick = () => { Mic.stop(); this.startCheck(g); this.render(el) };
    } else if (st.phase === 'check') {
      const c = st.check, v = c.items[c.qi];
      if (c.round === 0 && c.answered === null && !c.spoken) { c.spoken = true; setTimeout(() => speak(v.word), 250) }
      const answer = ok => { c.res[v.id][c.round] = ok; c.answered = ok; this.render(el) };
      el.querySelectorAll('[data-ck]').forEach(b => b.onclick = () => { if (c.answered !== null) return; const i = +b.dataset.ck; c.chosen = i; answer(c.opts[i].id === v.id) });
      if (c.answered !== null && c.round < 2) lockMC(el, 'ck', c.chosen, c.opts.findIndex(o => o.id === v.id));
      const tf = el.querySelector('#typeF');
      if (tf) {
        const inp = el.querySelector('#typeI'); if (c.answered === null) inp.focus({ preventScroll: true }); else { inp.value = c.typed || ''; inp.disabled = true }
        tf.onsubmit = e => { e.preventDefault(); if (c.answered !== null) return; c.typed = inp.value; answer(norm(inp.value) === norm(v.word)) }
      }
      const n = el.querySelector('#ckNext');
      if (n) n.onclick = () => {
        c.answered = null; c.opts = null; c.spoken = false; c.chosen = -1; c.typed = ''; c.qi++;
        if (c.qi >= c.items.length) { c.qi = 0; c.round++; c.items = shuffle(c.items) }
        if (c.round > 2) {
          g.items.forEach(x => {
            const ok = c.res[x.id].every(Boolean); const w = S.words[x.id] || (S.words[x.id] = { box: 0, due: today(), reviews: 0 });
            if (ok) { w.box = Math.max(w.box, 1); w.due = Math.max(w.due, today() + 1) } else { w.box = 0; w.due = today() }
          });
          save(); st.phase = 'done'; renderStrip();
        }
        this.render(el); el.scrollIntoView({ block: 'start' });
      };
    } else {
      el.querySelector('#again').onclick = () => { this.init(st.gi); this.render(el) };
    }
  }
};
