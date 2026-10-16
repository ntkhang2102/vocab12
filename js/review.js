/* =========================================================
   2. ÔN TẬP — lặp lại ngắt quãng 1 → 3 → 7 → 14 → 30 ngày; sai về 1 ngày.
   Mặc định ôn mọi từ đến hạn ở tất cả các Unit đã học.
   ========================================================= */
const Review = {
  st: null, scope: 'all',
  qtypes(v) { return v.type === 'phrase' ? ['cloze', 'm2w', 'dict'] : (v.syn ? ['cloze', 'syn', 'dict', 'm2w'] : ['cloze', 'dict', 'm2w']) },
  ids() { return dueIds(this.scope === 'unit' ? U.id : null).filter(id => wordById(id)) },
  needUnits() { return [...new Set(dueIds(this.scope === 'unit' ? U.id : null).map(id => id.split(':')[0]))].filter(u => !UNITS[u] && unitMeta(u) && unitMeta(u).ready) },
  build() {
    const ids = shuffle(this.ids());
    this.st = { scope: this.scope, day: today(), queue: ids.map(id => { const v = wordById(id); const t = this.qtypes(v); return { id, qt: t[(S.words[id].reviews || 0) % t.length] } }), i: 0, ans: null, right: 0 };
  },
  makeQ(item) {
    const v = wordById(item.id), UU = UNITS[v.unit], same = UU.vocab.filter(x => x.type === v.type && x.id !== v.id);
    if (item.qt === 'cloze' && v.ex.toLowerCase().includes(v.cloze.toLowerCase())) {
      const i = v.ex.toLowerCase().indexOf(v.cloze.toLowerCase());
      const blank = v.ex.slice(0, i) + '______' + v.ex.slice(i + v.cloze.length);
      let ds = shuffle(same.filter(x => v.type === 'phrase' || x.pos === v.pos)).slice(0, 3).map(x => x.cloze);
      if (ds.length < 3) ds = ds.concat(shuffle(same).map(x => x.cloze).filter(x => !ds.includes(x))).slice(0, 3);
      const opts = shuffle([v.cloze, ...ds]);
      return { kind: 'mc', title: 'Điền từ vào câu', stem: esc(blank), sub: '', opts, ans: opts.indexOf(v.cloze) };
    }
    if (item.qt === 'syn' && v.syn) {
      const useAnt = (S.words[v.id].reviews || 0) % 2 === 1 && v.ant && v.ant.length;
      const right = shuffle(useAnt ? v.ant : v.syn)[0];
      const others = shuffle(UU.WORDS.filter(x => x.syn && x.id !== v.id).flatMap(x => useAnt ? x.syn : (x.ant || []))).filter(x => x !== right).slice(0, 3);
      const opts = shuffle([right, ...others]);
      return { kind: 'mc', title: useAnt ? 'Chọn từ TRÁI nghĩa' : 'Chọn từ ĐỒNG nghĩa', stem: `<span class="headword" style="font-size:26px">${esc(v.word)}</span>`, sub: '', opts, ans: opts.indexOf(right) };
    }
    if (item.qt === 'dict') return { kind: 'dict', title: 'Nghe và viết lại', stem: '', sub: '' };
    const opts = shuffle([v.word, ...shuffle(same).slice(0, 3).map(x => x.word)]);
    return { kind: 'mc', title: 'Chọn từ đúng nghĩa', stem: '“' + esc(v.meaning) + '”', sub: '', opts, ans: opts.indexOf(v.word) };
  },
  render(el) {
    const need = this.needUnits();
    if (need.length) {
      el.innerHTML = `<section class="sec"><div class="sec-h"><div><h2>Ôn tập hôm nay</h2></div></div><p class="muted">Đang tải từ của ${need.length} Unit…</p></section>`;
      Promise.all(need.map(loadUnit)).then(() => { if (tab === 'review') this.render(el) }).catch(() => { el.querySelector('p').textContent = 'Không tải được dữ liệu. Kiểm tra mạng rồi thử lại.' });
      return;
    }
    const due = this.ids();
    if (this.st && (this.st.day !== today() || this.st.scope !== this.scope) && this.st.i >= this.st.queue.length) this.st = null;
    if (due.length && (!this.st || this.st.day !== today() || this.st.scope !== this.scope || this.st.i >= this.st.queue.length)) this.build();
    const st = this.st;
    const nAll = dueIds().length, nUnit = dueIds(U.id).length;
    const scopeSeg = `<div class="seg"><button class="chip" type="button" data-scope="all" aria-pressed="${this.scope === 'all'}">Tất cả Unit · ${nAll}</button><button class="chip" type="button" data-scope="unit" aria-pressed="${this.scope === 'unit'}">${esc(unitLabel(U.id))} · ${nUnit}</button></div>`;
    let body;
    if (!st || !st.queue.length || st.i >= st.queue.length) {
      body = this.emptyHTML(st && st.queue.length ? st : null);
    } else {
      const item = st.queue[st.i], v = wordById(item.id);
      if (!item.q) item.q = this.makeQ(item);
      const q = item.q;
      let inner = '';
      if (q.kind === 'mc') { inner = `<div class="q-stem">${q.stem}</div>${q.sub ? `<div class="tr">${q.sub}</div>` : ''}${mcHTML(q.opts, 'rv')}` }
      else inner = `<div class="row">${spkBtn(v.word, 'Nghe từ')} ${spkBtn(v.word, 'Nghe chậm', 'en-US', 0.6)}</div><form id="dictF" class="row"><input class="input" id="dictI" style="flex:1 1 200px" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Gõ từ bạn nghe được"><button class="btn" type="submit">Kiểm tra</button></form>`;
      let fb = '';
      if (st.ans !== null) {
        fb = `<div class="verdict ${st.ans ? 'ok' : 'no'}">${st.ans ? 'Đúng. Hẹn ôn lại sau ' + INTERVALS[S.words[v.id].box] + ' ngày.' : 'Chưa đúng. Từ này quay lại sau 1 ngày và được ghi vào Sổ câu sai.'}</div>
      ${answerInfoHTML(v)}
      <div class="row end"><button class="btn" type="button" id="rvNext">${st.i + 1 < st.queue.length ? 'Câu tiếp ›' : 'Xem kết quả ›'}</button></div>`
      }
      body = `<div class="progress"><i style="width:${st.i / st.queue.length * 100}%"></i></div>
     <div class="panel" style="display:grid;gap:12px"><div class="row"><b>${q.title}</b><span class="tag unit">${esc(unitLabel(v.unit, true))}</span><span class="grow"></span><span class="label">${st.i + 1}/${st.queue.length}</span></div>${inner}${fb}</div>`;
    }
    el.innerHTML = `<section class="sec"><div class="sec-h"><div><h2>Ôn tập hôm nay</h2><p>Trả lời đúng thì lần ôn sau giãn ra: 1 → 3 → 7 → 14 → 30 ngày. Sai thì quay về 1 ngày.</p></div></div>${scopeSeg}${body}</section>`;
    el.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { this.scope = b.dataset.scope; this.st = null; this.render(el) });
    this.bind(el);
  },
  emptyHTML(finished) {
    const ids = learnedIds(this.scope === 'unit' ? U.id : null), n = ids.length, t = today();
    const days = [...Array(7)].map((_, i) => ids.filter(id => S.words[id].due === t + i + 1).length);
    const mx = Math.max(1, ...days);
    const sched = `<div class="label" style="margin-top:4px">Lịch ôn 7 ngày tới</div><div class="sched">${days.map((c, i) => `<div><b>${c || ''}</b><i style="height:${c / mx * 64}px"></i>${i === 0 ? 'Mai' : dayLabel(t + i + 1)}</div>`).join('')}</div>`;
    if (!n) return `<div class="panel" style="display:grid;gap:10px"><h3 style="font-size:17px">Chưa có từ nào trong lịch ôn</h3><p class="muted" style="margin:0">Học xong một nhóm 10 từ ở mục Học từ, các từ đó sẽ được hẹn ôn ở đây.</p><div><button class="btn" type="button" data-go="learn">Đi học từ mới</button></div></div>`;
    const res = finished ? `<h3 style="font-size:17px">Xong ôn tập: đúng ${finished.right}/${finished.queue.length}</h3>` : `<h3 style="font-size:17px">Hôm nay không còn từ đến hạn</h3>`;
    return `<div class="panel" style="display:grid;gap:8px">${res}<p class="muted small" style="margin:0">${n} từ đang nằm trong lịch ôn. Hãy quay lại vào những ngày có từ đến hạn.</p>${sched}</div>`;
  },
  bind(el) {
    const st = this.st; if (!st || st.i >= st.queue.length) return;
    const item = st.queue[st.i], v = wordById(item.id), q = item.q;
    const finish = (ok, chosen) => {
      st.ans = ok; if (ok) st.right++; grade(v.id, ok);
      if (!ok) addWrong({ key: v.unit + '|rv|' + v.id, unit: v.unit, kind: 'rv', wid: v.id, qt: item.qt, src: 'Ôn từ', group: v.type === 'phrase' ? 'Phrasal verb' : 'Từ vựng', chosen });
      renderStrip(); this.render(el)
    };
    el.querySelectorAll('[data-rv]').forEach(b => b.onclick = () => { if (st.ans !== null) return; const i = +b.dataset.rv; st.chosen = i; finish(i === q.ans, q.opts[i]) });
    if (st.ans !== null && q.kind === 'mc') lockMC(el, 'rv', st.chosen, q.ans);
    const f = el.querySelector('#dictF');
    if (f) {
      const inp = el.querySelector('#dictI'); if (st.ans === null) { if (!item.played) { item.played = true; setTimeout(() => speak(v.word), 250) } } else { inp.value = st.typed || ''; inp.disabled = true }
      f.onsubmit = e => { e.preventDefault(); if (st.ans !== null) return; st.typed = inp.value; finish(norm(inp.value) === norm(v.word), inp.value) }
    }
    const n = el.querySelector('#rvNext'); if (n) n.onclick = () => { st.i++; st.ans = null; st.chosen = -1; st.typed = ''; this.render(el) };
  }
};
