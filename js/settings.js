/* =========================================================
   Chọn Part/Unit · Cài đặt · Sao lưu tiến độ · Phiên bản & "Có gì mới"
   ========================================================= */
function unitProgress(id) { const m = unitMeta(id); const n = learnedIds(id).length; return { n, total: (m && m.vocabCount) || 60 } }

function openUnitPicker() {
  const html = `<div class="modal-h"><h2>Chọn bài học</h2><button class="btn ghost sm" type="button" data-close>Đóng</button></div>
  ${CATALOG.parts.map(p => `<div style="display:grid;gap:8px">
    <div class="part-h"><h3>Part ${p.part} · ${esc(p.level)}</h3><span class="small muted">${esc(p.name || '')}</span></div>
    <div class="ugrid">${p.units.map(u => {
      const pr = unitProgress(u.id);
      return `<button type="button" class="ucard ${U && U.id === u.id ? 'cur' : ''}" data-pick="${u.id}" ${u.ready ? '' : 'disabled'}>
        <b>Unit ${u.unit}</b><span>${esc(u.title)}</span>
        ${u.ready ? `<div class="progress" aria-hidden="true"><i style="width:${Math.min(100, pr.n / pr.total * 100)}%"></i></div>` : '<span class="small">Sắp có</span>'}
      </button>`}).join('')}</div></div>`).join('')}`;
  openModal(html, m => m.querySelectorAll('[data-pick]').forEach(b => b.onclick = async () => {
    closeModal(); await selectUnit(b.dataset.pick); window.scrollTo({ top: 0 });
  }));
}

