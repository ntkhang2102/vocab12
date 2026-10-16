/* =========================================================
   Khởi động app: thanh trên, thanh chức năng, chọn Unit, service worker
   ========================================================= */
const TABS = [
  ['learn', 'Học từ', '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>'],
  ['review', 'Ôn tập', '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>'],
  ['read', 'Đọc bài', '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>'],
  ['practice', 'Bài tập', '<path d="M9 4h6v3H9z"/><path d="M8 5H5v16h14V5h-3"/><path d="m9 13 2 2 4-4"/>'],
  ['notebook', 'Sổ sai', '<path d="M6 3h11l3 3v15H6z"/><path d="M10 10l5 5M15 10l-5 5"/>'],
  ['speak', 'Nói', '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'],
  ['write', 'Viết', '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>']
];
const VIEWS = { learn: Learn, review: Review, read: Reader, practice: Practice, notebook: Notebook, speak: Speak, write: Write };
let tab = (() => { const h = (location.hash || '').slice(1); if (TABS.some(t => t[0] === h)) return h; try { return localStorage.getItem('v12-tab') || 'learn' } catch (e) { return 'learn' } })();

function renderStrip() {
  if (!U) return;
  const pr = unitProgress(U.id), nl = learnedIds(U.id).length, nd = dueIds().length, nw = openWrong().length;
  $('#strip').innerHTML = `
   <button class="stat" type="button" data-go="learn"><b>${nl}/${U.vocab.length}</b><span>Từ đã học</span></button>
   <button class="stat ${nd ? 'hot' : ''}" type="button" data-go="review"><b>${nd}</b><span>Cần ôn hôm nay</span></button>
   <button class="stat ${nw ? 'alert' : ''}" type="button" data-go="notebook"><b>${nw}</b><span>Câu sai cần sửa</span></button>`;
  $('#nav').innerHTML = TABS.map(([k, l, ic]) => {
    const badge = k === 'review' && nd ? `<span class="badge">${nd}</span>` : k === 'notebook' && nw ? `<span class="badge">${nw}</span>` : '';
    return `<button type="button" data-go="${k}" ${tab === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24">${ic}</svg>${l}${badge}</button>`
  }).join('');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go) });
function go(k) {
  if (tab === 'read' && k !== 'read') { Reader.stop(); Reader.sel = null; document.body.classList.remove('sheet-open') }
  Mic.stop(); try { speechSynthesis.cancel() } catch (e) { }
  tab = k; try { localStorage.setItem('v12-tab', k) } catch (e) { }
  history.replaceState(null, '', '#' + k);
  render(); window.scrollTo({ top: 0 });
}
function render() {
  if (!U) return;
  AIQ.length = 0;
  renderStrip();
  if (tab !== 'read') document.body.classList.remove('sheet-open');
  VIEWS[tab].render($('#main'));
}
function setHeader() {
  const m = unitMeta(U.id);
  $('#bookLine').textContent = `Vocabulary 12 · Part ${m.part} (${m.level})`;
  $('#unitTitle').textContent = `Unit ${m.unit} · ${m.title}`;
  document.title = `Unit ${m.unit} P${m.part} · Vocabulary 12`;
}
async function selectUnit(id) {
  try {
    const u = await loadUnit(id);
    U = u; S.cur = id; save();
    Reader.stop(); Mic.stop();
    setHeader(); render();
  } catch (e) { toast('Không tải được Unit này. Kiểm tra kết nối mạng.') }
}
function syncHeaderVar() { const h = document.querySelector('.top'); if (h) document.documentElement.style.setProperty('--hdr', h.offsetHeight + 'px') }

/* ---------- màn hình đăng nhập ---------- */
function showLogin(msg) {
  document.body.classList.add('locked');
  $('#unitTitle').textContent = 'Vocabulary 12'; $('#bookLine').textContent = 'Tài liệu Reading · Vocabulary 12';
  $('#strip').innerHTML = ''; $('#nav').innerHTML = ''; $('#banner').innerHTML = '';
  $('#main').innerHTML = `<section class="sec login">
    <img src="icons/icon-192.png" alt="" width="72" height="72" style="border-radius:18px">
    <div><h2>Đăng nhập</h2><p class="muted" style="margin:4px 0 0">Nhập mã do giáo viên cấp để mở tài liệu. Chỉ cần nhập một lần trên mỗi máy.</p></div>
    ${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
    <form id="loginF" class="panel" style="display:grid;gap:10px">
      <label class="fld"><span class="label">Mã đăng nhập</span>
        <input class="input" id="codeI" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="VD: K7M2Q-9XRTD" style="font-size:20px;letter-spacing:.06em;text-transform:uppercase"></label>
      <div class="small" id="loginErr" style="color:var(--bad)"></div>
      <button class="btn" type="submit" id="loginBtn">Đăng nhập</button>
    </form>
    <p class="small muted" style="margin:0">Chưa có mã hoặc quên mã? Liên hệ giáo viên. Tiến độ học vẫn được giữ trên máy khi đăng nhập lại.</p>
  </section>`;
  const f = $('#loginF'), inp = $('#codeI'), btn = $('#loginBtn'), err = $('#loginErr');
  setTimeout(() => inp.focus({ preventScroll: true }), 200);
  f.onsubmit = async e => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Đang kiểm tra…';
    const r = await Auth.login(inp.value);
    if (!r.ok) { err.textContent = r.msg; btn.disabled = false; btn.textContent = 'Đăng nhập'; return }
    document.body.classList.remove('locked'); toast('Đăng nhập thành công'); boot();
  };
}
function logout() {
  Auth.logout(); try { localStorage.removeItem('v12-catalog') } catch (e) { }
  U = null; for (const k in UNITS) delete UNITS[k]; CATALOG = null;
  closeModal(); showLogin();
}

