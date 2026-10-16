/* =========================================================
   5. SỔ CÂU SAI — tự ghi từ Ôn tập, Bài tập, Kiểm tra, Viết;
   thống kê theo nguyên nhân; làm lại đúng 2 lần liên tiếp thì gỡ.
   ========================================================= */
const Notebook = {
  open: null, scope: 'all', gen: {},
  list() { return openWrong(this.scope === 'unit' ? U.id : null).filter(w => this.lookup(w)) },
  needUnits() { return [...new Set(openWrong().map(w => w.unit))].filter(u => !UNITS[u] && unitMeta(u) && unitMeta(u).ready) },
  lookup(w) {
    const UU = UNITS[w.unit]; if (!UU) return null;
    if (w.kind === 'q') { const set = UU.setById[w.set]; const q = set && set.qs.find(q => q.n === w.n); return q ? { type: 'mc', set, q } : null }
    if (w.kind === 'rv' || w.kind === 'kt') {
      const v = UU.byId[w.wid]; if (!v) return null;
      if (!this.gen[w.key]) { const qt = w.qt === 'dict' ? 'dict' : (canQT(v, w.qt) ? w.qt : 'm2w'); this.gen[w.key] = makeWordQ(v, qt) }
      return { type: 'word', v, q: this.gen[w.key] };
    }
    if (w.kind === 'wr') { const v = UU.byId[w.wid]; return v ? { type: 'wr', v } : null }
    return null;
  },
  stem(w) {
    const L = this.lookup(w);
    if (L.type === 'mc') return (L.set.type === 'cloze' ? `<span class="small muted">Chỗ trống (${L.q.n}):</span> ` : '') + inl(L.q.stem);
    if (L.type === 'word') return `<b>${esc(L.v.word)}</b> · ${esc(qtName(L.q.qt))}`;
    if (L.type === 'wr') return (w.mode === 'order' ? 'Sắp xếp: ' : 'Dịch: ') + esc(L.v.tr);
    return '';
  },
  render(el) {
    const need = this.needUnits();
    if (need.length) {
      el.innerHTML = `<section class="sec"><div class="sec-h"><div><h2>Sổ câu sai</h2></div></div><p class="muted">Đang tải dữ liệu…</p></section>`;
      Promise.all(need.map(loadUnit)).then(() => { if (tab === 'notebook') this.render(el) }).catch(() => { el.querySelector('p').textContent = 'Không tải được dữ liệu. Kiểm tra mạng rồi thử lại.' });
      return;
    }
    const list = this.list(), all = S.wrong;
    const groups = {}; list.forEach(w => groups[w.group] = (groups[w.group] || 0) + 1);
    const gs = Object.entries(groups).sort((a, b) => b[1] - a[1]); const mx = gs.length ? gs[0][1] : 1;
    const fixed = all.filter(w => w.done).length;
    const nAll = openWrong().length, nUnit = openWrong(U.id).length;
    const scopeSeg = `<div class="seg"><button class="chip" type="button" data-scope="all" aria-pressed="${this.scope === 'all'}">Tất cả Unit · ${nAll}</button><button class="chip" type="button" data-scope="unit" aria-pressed="${this.scope === 'unit'}">${esc(unitLabel(U.id))} · ${nUnit}</button></div>`;
    const summary = gs.length ? `<div class="panel" style="display:grid;gap:10px">
     <div><div class="label">Thống kê theo nguyên nhân</div><p style="margin:4px 0 0">Bạn hay sai nhất: <b>${esc(gs[0][0])}</b> (${gs[0][1]} câu).</p></div>
     <div class="bars">${gs.slice(0, 8).map(([g, c]) => `<div class="bar"><div class="t"><span>${esc(g)}</span><div class="track"><i style="width:${c / mx * 100}%"></i></div></div><b>${c}</b></div>`).join('')}</div>
     ${fixed ? `<p class="small muted" style="margin:0">Đã gỡ khỏi sổ ${fixed} câu nhờ làm đúng 2 lần liên tiếp.</p>` : ''}</div>` : '';
    const items = list.map(w => {
      const dueIn = w.day + 2 - today();
      const isOpen = this.open === w.key;
      return `<div class="wrong">
      <div class="row"><span class="tag">${esc(w.group)}</span><span class="tag src2">${esc(w.src)}</span>${this.scope === 'all' ? `<span class="tag unit">${esc(unitLabel(w.unit, true))}</span>` : ''}<span class="grow"></span><span class="pips" title="Cần đúng 2 lần liên tiếp">${[0, 1].map(k => `<i class="${k < w.streak ? 'on' : ''}"></i>`).join('')}</span></div>
      <div>${this.stem(w)}</div>
      ${w.chosen ? `<div class="small" style="color:var(--bad)">Bạn đã trả lời: ${esc(w.chosen)}${w.times > 1 ? ` · sai ${w.times} lần` : ''}</div>` : ''}
      <div class="row small muted"><span>${dueIn > 0 ? `Nên làm lại sau ${dueIn} ngày` : 'Đã đến lúc làm lại'}</span><span class="grow"></span><button class="btn ${dueIn > 0 ? 'ghost' : ''}" type="button" data-redo="${esc(w.key)}">${isOpen ? 'Đóng' : dueIn > 0 ? 'Làm lại sớm' : 'Làm lại'}</button></div>
      ${isOpen ? `<div id="redoBox"></div>` : ''}</div>`
    }).join('');
    el.innerHTML = `<section class="sec"><div class="sec-h"><div><h2>Sổ câu sai</h2><p>Mọi câu sai ở Ôn tập, Bài tập, Kiểm tra và Viết được ghi tự động. Làm lại đúng 2 lần liên tiếp thì câu được gỡ khỏi sổ.</p></div></div>
   ${scopeSeg}${summary}
   ${list.length ? items : `<div class="panel" style="display:grid;gap:8px"><h3 style="font-size:17px">Sổ đang trống</h3><p class="muted" style="margin:0">Làm bài ở mục Bài tập hoặc Kiểm tra từ vựng. Câu nào chọn sai sẽ xuất hiện ở đây, kèm nguyên nhân sai.</p><div><button class="btn" type="button" data-go="practice">Đi làm bài tập</button></div></div>`}</section>`;
    el.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { this.scope = b.dataset.scope; this.open = null; this.render(el) });
    el.querySelectorAll('[data-redo]').forEach(b => b.onclick = () => { this.open = this.open === b.dataset.redo ? null : b.dataset.redo; delete this.gen[this.open]; this.render(el) });
    if (this.open) { const w = list.find(x => x.key === this.open); if (w) this.redo(el.querySelector('#redoBox'), w, el); else this.open = null }
  },
  redo(box, w, el) {
    const L = this.lookup(w);
    const result = ok => {
      if (ok) {
        w.streak++;
        if (w.streak >= 2) { w.done = true; save(); toast('Đã gỡ câu này khỏi sổ'); this.open = null; delete this.gen[w.key]; renderStrip(); setTimeout(() => { if (tab === 'notebook') this.render(el) }, 900); return }
        toast('Đúng 1/2. Làm đúng thêm 1 lần nữa để gỡ khỏi sổ.');
      } else { w.streak = 0; w.times++ }
      save();
    };
    if (L.type === 'mc') {
      const q = L.q, set = L.set;
      box.innerHTML = `${set.passages ? passageHTML(set, q.p || 0, set.type === 'cloze' ? q.n : null, false) : ''}<div style="display:grid;gap:10px;margin-top:8px">${questionBody(q)}${mcHTML(q.opts, 'nb')}<div id="nbFb"></div></div>`;
      box.querySelectorAll('[data-nb]').forEach(b => b.onclick = () => {
        const i = +b.dataset.nb; lockMC(box, 'nb', i, q.ans); const ok = i === q.ans;
        if (!ok) w.chosen = plain(q.opts[i]); result(ok);
        box.querySelector('#nbFb').innerHTML = `<div class="verdict ${ok ? 'ok' : 'no'}">${ok ? 'Đúng' : 'Vẫn chưa đúng. Xem lại lời giải:'}</div>${explHTML(q.lines, q.ans)}<div class="row">${aiBtn(aiPromptQuestion(q, i, ''), 'Hỏi AI thêm')}</div>`;
      });
    } else if (L.type === 'word') {
      const q = L.q, v = L.v;
      box.innerHTML = `<div style="display:grid;gap:10px;margin-top:8px">${wordQHTML(q, v, 'nb')}<div id="nbFb"></div></div>`;
      const after = (ok, val) => {
        result(ok); if (!ok) w.chosen = val; if (w.kind === 'rv') grade(v.id, ok);
        box.querySelector('#nbFb').innerHTML = `<div class="verdict ${ok ? 'ok' : 'no'}">${ok ? 'Đúng' : 'Chưa đúng. Đáp án: ' + esc(q.right)}</div><div class="small"><b>${esc(v.word)}</b> · ${esc(v.meaning)}<br><span class="muted">${highlight(v.ex, v.cloze)}</span></div>`;
      };
      box.querySelectorAll('[data-nb]').forEach(b => b.onclick = () => { const i = +b.dataset.nb; lockMC(box, 'nb', i, q.ans); after(i === q.ans, q.opts[i]) });
      const f = box.querySelector('[data-nbf]');
      if (f) { const inp = f.querySelector('input'); if (q.listen) setTimeout(() => speak(v.word), 250); f.onsubmit = e => { e.preventDefault(); inp.disabled = true; after(norm(inp.value) === norm(v.word), inp.value) } }
    } else if (L.type === 'wr') {
      box.innerHTML = `<form id="nbW" style="display:grid;gap:8px;margin-top:8px"><textarea class="input" id="nbWI" placeholder="Viết lại câu tiếng Anh" autocapitalize="sentences"></textarea><div class="row end"><button class="btn" type="submit">Kiểm tra</button></div><div id="nbFb"></div></form>`;
      box.querySelector('#nbW').onsubmit = e => {
        e.preventDefault(); const val = box.querySelector('#nbWI').value; const r = Write.check(val, L.v); result(r.ok);
        if (!r.ok) w.chosen = val;
        box.querySelector('#nbFb').innerHTML = Write.resultHTML(r, L.v, val)
      };
    }
  }
};