let verTaps = 0;
function openSettings() {
  const news = pendingNews();
  const prov = S.settings.ai || 'claude';
  const html = `<div class="modal-h"><h2>Cài đặt</h2><button class="btn ghost sm" type="button" data-close>Đóng</button></div>
   ${news.length ? `<div class="panel news"><div class="row"><b>Có gì mới</b><span class="grow"></span><button class="btn soft sm" type="button" id="seenNews">Đã xem</button></div>${newsHTML(news)}</div>` : ''}
   <div class="panel" style="display:grid;gap:10px">
     <div class="label">Hỏi AI</div>
     <p class="small muted" style="margin:0">Nút “Hỏi AI” sẽ chép sẵn câu hỏi và mở ứng dụng AI bạn chọn (miễn phí, cần đăng nhập ứng dụng đó).</p>
     <div class="radio-row">${Object.entries(AI_PROVIDERS).map(([k, p]) => `<button type="button" class="chip" data-ai-p="${k}" aria-pressed="${prov === k}">${p.name}</button>`).join('')}</div>
     <p class="small muted" style="margin:0">Chấm bằng khóa API riêng hoặc khóa chung của giáo viên: <i>sẽ có ở phiên bản sau</i>.</p>
   </div>
   <div class="panel" style="display:grid;gap:10px">
     <div class="label">Sao lưu tiến độ</div>
     <p class="small muted" style="margin:0">Tiến độ chỉ lưu trên máy này. Hãy sao lưu định kỳ để không mất khi đổi máy hoặc xoá app.</p>
     <div class="row"><button class="btn soft" type="button" id="bkFile">Tải file sao lưu</button><button class="btn ghost" type="button" id="bkCode">Chép mã sao lưu</button></div>
     <details><summary class="small" style="cursor:pointer;color:var(--accent)">Khôi phục từ file hoặc mã</summary>
       <div style="display:grid;gap:8px;margin-top:8px">
         <input type="file" id="rsFile" accept=".json,application/json" class="small">
         <textarea class="input" id="rsCode" placeholder="Hoặc dán mã sao lưu vào đây" style="min-height:70px"></textarea>
         <div class="row end"><button class="btn danger sm" type="button" id="rsGo">Khôi phục (ghi đè tiến độ hiện tại)</button></div>
       </div></details>
   </div>
   <div class="panel" style="display:grid;gap:8px">
     <div class="label">Thông tin</div>
     <div class="setrow small"><span>Phiên bản app</span><b id="verTap" style="cursor:default">${APP_VERSION}</b></div>
     <div class="setrow small"><span>Nội dung ${esc(unitLabel(U.id))}</span><b>${esc((unitMeta(U.id) || {}).contentVersion || '')}</b></div>
     <div class="setrow small"><span>Đã học</span><b>${learnedIds().length} từ · ${openWrong().length} câu trong Sổ sai</b></div>
     <p class="small muted" style="margin:0">Dữ liệu lấy từ bộ Tài liệu Reading – Vocabulary 12. Bản dịch có nhãn “Claude soạn” đang chờ giáo viên duyệt.</p>
     <button class="btn ghost sm" type="button" id="allNews" style="justify-self:start">Xem lịch sử cập nhật</button>
   </div>
   <div class="panel" style="display:grid;gap:8px">
     <div class="label">Tài khoản</div>
     <p class="small muted" style="margin:0">Máy này đã đăng nhập bằng mã của giáo viên cấp. Đăng xuất không xoá tiến độ học.</p>
     <button class="btn ghost sm" type="button" id="logoutBtn" style="justify-self:start">Đăng xuất khỏi máy này</button>
   </div>
   <div id="teacher"></div>`;
  openModal(html, m => {
    m.querySelectorAll('[data-ai-p]').forEach(b => b.onclick = () => { S.settings.ai = b.dataset.aiP; save(); m.querySelectorAll('[data-ai-p]').forEach(x => x.setAttribute('aria-pressed', x === b)); toast('Đã chọn ' + AI_PROVIDERS[S.settings.ai].name) });
    const sn = m.querySelector('#seenNews'); if (sn) sn.onclick = () => { markNewsSeen(); openSettings() };
    m.querySelector('#allNews').onclick = () => openNews(true);
    let lo = false; m.querySelector('#logoutBtn').onclick = e => { if (!lo) { lo = true; e.target.textContent = 'Bấm lần nữa để đăng xuất'; setTimeout(() => { lo = false; e.target.textContent = 'Đăng xuất khỏi máy này' }, 3000); return } logout() };
    m.querySelector('#bkFile').onclick = () => {
      const blob = new Blob([JSON.stringify({ app: 'vocab12', at: new Date().toISOString(), state: S })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vocab12-saoluu-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 2000);
      S.lastBackup = Date.now(); save();
    };
    m.querySelector('#bkCode').onclick = async () => {
      const code = 'V12:' + btoa(unescape(encodeURIComponent(JSON.stringify(S))));
      if (await copyText(code)) { S.lastBackup = Date.now(); save(); toast('Đã chép mã sao lưu. Hãy dán vào Ghi chú hoặc gửi cho chính mình.') } else showPrompt(code);
    };
    m.querySelector('#rsGo').onclick = async () => {
      let txt = m.querySelector('#rsCode').value.trim();
      const f = m.querySelector('#rsFile').files[0];
      try {
        if (f) txt = await f.text();
        let obj;
        if (txt.startsWith('V12:')) obj = JSON.parse(decodeURIComponent(escape(atob(txt.slice(4)))));
        else { const j = JSON.parse(txt); obj = j.state || j }
        if (!obj || obj.v !== 2 || !obj.words) throw new Error('bad');
        S = Object.assign(freshState(), obj); save(); closeModal(); toast('Đã khôi phục tiến độ'); await selectUnit(S.cur || U.id);
      } catch (e) { toast('Mã hoặc file sao lưu không hợp lệ') }
    };
    m.querySelector('#verTap').onclick = () => { if (++verTaps >= 5) { verTaps = 0; renderTeacher(m.querySelector('#teacher')) } };
  });
}
function renderTeacher(box) {
  box.innerHTML = `<div class="panel" style="display:grid;gap:10px;border-color:var(--warn)">
   <div class="label">Công cụ giáo viên</div>
   <p class="small muted" style="margin:0">Chỉ dùng khi kiểm tra app. Ngày giả lập hiện tại: lệch ${S.dayOff || 0} ngày.</p>
   <div class="row"><button class="btn ghost sm" type="button" id="tNext">Giả lập: sang ngày hôm sau</button><button class="btn ghost sm" type="button" id="tToday">Về ngày thật</button></div>
   <div class="row"><a class="btn ghost sm" href="duyet.html" target="_blank" rel="noopener">Trang duyệt bản dịch</a><a class="btn ghost sm" href="quan-ly-ma.html" target="_blank" rel="noopener">Quản lý mã</a><button class="btn danger sm" type="button" id="tReset">Xoá toàn bộ tiến độ</button></div></div>`;
  box.querySelector('#tNext').onclick = () => { S.dayOff = (S.dayOff || 0) + 1; save(); toast('Đã chuyển sang ngày hôm sau (giả lập)'); renderTeacher(box); render() };
  box.querySelector('#tToday').onclick = () => { S.dayOff = 0; save(); toast('Đã về ngày thật'); renderTeacher(box); render() };
  let arm = false;
  box.querySelector('#tReset').onclick = e => {
    if (!arm) { arm = true; e.target.textContent = 'Bấm lần nữa để xoá'; setTimeout(() => { arm = false; e.target.textContent = 'Xoá toàn bộ tiến độ' }, 3000); return }
    const keep = { settings: S.settings, cur: S.cur, seen: S.seen }; S = Object.assign(freshState(), keep); save();
    Learn.st = Review.st = Practice.st = null; Quiz.run = null; closeModal(); toast('Đã xoá toàn bộ tiến độ'); render();
  };
}

/* ---------- Có gì mới ---------- */
function verCmp(a, b) { const pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number); for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d } return 0 }
function pendingNews() {
  const out = [];
  if (!S.seen.app) return out; // lần đầu mở app: không báo tin cũ
  (CATALOG.changes || []).forEach(c => { if (verCmp(c.version, S.seen.app) > 0 && verCmp(c.version, APP_VERSION) <= 0) out.push(c) });
  availableUnits().concat(availableTopics()).forEach(u => { const seen = S.seen.units[u.id]; if (seen && seen !== u.contentVersion && u.changes && u.changes.length) out.push({ unit: u.id, version: u.contentVersion, items: u.changes }) });
  return out;
}
function newsHTML(list) {
  return list.map(c => `<div><div class="small"><b>${c.unit ? 'Nội dung ' + esc(unitLabel(c.unit)) : 'Phiên bản ' + esc(c.version)}</b>${c.date ? ' · ' + esc(c.date) : ''}</div><ul>${(c.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('');
}
function markNewsSeen() {
  S.seen.app = APP_VERSION;
  availableUnits().concat(availableTopics()).forEach(u => S.seen.units[u.id] = u.contentVersion);
  save(); updateNewsDot();
}
function updateNewsDot() { const n = pendingNews().length; $('#newDot').hidden = !n; renderBanner() }
function openNews(all) {
  const list = all ? (CATALOG.changes || []).slice().reverse() : pendingNews();
  openModal(`<div class="modal-h"><h2>${all ? 'Lịch sử cập nhật' : 'Có gì mới'}</h2><button class="btn ghost sm" type="button" data-close>Đóng</button></div>
   <div class="panel news">${list.length ? newsHTML(list) : '<span class="muted">Chưa có cập nhật mới.</span>'}</div>`);
  if (!all) markNewsSeen();
}
let swWaiting = null;
function renderBanner() {
  const b = $('#banner'); if (!b) return;
  if (swWaiting) { b.innerHTML = `<div class="banner"><span class="grow"><b>Đã có bản cập nhật app.</b> Tải lại để dùng bản mới; tiến độ học vẫn được giữ.</span><button class="btn sm" type="button" id="swReload">Tải lại</button></div>`; b.querySelector('#swReload').onclick = () => { swWaiting.postMessage('skipWaiting') }; return }
  const n = pendingNews();
  if (n.length) { b.innerHTML = `<div class="banner"><span class="grow"><b>Có gì mới:</b> ${n.length} cập nhật ${n.some(x => x.unit) ? 'nội dung' : 'app'}.</span><button class="btn soft sm" type="button" id="seeNews">Xem</button></div>`; b.querySelector('#seeNews').onclick = () => openNews(false); return }
  const days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : null;
  if (learnedIds().length >= 40 && (days === null || days >= 14) && !sessionStorage.getItem('v12-bk-hide')) {
    b.innerHTML = `<div class="banner"><span class="grow">Bạn đã học ${learnedIds().length} từ. <b>Nhớ sao lưu tiến độ</b> để không mất khi đổi máy.</span><button class="btn soft sm" type="button" id="bkNow">Sao lưu</button><button class="speak" type="button" id="bkHide" aria-label="Ẩn">✕</button></div>`;
    b.querySelector('#bkNow').onclick = openSettings; b.querySelector('#bkHide').onclick = () => { try { sessionStorage.setItem('v12-bk-hide', '1') } catch (e) { } renderBanner() };
    return;
  }
  b.innerHTML = '';
}