async function boot() {
  if (!Auth.supported()) { $('#main').innerHTML = '<div class="sec"><div class="notice">Trình duyệt này không hỗ trợ mở tài liệu. Hãy cập nhật iOS hoặc dùng Safari / Chrome mới.</div></div>'; return }
  if (!Auth.key && !(await Auth.restore())) return showLogin();
  // Giáo viên đã đổi khoá (thu hồi mã)? — chỉ kiểm tra được khi có mạng
  try { const kr = await Auth.fetchKeyring(); if (kr.keyVersion !== Auth.ver) { Auth.logout(); return showLogin('Mã đăng nhập đã được giáo viên đổi. Hãy nhập mã mới.') } } catch (e) { }
  try { await loadCatalog() }
  catch (e) {
    if (e.kind === 'key') { Auth.logout(); return showLogin('Phiên đăng nhập không còn hợp lệ. Hãy nhập lại mã.') }
    $('#main').innerHTML = `<div class="sec"><div class="notice">${esc(e.message)}</div></div>`; $('#unitTitle').textContent = 'Vocabulary 12'; return
  }
  document.body.classList.remove('locked');
  const av = availableUnits();
  if (!av.length) { $('#main').innerHTML = '<div class="sec"><div class="notice">Chưa có Unit nào được mở.</div></div>'; return }
  const first = !S.cur;
  const cur = S.cur && av.some(u => u.id === S.cur) ? S.cur : (CATALOG.defaultUnit && av.some(u => u.id === CATALOG.defaultUnit) ? CATALOG.defaultUnit : av[0].id);
  // Phiên bản: lần đầu mở app thì ghi nhận luôn; nội dung đổi nhưng không có ghi chú thì cập nhật âm thầm.
  const all = av.concat(availableTopics());
  if (!S.seen.app) { S.seen.app = APP_VERSION; all.forEach(u => S.seen.units[u.id] = u.contentVersion); save() }
  all.forEach(u => { if (!S.seen.units[u.id] || (S.seen.units[u.id] !== u.contentVersion && !(u.changes && u.changes.length))) S.seen.units[u.id] = u.contentVersion });
  save();
  await selectUnit(cur);
  updateNewsDot(); syncHeaderVar();
  if (first) openUnitPicker();
  // Tải sẵn mọi nội dung đã mở để học được khi không có mạng (file vẫn ở dạng mã hoá).
  // Chỉ tải file chưa có hoặc đã đổi phiên bản, tải lần lượt từng file để không nghẽn mạng.
  setTimeout(async () => {
    let got = {}; try { got = JSON.parse(localStorage.getItem('v12-pref') || '{}') } catch (e) { }
    for (const u of all) {
      if (got[u.id] === u.contentVersion) continue;
      try { const r = await fetch('content/' + u.id + '.bin'); if (r.ok) { got[u.id] = u.contentVersion; try { localStorage.setItem('v12-pref', JSON.stringify(got)) } catch (e) { } } } catch (e) { break }
    }
  }, 3000);
}
$('#unitBtn').onclick = () => CATALOG && Auth.key && openUnitPicker();
$('#setBtn').onclick = () => CATALOG && Auth.key && openSettings();
window.addEventListener('resize', syncHeaderVar);
window.addEventListener('pageshow', () => { if (U) { renderStrip() } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && U) renderStrip(); else { Mic.stop() } });

/* Service worker: chạy offline + báo khi có bản cập nhật */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const watch = w => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { swWaiting = w; renderBanner() } });
      if (reg.waiting && navigator.serviceWorker.controller) { swWaiting = reg.waiting; renderBanner() }
      reg.addEventListener('updatefound', () => watch(reg.installing));
      setInterval(() => reg.update().catch(() => { }), 30 * 60 * 1000);
    }).catch(() => { });
    let reloaded = false; const hadController = !!navigator.serviceWorker.controller;
    // chỉ tải lại khi đang dùng bản cũ và người học bấm "Tải lại" (lần cài đầu tiên thì không)
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload() } });
  });
}
boot();
